import { InlineKeyboard, InputFile } from 'grammy';
import QRCode from 'qrcode';
import type { BotContext } from '../bot/context.js';
import { t } from '../i18n/index.js';
import { DcaClient } from '../clients/dcaClient.js';
import { getServices } from '../services/index.js';
import { parseEnv } from '../env.js';

const dcaClient = new DcaClient();

/**
 * /wallet command — shows smart account status and QR code for funding.
 */
export async function handleWallet(ctx: BotContext): Promise<void> {
  await sendWalletInfo(ctx, false);
}

/**
 * Show wallet info. If `createIfMissing` is true, creates a new smart account.
 */
export async function sendWalletInfo(ctx: BotContext, createIfMissing: boolean): Promise<void> {
  const strings = t(ctx.session.language);

  // Show status of both wallet modes
  if (!createIfMissing) {
    await sendWalletStatus(ctx);
    return;
  }

  // No smart account yet
  if (!ctx.session.smartAccountAddress) {

    // Create smart account
    await ctx.reply(strings.wallet_creating, { parse_mode: 'HTML' });

    try {
      const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
      const result = await dcaClient.createSmartAccount(
        userId,
        `Telegram-${userId}`,
      );

      ctx.session.smartAccountAddress = result.smartAccountAddress;
      ctx.session.sessionKeyAddress = result.sessionKeyAddress;
      ctx.session.onboardingComplete = true;

      await ctx.reply(strings.wallet_created(result.smartAccountAddress), { parse_mode: 'HTML' });

      // Start watching balance for deposit detection
      try {
        const chatId = ctx.chat?.id;
        if (chatId) {
          const { balanceWatcher } = getServices();
          await balanceWatcher.watch(chatId, result.smartAccountAddress);
        }
      } catch {}

    } catch (error) {
      console.error('[Wallet] Failed to create smart account:', error);
      await ctx.reply(strings.error_generic, { parse_mode: 'HTML' });
      return;
    }
  }

  // Send QR code with the smart account address
  await sendQrCode(ctx, ctx.session.smartAccountAddress!);
}

/**
 * Show the unified wallet status: PanoramaBlock Wallet + External Wallet.
 * Lets the user pick which mode is active and trigger connect/create flows.
 */
export async function sendWalletStatus(ctx: BotContext): Promise<void> {
  const strings = t(ctx.session.language);
  const lang = ctx.session.language;
  const mode = ctx.session.walletMode ?? 'smart';

  const smart = ctx.session.smartAccountAddress;
  const ext = ctx.session.externalWallet;

  const smartLine = smart
    ? `🔐 <b>PanoramaBlock Wallet</b>${mode === 'smart' ? ' ✅' : ''}\n<code>${smart}</code>`
    : lang === 'pt'
      ? '🔐 <b>PanoramaBlock Wallet</b>\n<i>Não criada</i>'
      : '🔐 <b>PanoramaBlock Wallet</b>\n<i>Not created</i>';

  const extLine = ext
    ? `🔗 <b>External Wallet</b>${mode === 'external' ? ' ✅' : ''}\n<code>${ext.address}</code>\n🌐 ${chainName(ext.chainId)}`
    : lang === 'pt'
      ? '🔗 <b>External Wallet</b>\n<i>Não conectada</i>'
      : '🔗 <b>External Wallet</b>\n<i>Not connected</i>';

  const title = lang === 'pt' ? '👛 <b>Suas Carteiras</b>' : '👛 <b>Your Wallets</b>';
  const body = `${title}\n\n${smartLine}\n\n${extLine}`;

  const kb = new InlineKeyboard();

  if (!smart) {
    kb.text(strings.btn_create_wallet, 'create_wallet').row();
  } else if (mode !== 'smart') {
    kb.text(lang === 'pt' ? '🔐 Usar PanoramaBlock' : '🔐 Use PanoramaBlock', 'wallet_use_smart').row();
  }

  // External wallet connect (opens miniapp)
  const env = (() => {
    try { return parseEnv(); } catch { return null; }
  })();
  const gatewayBase = env?.PUBLIC_GATEWAY_URL?.replace(/\/+$/, '');
  if (gatewayBase) {
    const url = `${gatewayBase}/miniapp/connect-external`;
    const label = ext
      ? lang === 'pt' ? '🔗 Reconectar External' : '🔗 Reconnect External'
      : lang === 'pt' ? '🔗 Conectar Carteira Externa' : '🔗 Connect External Wallet';
    kb.webApp(label, url).row();
  }

  if (ext && mode !== 'external') {
    kb.text(lang === 'pt' ? '🔗 Usar External' : '🔗 Use External', 'wallet_use_external').row();
  }

  kb.text(strings.btn_back, 'open_menu');

  await ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb });
}

function chainName(chainId: number): string {
  switch (chainId) {
    case 1: return 'Ethereum';
    case 10: return 'Optimism';
    case 8453: return 'Base';
    case 42161: return 'Arbitrum';
    default: return `Chain ${chainId}`;
  }
}

/**
 * Generate and send QR code image for the smart account address.
 */
async function sendQrCode(ctx: BotContext, address: string): Promise<void> {
  const strings = t(ctx.session.language);

  try {
    const qrBuffer = await QRCode.toBuffer(address, {
      type: 'png',
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    const keyboard = new InlineKeyboard()
      .text(strings.btn_copy_address, 'noop')
      .row()
      .text(strings.btn_i_deposited, 'check_deposit');

    await ctx.replyWithPhoto(
      new InputFile(qrBuffer, 'qr-code.png'),
      {
        caption:
          `${strings.wallet_fund_prompt}\n\n<code>${address}</code>`,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      },
    );
  } catch (error) {
    console.error('[Wallet] QR generation failed:', error);
    // Fallback: send address without QR
    await ctx.reply(
      `${strings.wallet_fund_prompt}\n\n<code>${address}</code>`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text(strings.btn_i_deposited, 'check_deposit'),
      },
    );
  }
}

/**
 * Handle "I've Deposited" callback — check balance.
 */
export async function handleDeposited(ctx: BotContext): Promise<void> {
  const strings = t(ctx.session.language);
  const address = ctx.session.smartAccountAddress;

  if (!address) {
    await ctx.answerCallbackQuery({ text: 'No wallet found' });
    return;
  }

  await ctx.answerCallbackQuery({ text: 'Checking balance...' });

  try {
    const { balance } = await dcaClient.getAccountBalance(address);
    const balanceNum = parseFloat(balance || '0');

    if (balanceNum > 0) {
      ctx.session.hasFundedAccount = true;
      await ctx.reply(strings.wallet_funded, { parse_mode: 'HTML' });

      // Import sendMenu dynamically to avoid circular deps
      const { sendMenu } = await import('./menu.js');
      await sendMenu(ctx);
    } else {
      await ctx.reply(strings.wallet_no_funds, { parse_mode: 'HTML' });
    }
  } catch (error) {
    console.error('[Wallet] Balance check failed:', error);
    await ctx.reply(strings.wallet_no_funds, { parse_mode: 'HTML' });
  }
}
