import { InlineKeyboard, Keyboard } from 'grammy';
import type { BotContext } from '../bot/context.js';
import { t } from '../i18n/index.js';

/**
 * /menu command — shows the main menu with DeFi operation buttons.
 */
export async function handleMenu(ctx: BotContext): Promise<void> {
  await sendMenu(ctx);
}

/**
 * Send the main menu as a new message.
 * Can be called from callbacks too.
 */
export async function sendMenu(ctx: BotContext): Promise<void> {
  const strings = t(ctx.session.language);

  const inlineKeyboard = new InlineKeyboard()
    .text(strings.btn_swap, 'swap_start')
    .text(strings.btn_stake, 'stake_start')
    .text(strings.btn_lend, 'lend_start')
    .row()
    .text(strings.btn_dca, 'dca_start')
    .text(strings.btn_bridge, 'bridge_start')
    .text(strings.btn_portfolio, 'portfolio_view')
    .row()
    .text(strings.btn_settings, 'settings_lang')
    .text(strings.btn_help, 'show_help');

  await ctx.reply(strings.menu_title, { parse_mode: 'HTML',
    reply_markup: inlineKeyboard,
  });

  // Also set persistent reply keyboard for quick access
  await setReplyKeyboard(ctx);
}

/**
 * Set the persistent reply keyboard below the input field.
 */
async function setReplyKeyboard(ctx: BotContext): Promise<void> {
  const strings = t(ctx.session.language);

  const keyboard = new Keyboard()
    .text(strings.btn_swap).text(strings.btn_stake).text(strings.btn_portfolio)
    .resized()
    .persistent();

  // Send a zero-width space message with the keyboard to set it
  // (the menu message above already has inline keyboard)
  await ctx.reply('\u200B', { reply_markup: keyboard }).catch(() => {});
}
