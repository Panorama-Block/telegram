import { Bot, session } from 'grammy';
import { hydrate } from '@grammyjs/hydrate';
import { autoRetry } from '@grammyjs/auto-retry';
import { conversations } from '@grammyjs/conversations';

import { parseEnv } from '../env.js';
import type { BotContext } from './context.js';
import { defaultSession } from './context.js';
import { createSessionStorage } from './session.js';
import { typingMiddleware } from '../middleware/typing.js';
import { handleCallbackQuery } from '../callbacks/router.js';
import { handleStart } from '../commands/start.js';
import { handleMenu, sendMenu } from '../commands/menu.js';
import { handleWallet } from '../commands/wallet.js';
import { handleHelp } from '../commands/help.js';
import { handleSettings } from '../commands/settings.js';
import { handlePortfolio } from '../commands/portfolio.js';
import { handleTextMessage } from './chatHandler.js';
import { t } from '../i18n/index.js';

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

  // ── Conversations plugin (for Phase 3 wizards) ──────────
  bot.use(conversations());

  // ── Commands ─────────────────────────────────────────────
  bot.command('start', handleStart);
  bot.command('menu', handleMenu);
  bot.command('wallet', handleWallet);
  bot.command('swap', placeholderCommand('swap'));
  bot.command('stake', placeholderCommand('stake'));
  bot.command('lend', placeholderCommand('lend'));
  bot.command('dca', placeholderCommand('dca'));
  bot.command('bridge', placeholderCommand('bridge'));
  bot.command('portfolio', handlePortfolio);
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
  bot.hears(/^🔄 Swap$/i, placeholderCommand('swap'));
  bot.hears(/^📈 Stake$/i, placeholderCommand('stake'));
  bot.hears(/^📊 (Portfolio|Portfólio)$/i, handlePortfolio);

  // ── Text messages (AI chat) ──────────────────────────────
  // Typing middleware only for text messages to agents
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
    { command: 'settings', description: 'Language & preferences' },
    { command: 'help', description: 'Show help' },
  ]);
  console.log('[Bot] Commands registered with Telegram');
}

/**
 * Placeholder for commands that will be implemented in Phase 3.
 */
function placeholderCommand(operation: string) {
  return async (ctx: BotContext) => {
    const strings = t(ctx.session.language);
    await ctx.reply(
      `🚧 <b>${operation.charAt(0).toUpperCase() + operation.slice(1)}</b> wizard coming soon!\n\n` +
      `For now, describe what you want in chat and I'll help via AI.\n` +
      `Example: "swap 1 ETH to USDC"`,
      { parse_mode: 'HTML' },
    );
  };
}
