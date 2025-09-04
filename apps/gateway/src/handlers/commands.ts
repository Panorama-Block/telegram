import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { getRedisClient } from '../redis/client.js';
import { saveLink, getLink } from '../repos/links.js';
import { AuthClient } from '../clients/authClient.js';
import { SwapClient } from '../clients/swapClient.js';
import { getSwapState, setSwapState, clearSwapState, type SwapState } from '../repos/swapState.js';
import { saveSession } from '../repos/sessions.js';
import { decodeJwtExp } from '../clients/authClient.js';
import { getHelpText, getLinkSuccessText, getTutorialMessages, getOnboardingPageById, buildOnboardingKeyboard } from '../utils/onboarding.js';
import { parseEnv } from '../env.js';

export function registerCommandHandlers(bot: Bot) {
  bot.command('help', async (ctx) => {
    await ctx.reply(getHelpText());
  });

  bot.command('settings', async (ctx) => {
    const env = parseEnv();
    const kb = new InlineKeyboard()
      .text('📊 Status', 'status')
      .text('ℹ️ About', 'about')
      .row()
      .text('❌ Unlink', 'unlink');
    // If webapp configured, hint via help
    if (!env.PUBLIC_WEBAPP_URL) kb.text('🔗 Link', 'link');

    await ctx.reply('⚙️ Zico Agent — Settings', {
      reply_markup: kb,
    });
  });

  bot.command('status', async (ctx) => {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    const redis = getRedisClient();
    let redisStatus = '❌ Disconnected';
    try { await redis.ping(); redisStatus = '✅ Conectado'; } catch {}
    if (redisStatus === '✅ Conectado') redisStatus = '✅ Connected';

    const statusText = `
📈 Status

Chat ID: ${chatId}
User ID: ${userId}
Bot: ✅ Online
Agents API: ${process.env['AGENTS_API_BASE'] ? '✅ Configured' : '❌ Not configured'}
Redis: ${redisStatus}

Updated: ${new Date().toISOString()}
    `.trim();

    await ctx.reply(statusText);
  });

  // Callback queries dos inline keyboards
  bot.callbackQuery('status', async (ctx) => {
    await ctx.answerCallbackQuery('Checking status...');
    await ctx.api.sendMessage(ctx.chat!.id, '/status');
  });

  bot.callbackQuery('about', async (ctx) => {
    await ctx.answerCallbackQuery();
    const aboutText = `
ℹ️ About Zico Agent

Version: 1.0.0
Telegram Gateway + Mini App
Agents API integration

Docs and support coming soon.
    `.trim();

    await ctx.reply(aboutText);
  });

  bot.callbackQuery('help', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(getHelpText());
  });

  bot.callbackQuery('start_chat', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('💬 Just type your question to start chatting.');
  });

  bot.callbackQuery('portfolio', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('📊 Portfolio is coming soon.');
  });

  // Onboarding pages (carousel)
  bot.callbackQuery('onboard:learn', async (ctx) => {
    await ctx.answerCallbackQuery();
    const env = parseEnv();
    const data = getOnboardingPageById(1)!;
    try {
      await ctx.editMessageText(`📘 ${data.page.title}\n\n${data.page.text}`, { reply_markup: buildOnboardingKeyboard(env, data.page.id) });
    } catch {
      await ctx.reply(`📘 ${data.page.title}\n\n${data.page.text}`, { reply_markup: buildOnboardingKeyboard(env, data.page.id) });
    }
  });
  bot.callbackQuery(/onboard:page:(\d+)/, async (ctx) => {
    const env = parseEnv();
    const m = ctx.callbackQuery.data.match(/onboard:page:(\d+)/);
    const id = m ? Number(m[1]) : 1;
    const data = getOnboardingPageById(id);
    await ctx.answerCallbackQuery();
    if (!data) return;
    try {
      await ctx.editMessageText(`📘 ${data.page.title}\n\n${data.page.text}`, { reply_markup: buildOnboardingKeyboard(env, data.page.id) });
    } catch {
      await ctx.reply(`📘 ${data.page.title}\n\n${data.page.text}`, { reply_markup: buildOnboardingKeyboard(env, data.page.id) });
    }
  });
  bot.callbackQuery('onboard:menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.api.sendMessage(ctx.chat!.id, '/start');
  });

  // Ignore no-op buttons (for disabled nav)
  bot.callbackQuery('noop', async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  // --- Link/Unlink via chat-only ---
  bot.command('link', async (ctx) => {
    const from = ctx.from;
    if (!from) return ctx.reply('Could not identify the user.');
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
      await ctx.reply(getLinkSuccessText(res.userId), { parse_mode: 'Markdown' });
      // Tutorial messages
      for (const msg of getTutorialMessages()) {
        await ctx.reply(msg);
      }
    } catch (err) {
      await ctx.reply('❌ Failed to link account. Please try again.');
    }
  });

  bot.command('unlink', async (ctx) => {
    const from = ctx.from;
    if (!from) return ctx.reply('Could not identify the user.');
    const redis = getRedisClient();
    const link = await getLink(redis, from.id);
    if (!link) return ctx.reply('No linked account found.');
    await saveLink(redis, { ...link, status: 'unlinked', linked_at: Math.floor(Date.now() / 1000) });
    await ctx.reply('✅ Account unlinked.');
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
    await ctx.reply('🔄 Let’s get a swap quote. Choose the chain:', { reply_markup: chainKeyboard() });
  });

  bot.callbackQuery('swap:start', async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat?.id!;
    const redis = getRedisClient();
    await setSwapState(redis, chatId, { step: 'choose_chain' });
    await ctx.reply('🔄 Let’s get a swap quote. Choose the chain:', { reply_markup: chainKeyboard() });
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
      await ctx.reply('Please enter a positive numeric amount.');
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
      summary = `Estimated price: ${q?.price ?? '—'}\nFee: ${q?.fee ?? '—'}`;
    } catch (e) {
      summary = 'Could not fetch quote now. (check SWAP_API_BASE)';
    }

    const kb = new InlineKeyboard()
      .text('✅ Confirmar', 'swap:confirm')
      .text('❌ Cancelar', 'swap:cancel');
    await ctx.reply(
      `Swap summary:\n` +
      `• Chain: ${newState.chain}\n` +
      `• From: ${newState.token_in}\n` +
      `• To: ${newState.token_out}\n` +
      `• Amount: ${newState.amount}\n` +
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
      await ctx.answerCallbackQuery('Canceled.');
      await ctx.editMessageReplyMarkup();
      await ctx.reply('Operation canceled.');
      return;
    }

    if (action === 'chain') {
      await ctx.answerCallbackQuery();
      const nextState: SwapState = { ...state, step: 'choose_token_in', chain: value } as SwapState;
      await setSwapState(redis, chatId, nextState);
      await ctx.reply(`Selected chain: ${value}. Choose the input token:`, { reply_markup: tokenKeyboard('in') });
      return;
    }
    if (action === 'token_in') {
      await ctx.answerCallbackQuery();
      const nextState: SwapState = { ...state, step: 'choose_token_out', token_in: value } as SwapState;
      await setSwapState(redis, chatId, nextState);
      await ctx.reply(`Input token: ${value}. Now choose the output token:`, { reply_markup: tokenKeyboard('out') });
      return;
    }
    if (action === 'token_out') {
      await ctx.answerCallbackQuery();
      const nextState: SwapState = { ...state, step: 'enter_amount', token_out: value } as SwapState;
      await setSwapState(redis, chatId, nextState);
      await ctx.reply(`Output token: ${value}. Enter the amount to swap (e.g., 0.1):`);
      return;
    }
    if (action === 'confirm') {
      await ctx.answerCallbackQuery('Quote confirmed.');
      // MVP: confirm only; execution to be added later.
      await ctx.reply('✅ Quote confirmed! Execution will be added soon.');
      await clearSwapState(redis, chatId);
      return;
    }

    await ctx.answerCallbackQuery();
  });
}
