import Scene from 'telegraf/scenes/base';
import { Extra } from 'telegraf';

import User from '../../db/models/user';

export function registerScene(bot, stage) {
    const channelSubScene = new Scene('adminChannelSubScene');
    const enableAdminSubScene = new Scene('enableAdminSubScene');
    const disableAdminSubScene = new Scene('disableAdminSubScene');

    stage.register(enableAdminSubScene);
    stage.register(disableAdminSubScene);
    stage.register(channelSubScene);

    const mainController = async (ctx) => {
        const user = await ctx.getUser();

        if (!user.isAdmin) {
            return;
        }

        await ctx.changeMessageOrReply(
            'Пожалуйста, выберите действие',
            Extra
                .markdown()
                .markup((m) => m.inlineKeyboard([
                    m.callbackButton('Выдать права', 'enableadmin'),
                    m.callbackButton('Забрать права', 'disableadmin'),
                    m.callbackButton('Отправить сообщение всем', 'channel'),
                    m.callbackButton('Выгрузить csv профилей', 'csv'),
                ], {wrap: () => true})),
        );
    }

    bot.command('admin', mainController);

    bot.action('channel', async (ctx) => {
        await ctx.scene.enter(channelSubScene.id);

        await ctx.changeMessageOrReply(
            'Пожалуйста введите сообщение',
            Extra
                .markdown()
                .markup(m => m.inlineKeyboard([
                    m.callbackButton('Отмена', 'leave'),
                ]))
        );
    });

    channelSubScene.on('message', async (ctx) => {
        const {message: {text}} = ctx;

        const user = await ctx.getUser();

        if (!user.isAdmin) {
            return;
        }

        await ctx.sendMessageToUsers(
            await User.findAll(),
            text,
            ctx
        );

        await ctx.scene.leave();
    });

    channelSubScene.action('leave', async (ctx) => {
        await ctx.scene.leave();

        return await mainController(ctx);
    });

    bot.action('enableadmin', async (ctx) => {
        await ctx.scene.enter(enableAdminSubScene.id);

        await ctx.changeMessageOrReply(
            'Пожалуйста введите ID пользователя\n\nЭтот id можно получить с помощью @myidbot',
            Extra
                .markdown()
                .markup(m => m.inlineKeyboard([
                    m.callbackButton('Отмена', 'leave'),
                ]))
        );
    });

    enableAdminSubScene.on('message', async (ctx) => {
        const me = await ctx.getUser();

        if (!me.isAdmin) {
            return;
        }

        const {message: {text}} = ctx;

        const id = Number(text);

        if (isNaN(id)) {
            return await ctx.reply(
                'ID пользователя должен быть числом',
                Extra
                    .markdown()
                    .markup(m => m.inlineKeyboard([
                        m.callbackButton('Отмена', 'leave'),
                    ]))
            );
        }

        const user = await User.findOne({where: {chatId: id}});

        if (!user) {
            return await ctx.reply(
                'Пользователь с таким ID не найден, попробуйте снова',
                Extra
                    .markdown()
                    .markup(m => m.inlineKeyboard([
                        m.callbackButton('Отмена', 'leave'),
                    ]))
            );
        }

        await user.update({
            isAdmin: true
        });

        await ctx.scene.leave();
        return await ctx.reply(`Пользователь ${ctx.getUserMentionLink(user)} теперь администратор`, Extra.markdown());
    });

    enableAdminSubScene.action('leave', async (ctx) => {
        await ctx.scene.leave();

        return await mainController(ctx);
    });

    bot.action('disableadmin', async (ctx) => {
        await ctx.scene.enter(disableAdminSubScene.id);

        await ctx.changeMessageOrReply(
            'Пожалуйста введите ID пользователя\n\nЭтот id можно получить с помощью @myidbot',
            Extra
                .markdown()
                .markup(m => m.inlineKeyboard([
                    m.callbackButton('Отмена', 'leave'),
                ]))
        );
    });

    disableAdminSubScene.on('message', async (ctx) => {
        const {message: {text}} = ctx;

        const me = await ctx.getUser();

        if (!me.isAdmin) {
            return;
        }

        const id = Number(text);

        if (isNaN(id)) {
            return await ctx.reply(
                'ID пользователя должен быть числом',
                Extra
                    .markdown()
                    .markup(m => m.inlineKeyboard([
                        m.callbackButton('Отмена', 'leave'),
                    ]))
            );
        }

        const user = await User.findOne({where: {chatId: id}});

        if (!user) {
            return await ctx.reply(
                'Пользователь с таким ID не найден, попробуйте снова',
                Extra
                    .markdown()
                    .markup(m => m.inlineKeyboard([
                        m.callbackButton('Отмена', 'leave'),
                    ]))
            );
        }

        await user.update({
            isAdmin: false
        });

        await ctx.scene.leave();
        return await ctx.reply(`Пользователь ${ctx.getUserMentionLink(user)} теперь не администратор`, Extra.markdown());
    });

    disableAdminSubScene.action('leave', async (ctx) => {
        await ctx.scene.leave();

        return await mainController(ctx);
    });
};
