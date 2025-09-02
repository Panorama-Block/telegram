import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { getRedisClient } from '../redis/client.js';
import { saveLink, getLink } from '../repos/links.js';
import { AuthClient } from '../clients/authClient.js';
import { SwapClient } from '../clients/swapClient.js';
import { getSwapState, setSwapState, clearSwapState, type SwapState } from '../repos/swapState.js';
import { saveSession } from '../repos/sessions.js';
import { decodeJwtExp } from '../clients/authClient.js';

export function registerCommandHandlers(bot: Bot) {
  bot.command('help', async (ctx) => {
    const helpText = `
🤖 *Zico Agent — Comandos*

/start — Menu inicial
/help — Mostrar esta ajuda
/settings — Configurações
/status — Status da conexão
/link — Vincular sua conta
/unlink — Desvincular sua conta
/swap — Iniciar cotação de swap (MVP)

Você também pode conversar diretamente comigo enviando mensagens de texto!

_Desenvolvido com ❤️ para a comunidade crypto_
    `.trim();

    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  });

  bot.command('settings', async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text('📊 Status', 'status')
      .text('ℹ️ Sobre', 'about')
      .row()
      .text('🔗 Link', 'link')
      .text('❌ Unlink', 'unlink');

    await ctx.reply('⚙️ *Configurações do Zico Agent*', {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  });

  bot.command('status', async (ctx) => {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    const redis = getRedisClient();
    let redisStatus = '❌ Desconectado';
    try { await redis.ping(); redisStatus = '✅ Conectado'; } catch {}
    
    const statusText = `
📈 *Status da Conexão*

Chat ID: \`${chatId}\`
User ID: \`${userId}\`
Bot: ✅ Online
Agents API: ${process.env['AGENTS_API_BASE'] ? '✅ Configurado' : '❌ Não configurado'}
Redis: ${redisStatus}

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

  // --- Link/Unlink via chat-only ---
  bot.command('link', async (ctx) => {
    const from = ctx.from;
    if (!from) return ctx.reply('Não consegui identificar o usuário.');
    const chatId = ctx.chat?.id ?? 0;
    const redis = getRedisClient();
    const auth = new AuthClient();
    try {
      let res;
      try {
        res = await auth.exchangeTelegram({ telegramUserId: from.id });
      } catch {
        res = await auth.registerTelegram({
          telegramUserId: from.id,
          profile: {
            username: from.username ?? null,
            language_code: (from as any).language_code ?? null,
            first_name: from.first_name ?? null,
            last_name: from.last_name ?? null,
          },
        });
      }
      await saveLink(redis, {
        telegram_user_id: from.id,
        zico_user_id: res.userId,
        username: from.username ?? null,
        language_code: (from as any).language_code ?? null,
        linked_at: Math.floor(Date.now() / 1000),
        status: 'linked',
      });
      // Persistir sessão com JWT para uso no Agents API
      const exp = decodeJwtExp(res.jwt) ?? Math.floor(Date.now() / 1000) + 3600;
      await saveSession(redis, {
        zico_user_id: res.userId,
        channel: 'telegram',
        chat_id: chatId,
        jwt: res.jwt,
        expires_at: exp,
      });
      await ctx.reply(`✅ Conta vinculada com sucesso! User: \`${res.userId}\``, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply('❌ Falha ao vincular conta. Tente novamente.');
    }
  });

  bot.command('unlink', async (ctx) => {
    const from = ctx.from;
    if (!from) return ctx.reply('Não consegui identificar o usuário.');
    const redis = getRedisClient();
    const link = await getLink(redis, from.id);
    if (!link) return ctx.reply('Nenhuma conta vinculada.');
    await saveLink(redis, { ...link, status: 'unlinked', linked_at: Math.floor(Date.now() / 1000) });
    await ctx.reply('✅ Conta desvinculada.');
  });

  // Atalhos pelos botões do /start e /settings
  bot.callbackQuery('link', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.api.sendMessage(ctx.chat!.id, '/link');
  });
  bot.callbackQuery('unlink', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.api.sendMessage(ctx.chat!.id, '/unlink');
  });

  // --- Swap Wizard (MVP chat-only) ---
  const CHAINS = ['ethereum', 'polygon', 'base'] as const;
  const TOKENS = ['ETH', 'USDC', 'WBTC'] as const;

  function chainKeyboard() {
    const kb = new InlineKeyboard();
    CHAINS.forEach((c, i) => { kb.text(c, `swap:chain:${c}`); if (i % 2 === 1) kb.row(); });
    kb.row().text('❌ Cancelar', 'swap:cancel');
    return kb;
  }
  function tokenKeyboard(kind: 'in'|'out') {
    const kb = new InlineKeyboard();
    TOKENS.forEach((t, i) => { kb.text(t, `swap:token_${kind}:${t}`); if (i % 3 === 2) kb.row(); });
    kb.row().text('❌ Cancelar', 'swap:cancel');
    return kb;
  }

  bot.command('swap', async (ctx) => {
    const chatId = ctx.chat?.id!;
    const redis = getRedisClient();
    await setSwapState(redis, chatId, { step: 'choose_chain' });
    await ctx.reply('🔄 Vamos cotar um swap. Escolha a rede:', { reply_markup: chainKeyboard() });
  });

  bot.callbackQuery('swap:start', async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat?.id!;
    const redis = getRedisClient();
    await setSwapState(redis, chatId, { step: 'choose_chain' });
    await ctx.reply('🔄 Vamos cotar um swap. Escolha a rede:', { reply_markup: chainKeyboard() });
  });

  // Interceptar mensagem de amount quando aguardando
  bot.on('message:text', async (ctx, next) => {
    const chatId = ctx.chat?.id!;
    const redis = getRedisClient();
    const state = await getSwapState(redis, chatId);
    if (!state || state.step !== 'enter_amount') return next();
    const text = (ctx.message?.text ?? '').trim();
    const amount = Number(text.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      await ctx.reply('Informe um valor numérico positivo para a quantia.');
      return; // não chama next() para evitar envio ao agente
    }
    const newState: SwapState = { ...state, step: 'confirm_quote', amount } as SwapState;
    await setSwapState(redis, chatId, newState);

    // Tentar pedir quote (se configurado)
    let summary = '';
    try {
      const swap = new SwapClient();
      const q = await swap.quote({
        chain: newState.chain!,
        fromToken: newState.token_in!,
        toToken: newState.token_out!,
        amount: newState.amount!,
      });
      summary = `Preço estimado: ${q?.price ?? '—'}\nTaxa: ${q?.fee ?? '—'}`;
    } catch (e) {
      summary = 'Não foi possível obter a cotação agora. (verifique SWAP_API_BASE)';
    }

    const kb = new InlineKeyboard()
      .text('✅ Confirmar', 'swap:confirm')
      .text('❌ Cancelar', 'swap:cancel');
    await ctx.reply(
      `Resumo do swap:\n` +
      `• Rede: ${newState.chain}\n` +
      `• De: ${newState.token_in}\n` +
      `• Para: ${newState.token_out}\n` +
      `• Quantia: ${newState.amount}\n` +
      `${summary ? `\n${summary}` : ''}`,
      { reply_markup: kb },
    );
    return; // interceptado, não passa ao agente
  });

  bot.callbackQuery(/swap:(.+)/, async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.chat?.id!;
    const redis = getRedisClient();
    const state = (await getSwapState(redis, chatId)) ?? { step: 'choose_chain' } as SwapState;
    const [, action, value] = data.split(':');

    if (action === 'cancel') {
      await clearSwapState(redis, chatId);
      await ctx.answerCallbackQuery('Cancelado.');
      await ctx.editMessageReplyMarkup();
      await ctx.reply('Operação cancelada.');
      return;
    }

    if (action === 'chain') {
      await ctx.answerCallbackQuery();
      const nextState: SwapState = { ...state, step: 'choose_token_in', chain: value } as SwapState;
      await setSwapState(redis, chatId, nextState);
      await ctx.reply(`Rede selecionada: ${value}. Escolha o token de entrada:`, { reply_markup: tokenKeyboard('in') });
      return;
    }
    if (action === 'token_in') {
      await ctx.answerCallbackQuery();
      const nextState: SwapState = { ...state, step: 'choose_token_out', token_in: value } as SwapState;
      await setSwapState(redis, chatId, nextState);
      await ctx.reply(`Token de entrada: ${value}. Agora selecione o token de saída:`, { reply_markup: tokenKeyboard('out') });
      return;
    }
    if (action === 'token_out') {
      await ctx.answerCallbackQuery();
      const nextState: SwapState = { ...state, step: 'enter_amount', token_out: value } as SwapState;
      await setSwapState(redis, chatId, nextState);
      await ctx.reply(`Token de saída: ${value}. Informe a quantia a trocar (ex.: 0.1):`);
      return;
    }
    if (action === 'confirm') {
      await ctx.answerCallbackQuery('Cotação confirmada.');
      // MVP: só confirma; execução virá depois.
      await ctx.reply('✅ Cotação confirmada! Execução será adicionada em breve.');
      await clearSwapState(redis, chatId);
      return;
    }

    await ctx.answerCallbackQuery();
  });
}
