import dotenv from 'dotenv';
import isEqual from 'lodash/isEqual'
import http from 'http';

dotenv.config();

import { runBot, sendTgMessage } from './bot';
import { initDB } from './db';
import Stock from './db/models/stock';
import User from './db/models/user';
import { collectStockEarnings, StockEarning } from './utils/stocks-collector';

const INTERVAL_MS = 1000 * 60 * 5;

async function initServer() {
    await initDB(<string>process.env.DATABASE_URL);

    if (process.env.NODE_ENV === 'production') {
        await runBot();
    }

    setInterval(checkEarningUpdates, INTERVAL_MS);

    http.createServer((_, res) => {
        res.writeHead(200);
        res.end();
    }).listen(process.env.PORT);
}

let prevStockEarnings: Map<string | null, StockEarning>;
async function checkEarningUpdates() {
    const stockEarnings = await collectStockEarnings();

    if (!prevStockEarnings) {
        prevStockEarnings = stockEarnings;

        return;
    }

    const userChatIds = User.findAll().map((user: User) => user.get('chatId'));

    const stocks = await Stock.findAll({
        where: {
            ticker: Array.from(stockEarnings.keys())
        }
    });

    for (let stock of stocks) {
        const ticker = stock.get('ticker');
        const earning = stockEarnings.get(ticker);

        if (!earning) continue;

        if (!isEqual(earning, prevStockEarnings.get(ticker))) {
            for (let chatId of userChatIds) {
                await sendTgMessage(
                    `📊[${earning.name}](${earning})📊\n` +
                    `EPS: ${earning.epsForecast} / ${earning.epsFact} ` +
                    `${earning.epsPositive ? '📈' : ''}${earning.epsNegative ? '📉' : ''}\n` +
                    `Income: ${earning.incomeForecast} / ${earning.incomeFact} ` +
                    `${earning.incomePositive ? '📈' : ''}${earning.incomeNegative ? '📉' : ''}`,
                    chatId
                )
            }
        }
    }

    prevStockEarnings = stockEarnings;
}

initServer();
