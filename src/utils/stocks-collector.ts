import axios, { AxiosRequestConfig } from 'axios';
import qs from 'qs';
import cheerio from 'cheerio';
import get from 'lodash/get';

const PER_PAGE = 1200;

let currentPage = 0;

export interface Stock {
    rate: number,
    reliable: boolean,
    riskCategory: number,
    symbol: {
        lotSize: number,
        showName: string,
        ticker: string
    }
};

export interface StockEarning {
    name: string,
    showName: string,
    ticker: string,
    link: string,
    earningShowed: boolean,
    epsForecast: string,
    epsFact: string,
    incomeForecast: string,
    incomeFact: string,
    epsPositive: boolean,
    epsNegative: boolean,
    incomePositive: boolean,
    incomeNegative: boolean,
};

export interface StockEarningDiff {
    epsDif: number,
    incomeDif: number,
    epsRate: number,
    incomeRate: number,
};

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

export async function collectStockEarnings(): Promise<Map<string, StockEarning>> {
    let earnings: Map<string, StockEarning> = new Map;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

    const options = <AxiosRequestConfig>({
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest'},
        data: qs.stringify({
            dateFrom: todayStr,
            dateTo: todayStr,
        }),
        url: 'https://ru.investing.com/earnings-calendar/Service/getCalendarFilteredData',
    });

    const {data: {data}} = await axios(options);
    

    const $ = cheerio.load(`<table>${data}</table>`);

    const stockElements = $('tr').toArray().slice(1);

    

    for (let stockElement of stockElements) {
        const name = $('.earnCalCompanyName', stockElement).text().trim();
        const ticker = $('a', stockElement).text().trim(); //showNameMatch && showNameMatch[2];
        const link = $('a', stockElement).prop('href');
        const showName = `${name}(${ticker})`;
        const linkWithoutQuery = link.includes('?') ? link.split('?')[0] : link;
        const epsFact = $('td:nth-child(3)', stockElement).text().replace(/[\/\s-]/g, '');
        const incomeFact = $('td:nth-child(4)', stockElement).text().replace(/[\/\s-]/g, '');;
        const epsForecast = $('td:nth-child(5)', stockElement).text().replace(/[\/\s-]/g, '');;
        const incomeForecast = $('td:nth-child(6)', stockElement).text().replace(/[\/\s-]/g, '');;
        const epsPositive = Boolean($('td:nth-child(3).greenFont', stockElement).text());
        const epsNegative = Boolean($('td:nth-child(3).redFont', stockElement).text());
        const incomePositive = Boolean($('td:nth-child(5).greenFont', stockElement).text());
        const incomeNegative = Boolean($('td:nth-child(5).redFont', stockElement).text());

        if (!ticker || !name) continue;

        earnings.set(ticker, {
            showName,
            name,
            ticker,
            earningShowed: Boolean(epsFact.match(/^[\d,]+$/)) && Boolean(incomeFact.match(/^[\d,A-Z]+$/)),
            link: `https://m.ru.investing.com${linkWithoutQuery}`,
            epsFact,
            epsForecast,
            incomeFact,
            incomeForecast,
            epsPositive,
            epsNegative,
            incomePositive,
            incomeNegative,
        });
    }

    return earnings;
}
export function earningValueToNumber(valueStr: string): number {
    const valueMatch = valueStr.match(/^(-?[\d]*,?[\d]*)([MB])?$/);

    if (!valueMatch) return NaN;

    let value = Number(valueMatch[1].replace(/,/g, '.'));
    const e10Letter = valueMatch[2];

    switch (e10Letter) {
        case 'B':
            value *= 1e+9;
            break;
        case 'M':
            value *= 1e+6;
            break;
        default:
            break;
    }

    return value;
};

export async function getEarningRelativeDifference(earning: StockEarning): Promise<StockEarningDiff> {
    const {data} = await axios.get(earning.link);

    const $ = cheerio.load(data);

    const prevEarningRowElement = $('tr.earningRow:nth-child(2)');
    const prevEarningCellElement = $('td:nth-child(3)', prevEarningRowElement);

    const prevEarningEpsText = $('p:first-child', prevEarningCellElement).text().trim();
    const prevEarningIncomeText = $('p:last-child', prevEarningCellElement).text().trim();

    const prevEarningEps = earningValueToNumber(prevEarningEpsText);
    const prevEarningIncome = earningValueToNumber(prevEarningIncomeText);
    const earningEps = earningValueToNumber(earning.epsFact);
    const earningIncome = earningValueToNumber(earning.incomeFact);
    const epsDif = (earningEps - prevEarningEps) / Math.abs(prevEarningEps);
    const incomeDif = (earningIncome - prevEarningIncome) / Math.abs(prevEarningIncome);
    const epsDifSign = epsDif < 0 ? -1 : 1;
    const incomeDifSign = incomeDif < 0 ? -1 : 1;

    return {
        epsDif,
        incomeDif,
        epsRate: (epsDif ? Math.ceil(Math.abs(epsDif) * 5) : 0) * epsDifSign,
        incomeRate: (incomeDif ? Math.ceil(Math.abs(incomeDif) * 5) : 0) * incomeDifSign,
    };
}
