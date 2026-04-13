import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../bot/context.js';
import { t, detectLanguage } from '../i18n/index.js';
import { sendMenu } from './menu.js';
import { sendWalletInfo } from './wallet.js';

/**
 * /start command handler.
 *
 * - New users: language selection -> create wallet -> QR code
 * - Returning users: welcome back + menu
 */
export async function handleStart(ctx: BotContext): Promise<void> {
  const fromId = ctx.from?.id;

  // Detect language from Telegram settings if first time
  if (!ctx.session.onboardingComplete && !ctx.session.language) {
    ctx.session.language = detectLanguage(ctx.from?.language_code);
  }

  // Returning user with smart account
  if (ctx.session.onboardingComplete && ctx.session.smartAccountAddress) {
    const strings = t(ctx.session.language);
    const balanceText = ctx.session.hasFundedAccount ? '' : '\n\n⚠️ No funds deposited yet.';
    const shortAddr = shortenAddress(ctx.session.smartAccountAddress);

    await ctx.reply(
      `${strings.welcome_back}\n\n${strings.wallet_status(shortAddr, 'loading...')}${balanceText}`,
      {
        parse_mode: 'HTML',
        reply_markup: buildMainMenuKeyboard(strings),
      },
    );
    return;
  }

  // New user: show language selection
  const strings = t(ctx.session.language);

  const keyboard = new InlineKeyboard()
    .text(strings.btn_english, 'lang_en')
    .text(strings.btn_portuguese, 'lang_pt');

  await ctx.reply(
    `${strings.welcome_title}\n\n${strings.welcome_body}`,
    { parse_mode: 'HTML', reply_markup: keyboard },
  );
}

function buildMainMenuKeyboard(strings: ReturnType<typeof t>) {
  return {
    inline_keyboard: [
      [
        { text: strings.btn_swap, callback_data: 'swap_start' },
        { text: strings.btn_stake, callback_data: 'stake_start' },
        { text: strings.btn_portfolio, callback_data: 'portfolio_view' },
      ],
      [
        { text: strings.btn_dca, callback_data: 'dca_start' },
        { text: strings.btn_bridge, callback_data: 'bridge_start' },
        { text: strings.btn_lend, callback_data: 'lend_start' },
      ],
      [
        { text: strings.btn_chat_ai, callback_data: 'chat_ai' },
      ],
    ],
  };
}

function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
