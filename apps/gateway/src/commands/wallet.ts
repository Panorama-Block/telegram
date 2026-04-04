import { InlineKeyboard, InputFile } from 'grammy';
import QRCode from 'qrcode';
import type { BotContext } from '../bot/context.js';
import { t } from '../i18n/index.js';
import { DcaClient } from '../clients/dcaClient.js';

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

  // No smart account yet
  if (!ctx.session.smartAccountAddress) {
    if (!createIfMissing) {
      await ctx.reply(strings.wallet_not_linked, { parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text(strings.btn_create_wallet, 'create_wallet'),
      });
      return;
    }

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
