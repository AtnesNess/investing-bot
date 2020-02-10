import dotenv from 'dotenv';
import request from 'axios';
import { expect } from 'chai';
import TelegramServer from 'telegram-test-api';

dotenv.config();

import { runBot, stopBot } from '../src/bot';
import { initDB } from '../src/db/index';


const timeout = ms => new Promise(res => setTimeout(res, ms))

describe('Telegram Bot', () => {
    const token = process.env.BOT_TOKEN;
    let serverConfig = {
        storeTimeout: 600,
        port: 9000
    };
    let server;
    let client;
    let adminClient;

    async function sendCommand(cmd, user = client) {
        let cmdObj = user.makeCommand(cmd);

        await user.sendCommand(cmdObj);
    }

    async function makeCallbackQuery(data, user = client) {
        const cbQueryObject = user.makeCallbackQuery(data);

        await user.sendCallback(cbQueryObject);
    }

    async function sendMessage(message, user = client) {
        let messageObj = user.makeMessage(message);

        await user.sendMessage(messageObj);
    }

    async function getUpdates() {
        const data = {token};
        const options = {
          url: `http://localhost:${serverConfig.port}/getUpdates`,
          method: 'POST',
          data,
        };
        await timeout(100);
        for (let i = 0; i < 10; i += 1) {
            const {data: update} = await request(options);

            if (update.ok && update.result.length) {
                return update;
            }
        }

        return {ok: false, reason: 'timeout'};
    }

    before(async () => {
        await initDB(process.env.TESTING_DATABASE_URL);

        server = new TelegramServer(serverConfig)

        const {webServer} = server;

        webServer.post('/bot:token/editMessageText', async (req, res) => {
            const response = await request.post(`http://localhost:${serverConfig.port}/bot${token}/sendMessage`, req.body);

            return res.status(response.status).send(response.data);
        });

        await server.start();

        await runBot({telegram: {
            apiRoot: `http://localhost:${serverConfig.port}`,
        }});

        client = server.getClient(token, {
            userId: 689,
            timeout: 1000,
            interval: 100,
            chatId: 12345,
            firstName: 'test',
            userName: 'usertest',
            type: 'private',
        });
    });

    it('Should start properly', async () => {
        await sendCommand('/start', client);

        let updates = await getUpdates();

        expect(updates.ok).to.equal(true);
        expect(updates.result[0].message.text).to.equal(
            `Привет!\n Я бот, который поможет вам инвестировать. Я буду присылать вам отчеты компаний в течение дня.`
        );
    });


    after(async function () {
        await stopBot();
        return server.stop();
    });
});
