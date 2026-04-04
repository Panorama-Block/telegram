import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../bot/context.js';
import { t } from '../i18n/index.js';
import { DcaClient } from '../clients/dcaClient.js';

const dcaClient = new DcaClient();

/**
 * /portfolio command — shows smart account balance and positions.
 * Phase 1: basic balance display. Phase 3 will aggregate all protocols.
 */
export async function handlePortfolio(ctx: BotContext): Promise<void> {
  const strings = t(ctx.session.language);
  const address = ctx.session.smartAccountAddress;

  if (!address) {
    await ctx.reply(strings.wallet_not_linked, { parse_mode: 'HTML' });
    return;
  }

  try {
    const { balance, balanceUsd } = await dcaClient.getAccountBalance(address);
    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;

    await ctx.reply(
      `📊 <b>Portfolio</b>\n\n` +
      `Smart Account: <code>${shortAddr}</code>\n` +
      `Balance: ${balance} ETH (${balanceUsd})\n\n` +
      `<i>More details coming soon...</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text(strings.btn_refresh, 'portfolio_view')
          .text(strings.btn_deposit_more, 'create_wallet'),
      },
    );
  } catch (error) {
    console.error('[Portfolio] Failed to fetch balance:', error);
    await ctx.reply(strings.error_generic, { parse_mode: 'HTML' });
  }
}
