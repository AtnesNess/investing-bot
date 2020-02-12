import Stage from 'telegraf/stage';
import Telegram from 'telegraf/telegram';
import Telegraf, { Extra } from 'telegraf';
import session from 'telegraf/session';
import path from 'path';

import User from '../db/models/user';
import { getDirectoryFiles } from '../utils/fs';

async function initBot(options) {
    const bot = new Telegraf(process.env.BOT_TOKEN, options);
    const telegram = new Telegram(process.env.BOT_TOKEN, options && options.telegram);

    const stage = new Stage();

    bot.use(session())

    bot.use(async (ctx, next, ...args) => {
        try {
            const {update} = ctx;
            const {
                message_id: messageId,
                chat: {id: chatId} = {},
                from: {is_bot: isBot} = {},
            } = update.message || update.callback_query && update.callback_query.message || {};

            if (!chatId) return;

            ctx.getUser = async () => {
                const [user, created] = await User.findOrCreate({
                    where: {
                        chatId,
                    },
                });

                if (created) {
                    console.log(`${chatId} has been added to db`);
                }

                return {...user.get({plain: true}), instance: user};
            }

            ctx.changeMessage = async (text, extra = Extra.markdown()) => {
                await ctx.telegram.editMessageText(chatId, messageId, messageId, text, extra)
            };

            ctx.changeMessageOrReply = async (text, extra = Extra.markdown()) => {
                if (!isBot) {
                    return await ctx.telegram.sendMessage(chatId || userId, text, extra);
                }

                await ctx.changeMessage(text, extra);
            };

            ctx.sendMessageToUsers = async (users, message, ctx) => {
                for (let user of users) {
                    try {
                        await ctx.telegram.sendMessage(user.chatId, message, {parse_mode: 'Markdown'});
                    } catch (e) {
                        console.error(e, user && user.chatId);
                    }
                }
            }

            ctx.getUserMentionLink = (user) => {
                return `[user_${user.chatId}](tg://user?id=${user.chatId})`;
            }

            if (!ctx.session.user) {
                ctx.session.user = await ctx.getUser();
            }

            await next();
        } catch (e) {
            const admins = await User.findAll({where: {isAdmin: true}});

            console.error(e);
            ctx.sendMessageToUsers(admins, `ERROR: ${JSON.stringify(e.message, null, 4)}`, bot);
        }
    });

    bot.use(stage.middleware());

    bot.catch(async (e) => {
        const admins = await User.findAll({where: {isAdmin: true}});

        console.error(e);
        ctx.sendMessageToUsers(admins, `ERROR: ${JSON.stringify(e.message, null, 4)}`, bot);
    });

    bot.start(async (ctx) => {
        await ctx.replyWithMarkdown(
            `Привет!\nЯ бот, который поможет вам инвестировать.\n` +
            `Я буду присылать вам отчеты компаний в течение дня.\n` +
            `По всем пожеланиям и предложениям обращайтесь в /support`
        );
    });

    const files = await getDirectoryFiles(path.join(__dirname, 'scenes'));

    for (let file of files) {
        const filename = path.join(__dirname, 'scenes', file);

        if (filename === __filename || filename.slice(-3) !== '.js') continue;;

        const {registerScene} = await require(filename);

        registerScene(bot, stage);
    }

    return [bot, telegram];
}

let bot = null;
let telegram = null;

export async function sendTgMessage(text, chatId) {
    if (!telegram) {
        console.log('MESSAGE SENT TO NOWHERE:', text);

        return;
    }

    try {
        await telegram.sendMessage(chatId, text, {parse_mode: 'Markdown'})
    } catch (e) {
        console.error(e);
    }
}

export async function runBot(options = {}) {
    [bot, telegram] = await initBot(options);

    await bot.startPolling();
};

export async function stopBot() {
    if (!bot) return;

    await bot.stop(() => {
        console.log('telegram bot stopped');
    });
};
