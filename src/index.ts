import axios from 'axios';
import dotenv from 'dotenv';
import isEqual from 'lodash/isEqual'
import range from 'lodash/range'
import http from 'http';
import moment from 'moment';

dotenv.config();

import { runBot, sendTgMessage } from './bot';
import { initDB, sequelize }from './db';
import Stock from './db/models/stock';
import User from './db/models/user';
import {
    collectStockEarnings,
    getEarningRelativeDifference,
    StockEarning,
    StockEarningDiff
} from './utils/stocks-collector';

const INTERVAL_MS = 1000 * 60 * 2;

async function initServer() {
    await initDB();

    if (process.env.NODE_ENV === 'production') {
        await runBot();
    }

    checkEarningUpdates();
    setInterval(checkEarningUpdates, INTERVAL_MS);

    if (process.env.ICBC) {
        checkICBC();
        setInterval(checkICBC, INTERVAL_MS);
    }

    http.createServer((_, res) => {
        res.writeHead(200);
        res.end();
    }).listen(process.env.PORT);
}

const ICBC_ENDPOINTS = {
    'Downtown': 'qmaticwebbooking/rest/schedule/branches/ea01f5e5ba07af767a739c1d66730bef9663a1a307b84e4674cffcd93caad1b5/dates;servicePublicId=da8488da9b5df26d32ca58c6d6a7973bedd5d98ad052d62b468d3b04b080ea25;customSlotLength=40',
    'Vancouver Commercial Drive': 'qmaticwebbooking/rest/schedule/branches/0ab916058f4b572eae9dfbdf0693fa9f2f97a34a19bee6c68d09cb28b78ac3c3/dates;servicePublicId=da8488da9b5df26d32ca58c6d6a7973bedd5d98ad052d62b468d3b04b080ea25;customSlotLength=40',
    'Burnaby Lougheed':  'qmaticwebbooking/rest/schedule/branches/53851ce8b410de56e26a0f0d2eda5a3e8d8cf4e05cc1b21af70121f53ef53b5d/dates;servicePublicId=da8488da9b5df26d32ca58c6d6a7973bedd5d98ad052d62b468d3b04b080ea25;customSlotLength=40',
    'Burnaby Metrotown': 'qmaticwebbooking/rest/schedule/branches/e879cd70e75ba8db2fb03b3d2060bf7c1c74e5d879ebea3cc585fd2d707a278d/dates;servicePublicId=da8488da9b5df26d32ca58c6d6a7973bedd5d98ad052d62b468d3b04b080ea25;customSlotLength=40',
}
async function checkICBC() {
    for (let [place, endpoint] of Object.entries(ICBC_ENDPOINTS)) {
        try {
            const response = await axios.get(`http://35.183.114.238:6898/icbc?path=${encodeURIComponent(endpoint)}`);
    
            const data = response.data;
            
            const now = new Date();
    
            const adminChatIds = await User.findAll({where: {isAdmin: true}}).map((user: User) => user.get('chatId'));
            const dates: Date[] = data.map(({date}: {date: string}) => new Date(`${date} GMT-0700`));
    
            for (let date of dates) {
                if (date > moment(now).add(14, 'd').toDate()) {
                    break;
                }
    
                if (process.env.ICBC_SKIP_TODAY && date.getDate() === now.getDate() && date.getMonth() === now.getMonth()) {
                    continue;
                }
        
                for (let chatId of adminChatIds) {
                    await sendTgMessage(
                        `Available slots for ${place} on ${date}: https://onlinebusiness.icbc.com/qmaticwebbooking/#/`,
                        chatId,
                    );
                }
            }
            await new Promise(resolve => {setTimeout(resolve, 1000)});
        } catch(e) {
            console.error(e);
    
            const adminChatIds = await User.findAll({where: {isAdmin: true}}).map((user: User) => user.get('chatId'));
    
            for (let chatId of adminChatIds) {
                await sendTgMessage(
                    JSON.stringify(e.message, null, 4),
                    chatId,
                );
            }
        }
    }   
}

let prevStockEarnings: Map<string | null, StockEarning>;
async function checkEarningUpdates() {
    const stockEarnings = await collectStockEarnings();
    const userChatIds = await User.findAll().map((user: User) => user.get('chatId'));

    const stocks = await Stock.findAll({
        where: {
            ticker: Array.from(stockEarnings.keys())
        }
    });

    for (let stock of stocks) {
        try {
            const ticker = stock.get('ticker');
            const name = stock.get('name');
            const earning = stockEarnings.get(ticker);
            const prevEarning = prevStockEarnings && prevStockEarnings.get(ticker);
            const lastEarningDate = stock.get('lastEarningDate');
            let earningDif: StockEarningDiff = {epsDif: 0, incomeDif: 0, epsRate: 0, incomeRate: 0};

            if (!earning) continue;
            if (isEqual(earning, prevEarning)) continue;

            const [[{similarity}]] = await sequelize.query(
                `SELECT similarity from similarity(` +
                    `E'${name.replace(/'/g,'\\\'')}',` +
                    `E'${earning.name.replace(/'/g,'\\\'')}'` +
                `);`
            );

            if (Number(similarity) < 0.3) continue;

            const today = new Date();

            today.setHours(0, 0, 0, 0);

            if (lastEarningDate && lastEarningDate >= today) continue;
            if (!earning.earningShowed) continue;

            await stock.update({
                lastEarningDate: today
            });

            earningDif = await getEarningRelativeDifference(earning);

            for (let chatId of userChatIds) {
                await sendTgMessage(
                    `📊[${earning.showName}](${earning.link})📊\n` +
                    `EPS: ${earning.epsFact} / ${earning.epsForecast} ` +
                    `${earning.epsPositive ? '✅' : ''}${earning.epsNegative ? '❌' : ''} ` +
                    `${range(Math.min(Math.abs(earningDif.epsRate), 10))
                        .map(() => earningDif.epsRate > 0 ? '⬆️' : '⬇️').join('')}\n` +
                    `Income: ${earning.incomeFact} / ${earning.incomeForecast} ` +
                    `${earning.incomePositive ? '✅' : ''}${earning.incomeNegative ? '❌' : ''} ` +
                    `${range(Math.min(Math.abs(earningDif.incomeRate), 10))
                        .map(() => earningDif.incomeRate > 0 ? '⬆️' : '⬇️').join('')}\n`,
                    chatId,
                    {disable_web_page_preview: true}
                )
            }
        } catch(e) {
            console.error(e);

            const adminChatIds = await User.findAll({where: {isAdmin: true}}).map((user: User) => user.get('chatId'));

            for (let chatId of adminChatIds) {
                await sendTgMessage(
                    JSON.stringify(e.message, null, 4),
                    chatId,
                );
            }
        }
    }

    prevStockEarnings = stockEarnings;
}

initServer();
