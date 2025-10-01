import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { getRedisClient } from '../redis/client.js';
import { saveLink, getLink } from '../repos/links.js';
import { getSwapState, setSwapState, clearSwapState, type SwapState } from '../repos/swapState.js';
import { getSession, saveSession } from '../repos/sessions.js';
import { getHelpText, getLinkSuccessText, getTutorialMessages, getOnboardingPageById, buildOnboardingKeyboard, buildStartMenu, getLongWelcomeText, buildPreLoginMenu, buildFeaturesMenu, getFeatureIntroText } from '../utils/onboarding.js';
import { parseEnv } from '../env.js';
import { addTracked, removeTracked, listTracked } from '../repos/tracking.js';
import { quoteService } from '../services/quoteService.js';

export function registerCommandHandlers(bot: Bot) {
  async function showStart(ctx: any) {
    const env = parseEnv();
    const fromId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    if (fromId && chatId) {
      const redis = getRedisClient();
      try { await redis.ping(); } catch {}
      try {
        const { saveLastChat } = await import('../repos/lastChat.js');
        await saveLastChat(redis, fromId, chatId);
      } catch {}
      const link = await getLink(redis, fromId);
      console.log('🔍 [START] Checking link for user:', fromId, 'Link found:', link);
      if (link && link.status === 'linked') {
        console.log('✅ [START] User is already linked, showing features menu');
        await ctx.reply('👋 Welcome back! Choose a feature to begin:', { reply_markup: buildFeaturesMenu() });
        return;
      }
      console.log('❌ [START] User not linked, showing pre-login menu');
    }
    await ctx.reply(getLongWelcomeText(), { reply_markup: buildPreLoginMenu(env) });
  }
  async function linkAccount(ctx: any, opts: { sendTutorial: boolean } = { sendTutorial: true }) {
    const from = ctx.from;
    if (!from) {
      await ctx.reply('Could not identify the user.');
      return false;
    }
    const chatId = ctx.chat?.id ?? 0;
    const redis = getRedisClient();
    const env = parseEnv();
    try {
      if (!env.AUTH_API_BASE) {
        const userIdStable = `local:tg:${from.id}`;
        await saveLink(redis, {
          telegram_user_id: from.id,
          zico_user_id: userIdStable,
          username: from.username ?? null,
          language_code: (from as any).language_code ?? null,
          linked_at: Math.floor(Date.now() / 1000),
          status: 'linked',
        });
        await saveSession(redis, {
          zico_user_id: userIdStable,
          channel: 'telegram',
          chat_id: chatId,
          jwt: 'local',
          expires_at: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
        });
        await ctx.reply(getLinkSuccessText(userIdStable), { parse_mode: 'Markdown' });
      } else {
        // Para autenticação real, redirecionar para o miniapp
        // Em desenvolvimento, usar localhost; em produção, usar PUBLIC_GATEWAY_URL
        const baseUrl = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:7778' 
          : env.PUBLIC_GATEWAY_URL; 
        const miniappUrl = `${baseUrl}miniapp/?telegram_user_id=${from.id}&page=auth`;
        await ctx.reply(
          `🔐 Para conectar sua carteira e autenticar:\n\n` +
          `1. Clique no botão abaixo para abrir o miniapp\n` +
          `2. Conecte sua MetaMask no miniapp\n` +
          `3. Faça a autenticação\n` +
          `4. Volte para o bot\n\n` +
          `O miniapp será aberto automaticamente!`,
          { 
            reply_markup: {
              inline_keyboard: [[
                {
                  text: "🔗 Abrir Miniapp",
                  web_app: { url: miniappUrl }
                }
              ]]
            }
          }
        );
        return false;
      }
      if (opts.sendTutorial) {
        for (const msg of getTutorialMessages()) {
          await ctx.reply(msg);
        }
      }
      return true;
    } catch (err) {
      await ctx.reply('❌ Failed to link account. Please try again.');
      return false;
    }
  }
  // /start should always deliver onboarding and persist last chat
  bot.command('start', async (ctx) => { await showStart(ctx); });
  bot.command('help', async (ctx) => {
    await ctx.reply(getHelpText());
  });

  bot.command('settings', async (ctx) => {
    const kb = new InlineKeyboard()
      .text('📊 Status', 'status')
      .text('ℹ️ About', 'about')
      .row()
      .text('🔗 Link', 'link')
      .text('❌ Unlink', 'unlink');

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
Auth API: ${process.env['AUTH_API_BASE'] ? '✅ Configured' : '❌ Not configured'}
Agents API: ${process.env['AGENTS_API_BASE'] ? '✅ Configured' : '❌ Not configured'}
Redis: ${redisStatus}

Updated: ${new Date().toISOString()}
    `.trim();

    await ctx.reply(statusText);
  });

  // Callback queries dos inline keyboards
  bot.callbackQuery('status', async (ctx) => {
    await ctx.answerCallbackQuery('Checking status...');
    // Inline status (avoid sending /status text)
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    const redis = getRedisClient();
    let redisStatus = '❌ Disconnected';
    try { await redis.ping(); redisStatus = '✅ Connected'; } catch {}
    const statusText = `\n📈 Status\n\nChat ID: ${chatId}\nUser ID: ${userId}\nBot: ✅ Online\nAuth API: ${process.env['AUTH_API_BASE'] ? '✅ Configured' : '❌ Not configured'}\nAgents API: ${process.env['AGENTS_API_BASE'] ? '✅ Configured' : '❌ Not configured'}\nRedis: ${redisStatus}\n\nUpdated: ${new Date().toISOString()}`.trim();
    await ctx.reply(statusText);
  });

  bot.callbackQuery('about', async (ctx) => {
    await ctx.answerCallbackQuery();
    const aboutText = `
ℹ️ About Zico Agent

Version: 1.0.0
 Telegram Gateway (chat-only linking)
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

  // portfolio removed; using wallet tracking instead

  // Onboarding pages (carousel)
  bot.callbackQuery('onboard:learn', async (ctx) => {
    await ctx.answerCallbackQuery();
    const data = getOnboardingPageById(1)!;
    try {
      await ctx.editMessageText(`📘 ${data.page.title}\n\n${data.page.text}`, { reply_markup: buildOnboardingKeyboard({} as any, data.page.id) });
    } catch {
      await ctx.reply(`📘 ${data.page.title}\n\n${data.page.text}`, { reply_markup: buildOnboardingKeyboard({} as any, data.page.id) });
    }
  });
  bot.callbackQuery(/onboard:page:(\d+)/, async (ctx) => {
    const m = ctx.callbackQuery.data.match(/onboard:page:(\d+)/);
    const id = m ? Number(m[1]) : 1;
    const data = getOnboardingPageById(id);
    await ctx.answerCallbackQuery();
    if (!data) return;
    try {
      await ctx.editMessageText(`📘 ${data.page.title}\n\n${data.page.text}`, { reply_markup: buildOnboardingKeyboard({} as any, data.page.id) });
    } catch {
      await ctx.reply(`📘 ${data.page.title}\n\n${data.page.text}`, { reply_markup: buildOnboardingKeyboard({} as any, data.page.id) });
    }
  });
  bot.callbackQuery('onboard:menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    await showStart(ctx);
  });

  // Ignore no-op buttons (for disabled nav)
  bot.callbackQuery('noop', async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  // Start Now (login then show features + help)
  bot.callbackQuery('start_now', async (ctx) => {
    await ctx.answerCallbackQuery();
    const ok = await linkAccount(ctx, { sendTutorial: false });
    if (ok) {
      await ctx.reply('You are all set! Choose a feature to begin:', { reply_markup: buildFeaturesMenu() });
      await ctx.reply(getHelpText());
    }
  });

  // Features menu and feature-specific onboarding
  bot.callbackQuery('feature:menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('Choose a feature to begin:', { reply_markup: buildFeaturesMenu() });
  });
  bot.callbackQuery('feature:intro', async (ctx) => {
    await ctx.answerCallbackQuery();
    const text = getFeatureIntroText('intro');
    await ctx.reply(text, { reply_markup: buildFeaturesMenu() });
  });
  bot.callbackQuery('feature:help', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(getHelpText());
  });
  bot.callbackQuery('feature:logout', async (ctx) => {
    await ctx.answerCallbackQuery();
    const from = ctx.from;
    if (!from) return;
    const redis = getRedisClient();
    const link = await getLink(redis, from.id);
    if (!link) return ctx.reply('No linked account found.');
    await saveLink(redis, { ...link, status: 'unlinked', linked_at: Math.floor(Date.now() / 1000) });
    await ctx.reply('✅ Account unlinked.');
  });
  bot.callbackQuery('feature:chat', async (ctx) => {
    await ctx.answerCallbackQuery();
    const text = getFeatureIntroText('chat');
    const kb = new InlineKeyboard().text('💬 Start Chat', 'start_chat').row().text('🏠 Back', 'feature:menu');
    await ctx.reply(text, { reply_markup: kb });
  });
  bot.callbackQuery('feature:swap', async (ctx) => {
    await ctx.answerCallbackQuery();
    const text = getFeatureIntroText('swap');
    const kb = new InlineKeyboard().text('🔄 Start Swap', 'swap:start').row().text('🏠 Back', 'feature:menu');
    await ctx.reply(text, { reply_markup: kb });
  });
  bot.callbackQuery('feature:staking', async (ctx) => {
    await ctx.answerCallbackQuery();
    const text = getFeatureIntroText('staking');
    const kb = new InlineKeyboard().text('🏠 Back', 'feature:menu');
    await ctx.reply(text, { reply_markup: kb });
  });
  bot.callbackQuery('feature:lending', async (ctx) => {
    await ctx.answerCallbackQuery();
    const text = getFeatureIntroText('lending');
    const kb = new InlineKeyboard().text('🏠 Back', 'feature:menu');
    await ctx.reply(text, { reply_markup: kb });
  });
  bot.callbackQuery('feature:yield', async (ctx) => {
    await ctx.answerCallbackQuery();
    const text = getFeatureIntroText('yield');
    const kb = new InlineKeyboard().text('🏠 Back', 'feature:menu');
    await ctx.reply(text, { reply_markup: kb });
  });
  bot.callbackQuery('feature:track', async (ctx) => {
    await ctx.answerCallbackQuery();
    const text = getFeatureIntroText('track');
    const kb = new InlineKeyboard()
      .text('📒 Show Tracked', 'track:list')
      .row()
      .text('🏠 Back', 'feature:menu');
    await ctx.reply(text, { reply_markup: kb });
  });

  bot.callbackQuery('track:list', async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat?.id!;
    const redis = getRedisClient();
    const items = await listTracked(redis, chatId);
    if (!items.length) return ctx.reply('No tracked wallets yet. Use /track <address> to add one.');
    await ctx.reply(`Tracked wallets (chat ${chatId}):\n- ${items.join('\n- ')}`);
  });

  // --- Link/Unlink via chat-only ---
  bot.command('link', async (ctx) => {
    await linkAccount(ctx, { sendTutorial: true });
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

  function isEvmAddress(addr: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  }

  bot.command('track', async (ctx) => {
    const chatId = ctx.chat?.id!;
    const fromId = ctx.from?.id;
    const text = (ctx.message?.text ?? '').trim();
    const [, ...rest] = text.split(/\s+/);
    const address = rest.join(' ');
    if (!address || !isEvmAddress(address)) {
      await ctx.reply('Usage: /track <EVM_address>');
      return;
    }
    if (fromId) {
      const redis = getRedisClient();
      const link = await getLink(redis, fromId);
      if (!link || link.status !== 'linked') return ctx.reply('🔐 Please link your account first.');
      await addTracked(redis, chatId, address);
      await ctx.reply(`👛 Tracking started for ${address.toLowerCase()}`);
    }
  });

  bot.command('untrack', async (ctx) => {
    const chatId = ctx.chat?.id!;
    const text = (ctx.message?.text ?? '').trim();
    const [, ...rest] = text.split(/\s+/);
    const address = rest.join(' ').trim();
    const redis = getRedisClient();
    if (address) {
      await removeTracked(redis, chatId, address);
      await ctx.reply(`Removed ${address.toLowerCase()} from tracking.`);
    } else {
      await removeTracked(redis, chatId);
      await ctx.reply('Cleared all tracked wallets for this chat.');
    }
  });

  bot.command('tracked', async (ctx) => {
    const chatId = ctx.chat?.id!;
    const redis = getRedisClient();
    const list = await listTracked(redis, chatId);
    if (!list.length) return ctx.reply('No tracked wallets. Use /track <address> to add one.');
    await ctx.reply(`Tracked wallets (chat ${chatId}):\n- ${list.join('\n- ')}`);
  });

  // Atalhos pelos botões do /start e /settings
  bot.callbackQuery('link', async (ctx) => {
    await ctx.answerCallbackQuery();
    await linkAccount(ctx, { sendTutorial: true });
  });
  bot.callbackQuery('unlink', async (ctx) => {
    await ctx.answerCallbackQuery();
    const from = ctx.from;
    if (!from) return;
    const redis = getRedisClient();
    const link = await getLink(redis, from.id);
    if (!link) return ctx.reply('No linked account found.');
    await saveLink(redis, { ...link, status: 'unlinked', linked_at: Math.floor(Date.now() / 1000) });
    await ctx.reply('✅ Account unlinked.');
  });

  // --- Swap Wizard (MVP chat-only) ---
  const CHAINS = ['ethereum', 'polygon', 'base'] as const;
  const TOKENS = ['ETH', 'USDC', 'WBTC'] as const;

  function chainKeyboard() {
    const kb = new InlineKeyboard();
    CHAINS.forEach((c, i) => { kb.text(c, `swap:chain:${c}`); if (i % 2 === 1) kb.row(); });
  kb.row().text('❌ Cancel', 'swap:cancel');
    return kb;
  }
  function tokenKeyboard(kind: 'in'|'out') {
    const kb = new InlineKeyboard();
    TOKENS.forEach((t, i) => { kb.text(t, `swap:token_${kind}:${t}`); if (i % 3 === 2) kb.row(); });
    kb.row().text('❌ Cancel', 'swap:cancel');
    return kb;
  }

  bot.command('swap', async (ctx) => {
    try {
      const chatId = ctx.chat?.id!;
      const fromId = ctx.from?.id;
      const redis = getRedisClient();
      const env = parseEnv();
      if (fromId) {
        const link = await getLink(redis, fromId);
        console.log('🔍 [SWAP] Checking link for user:', fromId, 'Link found:', link);
        if (!link || link.status !== 'linked') {
          console.log('❌ [SWAP] User not linked, asking to link account');
          await ctx.reply('🔐 Please link your account first: tap "Link Account" or send /link');
          return;
        }
        console.log('✅ [SWAP] User is linked, proceeding with swap');
      }
      await setSwapState(redis, chatId, { step: 'choose_chain' });
      await ctx.reply('🔄 Let’s get a swap quote. Choose the chain:', { reply_markup: chainKeyboard() });

      // Offer opening the Miniapp (if configured)
      if (env.PUBLIC_WEBAPP_URL) {
        const baseUrl = env.PUBLIC_WEBAPP_URL;
        const swapUrl = baseUrl.includes('?') ? `${baseUrl}&page=swap` : `${baseUrl}?page=swap`;
        const debugUrl = baseUrl.includes('?') ? `${baseUrl}&page=swap&debug=1` : `${baseUrl}?page=swap&debug=1`;
        await ctx.reply('🧩 Prefer UI? Open the miniapp for Swap:', {
          reply_markup: {
            inline_keyboard: [[
              { text: 'Open Miniapp', web_app: { url: swapUrl } },
              { text: 'Open Miniapp (debug)', web_app: { url: debugUrl } },
            ]],
          },
        });
      }
    } catch (err) {
      await ctx.reply('❌ Failed to start swap. Send /status and try again.');
    }
  });

  bot.callbackQuery('swap:start', async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat?.id!;
    const redis = getRedisClient();
    const fromId = ctx.from?.id;
    if (fromId) {
      const link = await getLink(redis, fromId);
      console.log('🔍 [SWAP:START] Checking link for user:', fromId, 'Link found:', link);
      if (!link || link.status !== 'linked') {
        console.log('❌ [SWAP:START] User not linked, asking to link account');
        await ctx.reply('🔐 Please link your account first: tap "Link Account" or send /link');
        return;
      }
      console.log('✅ [SWAP:START] User is linked, proceeding with swap');
    }
    await setSwapState(redis, chatId, { step: 'choose_chain' });
    await ctx.reply('🔄 Let’s get a swap quote. Choose the chain:', { reply_markup: chainKeyboard() });
  });

  // Interceptar mensagem de amount quando aguardando
  bot.on('message:text', async (ctx, next) => {
    const chatId = ctx.chat?.id!;
    const redis = getRedisClient();
    const state = await getSwapState(redis, chatId);
    // Allow commands to bypass amount capture
    const txt = (ctx.message?.text ?? '').trim();
    if (txt.startsWith('/')) return next();
    if (!state || state.step !== 'enter_amount') return next();
    const text = txt;
    const amount = Number(text.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      await ctx.reply('Please enter a positive numeric amount.');
      return; // não chama next() para evitar envio ao agente
    }
    const newState: SwapState = { ...state, step: 'confirm_quote', amount } as SwapState;
    await setSwapState(redis, chatId, newState);

    let summary = '';
    try {
      const redis = getRedisClient();
      const link = await getLink(redis, ctx.from.id);
      if (!link || link.status !== 'linked') {
        summary = 'Please link your account first';
      } else {
        // Get JWT
        const session = await getSession(redis, link.zico_user_id, ctx.chat.id);
        if (!session?.jwt) {
          summary = 'Please authenticate first';
        } else {
          // Map chain names to IDs
          const chainMap: { [key: string]: number } = {
            'ethereum': 1,
            'polygon': 137,
            'base': 8453
          };
          
          const fromChainId = chainMap[newState.chain!] || 1;
          const toChainId = fromChainId; // Same chain for now
          
          console.log('📊 [SWAP] Getting quote with new implementation...', {
            fromChainId,
            toChainId,
            fromToken: newState.token_in,
            toToken: newState.token_out,
            amount: newState.amount
          });
          
          const quote = await quoteService.getQuote(
            fromChainId,
            toChainId,
            newState.token_in!,
            newState.token_out!,
            newState.amount!.toString(),
            session.jwt
          );
          
          if (quote && typeof quote === 'object' && 'quote' in quote) {
            const quoteData = quote as any;
            const estimatedReceive = quoteData.quote?.estimatedReceiveAmount ? 
              (parseFloat(quoteData.quote.estimatedReceiveAmount) / 1e18).toFixed(6) : 'N/A';
            const totalFeeUsd = quoteData.quote?.fees?.totalFeeUsd ? 
              parseFloat(quoteData.quote.fees.totalFeeUsd).toFixed(2) : 'N/A';
            
            summary = `Estimated receive: ${estimatedReceive} ${newState.token_out}\nFee: ${totalFeeUsd} USD`;
          } else {
            summary = 'Quote data not available';
          }
        }
      }
    } catch (e) {
      console.error('[SWAP] Quote error:', e);
      summary = `Could not fetch quote: ${e instanceof Error ? e.message : String(e)}`;
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
