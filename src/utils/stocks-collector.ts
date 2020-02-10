import axios, { AxiosRequestConfig } from 'axios';
import qs from 'qs';
import cheerio from 'cheerio';
import get from 'lodash/get';

const PER_PAGE = 1200;

let currentPage = 0;

interface Stock {
    rate: number,
    reliable: boolean,
    riskCategory: number,
    symbol: {
        lotSize: number,
        showName: string,
        ticker: string
    }
}

export async function collectStocks(): Promise<Stock[]> {
    let stocks: Stock[] = [];

    while (true) {
        const response = await axios.post('https://api.tinkoff.ru/trading/stocks/list', {
            start: currentPage * PER_PAGE,
            end: (currentPage + 1) * PER_PAGE,
            country: 'All',
            orderType: 'Asc',
            sortType: 'ByName'
        });

        const pageStocks = <Stock[]>(get(response, 'data.payload.values', []));

        if (pageStocks.length === 0) {
            break;
        }

        stocks = stocks.concat(pageStocks);
        currentPage += 1;
    }

    return stocks;
}

export async function collectStockEarnings(): Promise<any> {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

    const options = <AxiosRequestConfig>({
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest'},
        data: qs.stringify({
            dateFrom: todayStr,
            dateTo: todayStr,
        }),
        url: 'https://m.ru.investing.com/earnings-calendar/services/earningsFilter/',
    });

    const {data} = await axios(options);

    const $ = cheerio.load(data);

   return $('article.calItem').toArray().map(stockElement => {
        const stockEarningDetailsElement = $('.earningsDetails', stockElement);

        const name = $('p', stockElement).text().trim();
        const tickerMatch = name.match(/.*?\((.*)?\)/);

        return {
            name,
            ticker: tickerMatch && tickerMatch[1],
            link: $('a', stockElement).prop('href'),
            epsForecast: $('div:first-child .act', stockEarningDetailsElement).text(),
            epsFact: $('div:first-child .fore', stockEarningDetailsElement).text(),
            profitForecast: $('div:last-child .act', stockEarningDetailsElement).text(),
            profitFact: $('div:last-child .fore', stockEarningDetailsElement).text(),
            epsPositive: Boolean($('div:first-child .act.greenFont', stockEarningDetailsElement).text()),
            epsNegative: Boolean($('div:first-child .act.redFont', stockEarningDetailsElement).text()),
            profitPositive: Boolean($('div:last-child .act.greenFont', stockEarningDetailsElement).text()),
            profitNegative: Boolean($('div:last-child .act.redFont', stockEarningDetailsElement).text()),
        };
   });
}
