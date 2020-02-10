import Scene from 'telegraf/scenes/base';

import User from '../../db/models/user';

export function registerScene(bot, stage) {
    const scene = new Scene('supportScene');

    stage.register(scene);

    bot.command('support', async (ctx) => {
        return await ctx.scene.enter(scene.id);
    });

    scene.enter(async (ctx) => await ctx.replyWithMarkdown('Пожалуйста введите сообщение'))

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
};
