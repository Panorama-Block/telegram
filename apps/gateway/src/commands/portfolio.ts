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

    let body = `📊 <b>Portfolio</b>\n\n` +
      `🔐 <b>PanoramaBlock Wallet</b>\n` +
      `<code>${shortAddr}</code>\n` +
      `Balance: ${balance} ETH (${balanceUsd})`;

    const ext = ctx.session.externalWallet;
    if (ext) {
      const extShort = `${ext.address.slice(0, 6)}...${ext.address.slice(-4)}`;
      const chainLabel = ext.chainId === 1 ? 'Ethereum' : ext.chainId === 8453 ? 'Base' : ext.chainId === 42161 ? 'Arbitrum' : ext.chainId === 10 ? 'Optimism' : `Chain ${ext.chainId}`;
      body += `\n\n🔗 <b>External Wallet</b>\n` +
        `<code>${extShort}</code>\n` +
        `🌐 ${chainLabel}`;
    }

    body += `\n\n<i>More details coming soon...</i>`;

    await ctx.reply(body, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(strings.btn_refresh, 'portfolio_view')
        .text(strings.btn_deposit_more, 'create_wallet'),
    });
  } catch (error) {
    console.error('[Portfolio] Failed to fetch balance:', error);
    await ctx.reply(strings.error_generic, { parse_mode: 'HTML' });
  }
}
