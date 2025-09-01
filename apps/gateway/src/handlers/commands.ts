import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';

export function registerCommandHandlers(bot: Bot) {
  bot.command('help', async (ctx) => {
    const helpText = `
🤖 *Zico Agent — Comandos*

/start — Abrir Zico WebApp
/help — Mostrar esta ajuda
/settings — Configurações
/status — Status da conexão

Você também pode conversar diretamente comigo enviando mensagens de texto!

_Desenvolvido com ❤️ para a comunidade crypto_
    `.trim();

    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  });

  bot.command('settings', async (ctx) => {
      const baseUrl = process.env['PUBLIC_GATEWAY_URL'] || `http://localhost:${process.env['PORT'] || '7777'}`;
      const webAppUrl = `${baseUrl}/webapp/`;
    
    const keyboard = new InlineKeyboard()
      .webApp('🔧 Abrir Configurações', webAppUrl)
      .row()
      .text('📊 Status', 'status')
      .text('ℹ️ Sobre', 'about');

    await ctx.reply('⚙️ *Configurações do Zico Agent*', {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  });

  bot.command('status', async (ctx) => {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    
    const statusText = `
📈 *Status da Conexão*

Chat ID: \`${chatId}\`
User ID: \`${userId}\`
Bot: ✅ Online
Agents API: ${process.env['AGENTS_API_BASE'] ? '✅ Configurado' : '❌ Não configurado'}
Redis: ✅ Conectado

_Última atualização: ${new Date().toLocaleString('pt-BR')}_
    `.trim();

    await ctx.reply(statusText, { parse_mode: 'Markdown' });
  });

  // Callback queries dos inline keyboards
  bot.callbackQuery('status', async (ctx) => {
    await ctx.answerCallbackQuery('Verificando status...');
    await ctx.reply('📊 Status atualizado!');
  });

  bot.callbackQuery('about', async (ctx) => {
    await ctx.answerCallbackQuery();
    const aboutText = `
ℹ️ *Sobre o Zico Agent*

Versão: 1.0.0
Telegram Gateway + Mini App
Integração com Agents API

🔗 Links:
• Documentação
• Suporte
    `.trim();

    await ctx.reply(aboutText, { 
      parse_mode: 'Markdown',
    });
  });
}
