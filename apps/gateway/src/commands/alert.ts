import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../bot/context.js';
import { t } from '../i18n/index.js';
import { getServices } from '../services/index.js';

/**
 * /alert command — manage price alerts.
 * Shows current alerts and options to create new ones.
 */
export async function handleAlert(ctx: BotContext): Promise<void> {
  const strings = t(ctx.session.language);
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const { priceAlerts } = getServices();
  const alerts = await priceAlerts.listAlerts(chatId);

  let text = `🔔 <b>${strings.alert_title}</b>\n\n`;

  if (alerts.length === 0) {
    text += strings.alert_none;
  } else {
    for (const alert of alerts.slice(0, 10)) {
      const icon = alert.direction === 'above' ? '📈' : '📉';
      const price = priceAlerts.getCachedPrice(alert.token);
      const currentText = price != null ? ` (now: $${price.toFixed(2)})` : '';
      text += `${icon} <b>${alert.token}</b> ${alert.direction} $${alert.targetPrice}${currentText}\n`;
    }
  }

  const keyboard = new InlineKeyboard()
    .text(strings.alert_btn_create, 'alert_create')
    .row();

  if (alerts.length > 0) {
    keyboard.text(strings.alert_btn_clear_all, 'alert_clear_all');
    keyboard.row();
  }

  keyboard.text(strings.btn_back, 'open_menu');

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
}

/**
 * Handle alert creation callback.
 */
export async function handleAlertCreate(ctx: BotContext): Promise<void> {
  const strings = t(ctx.session.language);
  await ctx.answerCallbackQuery();

  const { priceAlerts } = getServices();
  const tokens = ['ETH', 'USDC', 'AVAX', 'AERO', 'cbETH'];

  let text = `🔔 <b>${strings.alert_select_token}</b>\n\n`;

  // Show current prices
  for (const token of tokens) {
    const price = priceAlerts.getCachedPrice(token);
    text += `• ${token}: ${price != null ? `$${price.toFixed(2)}` : 'loading...'}\n`;
  }

  text += `\n${strings.alert_instructions}`;

  await ctx.reply(text, { parse_mode: 'HTML' });
}

/**
 * Handle alert clear all callback.
 */
export async function handleAlertClearAll(ctx: BotContext): Promise<void> {
  const strings = t(ctx.session.language);
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  await ctx.answerCallbackQuery();

  const { priceAlerts } = getServices();
  const alerts = await priceAlerts.listAlerts(chatId);

  for (const alert of alerts) {
    await priceAlerts.removeAlert(alert.id);
  }

  await ctx.reply(strings.alert_cleared, { parse_mode: 'HTML' });
}

/**
 * Parse alert from text message.
 * Format: "alert ETH above 4000" or "alert AVAX below 30"
 */
export async function handleAlertText(ctx: BotContext): Promise<boolean> {
  const text = (ctx.message?.text ?? '').trim().toLowerCase();
  if (!text.startsWith('alert ')) return false;

  const strings = t(ctx.session.language);
  const chatId = ctx.chat?.id;
  if (!chatId) return false;

  // Parse: alert <TOKEN> <above|below> <PRICE>
  const parts = text.split(/\s+/);
  if (parts.length < 4) {
    await ctx.reply(strings.alert_invalid_format, { parse_mode: 'HTML' });
    return true;
  }

  const token = parts[1]!.toUpperCase();
  const direction = parts[2] as 'above' | 'below';
  const targetPrice = parseFloat(parts[3]!);

  if (direction !== 'above' && direction !== 'below') {
    await ctx.reply(strings.alert_invalid_format, { parse_mode: 'HTML' });
    return true;
  }

  if (isNaN(targetPrice) || targetPrice <= 0) {
    await ctx.reply(strings.alert_invalid_price, { parse_mode: 'HTML' });
    return true;
  }

  const { priceAlerts } = getServices();
  const alert = await priceAlerts.createAlert(chatId, token, targetPrice, direction);
  const icon = direction === 'above' ? '📈' : '📉';

  await ctx.reply(
    `✅ ${strings.alert_created}\n\n` +
    `${icon} <b>${alert.token}</b> ${direction} <b>$${targetPrice}</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('🔔 My Alerts', 'show_alerts')
        .text('🏠 Menu', 'open_menu'),
    },
  );

  return true;
}
