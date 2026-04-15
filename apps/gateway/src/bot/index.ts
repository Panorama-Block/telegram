import { Bot, session } from 'grammy';
import { hydrate } from '@grammyjs/hydrate';
import { autoRetry } from '@grammyjs/auto-retry';
import { conversations, createConversation } from '@grammyjs/conversations';

import { parseEnv } from '../env.js';
import type { BotContext } from './context.js';
import { defaultSession } from './context.js';
import { createSessionStorage } from './session.js';
import { typingMiddleware } from '../middleware/typing.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { errorBoundaryMiddleware } from '../middleware/errorBoundary.js';
import { handleCallbackQuery } from '../callbacks/router.js';
import { handleStart } from '../commands/start.js';
import { handleMenu, sendMenu } from '../commands/menu.js';
import { handleWallet } from '../commands/wallet.js';
import { handleHelp } from '../commands/help.js';
import { handleSettings } from '../commands/settings.js';
import { handlePortfolio } from '../commands/portfolio.js';
import { handleTextMessage } from './chatHandler.js';
import { t } from '../i18n/index.js';
import { handleAlert, handleAlertCreate, handleAlertClearAll, handleAlertText } from '../commands/alert.js';
import {
  swapConversation,
  stakeConversation,
  lendConversation,
  dcaConversation,
  bridgeConversation,
} from '../conversations/index.js';

export function createBot(): Bot<BotContext> {
  const env = parseEnv();
  const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN);

  // ── API-level plugins ────────────────────────────────────
  bot.api.config.use(autoRetry());

  // ── Context plugins ──────────────────────────────────────
  bot.use(hydrate());

  // ── Session (Redis-backed) ───────────────────────────────
  bot.use(session({
    initial: defaultSession,
    storage: createSessionStorage(),
  }));

  // ── Error boundary & rate limiting ───────────────────────
  bot.use(errorBoundaryMiddleware);
  bot.use(rateLimitMiddleware);

  // ── Conversations plugin (Phase 3 wizards) ───────────────
  bot.use(conversations());
  bot.use(createConversation(swapConversation, 'swap'));
  bot.use(createConversation(stakeConversation, 'stake'));
  bot.use(createConversation(lendConversation, 'lend'));
  bot.use(createConversation(dcaConversation, 'dca'));
  bot.use(createConversation(bridgeConversation, 'bridge'));

  // ── Commands ─────────────────────────────────────────────
  bot.command('start', handleStart);
  bot.command('menu', handleMenu);
  bot.command('wallet', handleWallet);
  bot.command('swap', enterConversationCommand('swap'));
  bot.command('stake', enterConversationCommand('stake'));
  bot.command('lend', enterConversationCommand('lend'));
  bot.command('dca', enterConversationCommand('dca'));
  bot.command('bridge', enterConversationCommand('bridge'));
  bot.command('portfolio', handlePortfolio);
  bot.command('alert', handleAlert);
  bot.command('settings', handleSettings);
  bot.command('help', handleHelp);

  // ── Callback queries ─────────────────────────────────────
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;

    // Portfolio callback
    if (data === 'portfolio_view') {
      await ctx.answerCallbackQuery();
      await handlePortfolio(ctx);
      return;
    }

    // Help callback
    if (data === 'show_help') {
      await ctx.answerCallbackQuery();
      await handleHelp(ctx);
      return;
    }

    // Alert callbacks
    if (data === 'show_alerts') {
      await ctx.answerCallbackQuery();
      await handleAlert(ctx);
      return;
    }
    if (data === 'alert_create') {
      await handleAlertCreate(ctx);
      return;
    }
    if (data === 'alert_clear_all') {
      await ctx.answerCallbackQuery();
      await handleAlertClearAll(ctx);
      return;
    }

    // Chat AI callback
    if (data === 'chat_ai') {
      await ctx.answerCallbackQuery();
      const thinking = t(ctx.session.language).chat_thinking as string;
      await ctx.reply(
        thinking.replace('🤔', '💬') +
        '\n\nJust type your message and I\'ll respond!',
        { parse_mode: 'HTML' },
      );
      return;
    }

    // Delegate to central router
    await handleCallbackQuery(ctx);
  });

  // ── Reply keyboard text matching ─────────────────────────
  // When user taps persistent reply keyboard buttons
  bot.hears(/^🔄 Swap$/i, enterConversationCommand('swap'));
  bot.hears(/^📈 Stake$/i, enterConversationCommand('stake'));
  bot.hears(/^📊 (Portfolio|Portfólio)$/i, handlePortfolio);

  // ── Text messages ────────────────────────────────────────
  // Alert text commands (e.g. "alert ETH above 4000")
  bot.hears(/^alert\s/i, async (ctx) => {
    const handled = await handleAlertText(ctx);
    if (!handled) await handleTextMessage(ctx);
  });

  // AI chat (typing middleware + agent forwarding)
  bot.on('message:text', typingMiddleware, handleTextMessage);

  // ── Error handler ────────────────────────────────────────
  bot.catch((err) => {
    console.error('[Bot] Unhandled error:', err.error);
    err.ctx.reply(t(err.ctx.session?.language ?? 'en').error_generic).catch(() => {});
  });

  return bot;
}

/**
 * Register bot commands with Telegram (shows in command menu).
 */
export async function registerCommands(bot: Bot<BotContext>): Promise<void> {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Start the bot / Set up wallet' },
    { command: 'menu', description: 'Open main menu' },
    { command: 'wallet', description: 'View smart account & QR' },
    { command: 'swap', description: 'Swap tokens' },
    { command: 'stake', description: 'Stake ETH/AVAX' },
    { command: 'lend', description: 'Lending operations' },
    { command: 'dca', description: 'DCA strategies' },
    { command: 'bridge', description: 'Bridge cross-chain' },
    { command: 'portfolio', description: 'View your positions' },
    { command: 'alert', description: 'Price alerts' },
    { command: 'settings', description: 'Language & preferences' },
    { command: 'help', description: 'Show help' },
  ]);
  console.log('[Bot] Commands registered with Telegram');
}

/**
 * Enter a conversation wizard from a /command.
 */
function enterConversationCommand(name: string) {
  return async (ctx: BotContext) => {
    await ctx.conversation.enter(name);
  };
}
