import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { parseEnv } from '../env.js';

export function registerCommandHandlers(bot: Bot) {
  // Comando principal - apenas redireciona para miniapp
  bot.command('start', async (ctx) => {
    const env = parseEnv();
    const fromId = ctx.from?.id;
    
    // Simple message with miniapp button
    const baseUrl = env.PUBLIC_WEBAPP_URL;
    const url = new URL(baseUrl);
    url.searchParams.set('telegram_user_id', String(fromId));
    url.searchParams.set('tma', '1');

    const keyboard = new InlineKeyboard()
      .webApp('🚀 Open Panorama Block', url.toString());
    
    await ctx.reply(
      '🎉 Welcome to Panorama Block!\n\n' +
      'Click the button below to access the miniapp and start trading:',
      { reply_markup: keyboard }
    );
  });
}
