import type { Api, RawApi } from 'grammy';
import { InlineKeyboard } from 'grammy';

/**
 * Proactive notification sender.
 * Uses the bot API directly to send messages outside of handler context.
 */
export class Notifier {
  constructor(private api: Api<RawApi>) {}

  async sendText(chatId: number | string, text: string, keyboard?: InlineKeyboard): Promise<void> {
    try {
      await this.api.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (error) {
      console.error(`[Notifier] Failed to send to ${chatId}:`, error);
    }
  }

  async sendTxUpdate(
    chatId: number | string,
    status: 'confirmed' | 'failed' | 'pending',
    txHash: string,
    details?: string,
  ): Promise<void> {
    const icons = { confirmed: '✅', failed: '❌', pending: '⏳' };
    const labels = { confirmed: 'Confirmed', failed: 'Failed', pending: 'Pending' };

    const text =
      `${icons[status]} <b>Transaction ${labels[status]}</b>\n\n` +
      `🔗 <code>${txHash}</code>` +
      (details ? `\n${details}` : '');

    const keyboard = status === 'confirmed'
      ? new InlineKeyboard()
          .url('🔍 View on Basescan', `https://basescan.org/tx/${txHash}`)
          .row()
          .text('🏠 Menu', 'open_menu')
      : new InlineKeyboard().text('🏠 Menu', 'open_menu');

    await this.sendText(chatId, text, keyboard);
  }

  async sendBalanceAlert(
    chatId: number | string,
    address: string,
    oldBalance: string,
    newBalance: string,
  ): Promise<void> {
    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const text =
      `💰 <b>Balance Update</b>\n\n` +
      `Account: <code>${shortAddr}</code>\n` +
      `Previous: ${oldBalance} ETH\n` +
      `Current: <b>${newBalance} ETH</b>`;

    const keyboard = new InlineKeyboard()
      .text('📊 Portfolio', 'portfolio_view')
      .text('🏠 Menu', 'open_menu');

    await this.sendText(chatId, text, keyboard);
  }

  async sendPriceAlert(
    chatId: number | string,
    token: string,
    price: string,
    targetPrice: string,
    direction: 'above' | 'below',
  ): Promise<void> {
    const icon = direction === 'above' ? '📈' : '📉';
    const text =
      `${icon} <b>Price Alert: ${token}</b>\n\n` +
      `Current price: <b>$${price}</b>\n` +
      `Your target: $${targetPrice} (${direction})\n\n` +
      `💡 <i>Want to act on this?</i>`;

    const keyboard = new InlineKeyboard()
      .text('🔄 Swap Now', 'swap_start')
      .text('🏠 Menu', 'open_menu');

    await this.sendText(chatId, text, keyboard);
  }
}
