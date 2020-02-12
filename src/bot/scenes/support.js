import Scene from 'telegraf/scenes/base';
import { Extra } from 'telegraf';

import User from '../../db/models/user';

export function registerScene(bot, stage) {
    const scene = new Scene('supportScene');

    stage.register(scene);

    bot.command('support', async (ctx) => {
        return await ctx.scene.enter(scene.id);
    });

    scene.enter(async (ctx) => await ctx.reply(
        'Пожалуйста введите сообщение',
        Extra
            .markdown()
            .markup(m => m.inlineKeyboard([
                m.callbackButton('Отмена', 'leave'),
            ]))
    ));

    scene.on('text', async (ctx) => {
        const {message: {text}} = ctx;
        const admins = await User.findAll({where: {isAdmin: true}});

        await ctx.sendMessageToUsers(
            admins,
            `Сообщение в support от ${ctx.getUserMentionLink(ctx.session.user)}:\n\n${text}`,
            ctx
        );

        await ctx.reply('Ваше сообщение отправлено, спасибо');

        return await ctx.scene.leave();
    });

    scene.action('leave', async (ctx) => {
        await ctx.scene.leave();

        return await ctx.changeMessageOrReply('Отправка сообщения в поддежрку отменена.')
    });
};
