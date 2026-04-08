import { InlineKeyboard } from 'grammy';
import type { Context } from 'grammy';
import type { BotConversation } from './types.js';
import type { BotContext } from '../bot/context.js';
import { STEP_TIMEOUT_MS } from './types.js';
import { t } from '../i18n/index.js';
import { DcaClient } from '../clients/dcaClient.js';
import { getServices } from '../services/index.js';

const dcaClient = new DcaClient();

const STAKE_TOKENS = [
  { symbol: 'ETH', protocol: 'Lido' },
  { symbol: 'AVAX', protocol: 'Benqi' },
  { symbol: 'cbETH', protocol: 'Coinbase' },
] as const;

/**
 * Stake wizard conversation.
 * Steps: select token → enter amount → confirm → execute.
 */
export async function stakeConversation(
  conversation: BotConversation,
  ctx: Context,
): Promise<void> {
  const lang = await conversation.external((ctx) =>
    (ctx as BotContext).session.language,
  );
  const strings = t(lang);
  const address = await conversation.external((ctx) =>
    (ctx as BotContext).session.smartAccountAddress,
  );

  if (!address) {
    await ctx.reply(strings.wizard_no_wallet, { parse_mode: 'HTML' });
    return;
  }

  const prefill = await conversation.external((ctx) =>
    (ctx as BotContext).session.wizardData,
  );

  // Step 1: Select token to stake
  let token = (prefill?.token as string) ?? '';
  let protocol = '';
  if (!token) {
    const keyboard = new InlineKeyboard();
    for (const t of STAKE_TOKENS) {
      keyboard.text(`${t.symbol} (${t.protocol})`, `stake_tk_${t.symbol}`);
    }
    keyboard.row().text('❌ Cancel', 'stake_tk_cancel');

    await ctx.reply(`${strings.stake_title}\n\n${strings.stake_select_token}`, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });

    const tokenCtx = await conversation.waitForCallbackQuery(/^stake_tk_/, {
      maxMilliseconds: STEP_TIMEOUT_MS,
      otherwise: (ctx) => ctx.reply(strings.wizard_select_token, { parse_mode: 'HTML' }),
    });
    await tokenCtx.answerCallbackQuery();
    token = tokenCtx.callbackQuery.data.replace('stake_tk_', '');

    if (token === 'cancel') {
      await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
      return;
    }
  }

  protocol = STAKE_TOKENS.find((t) => t.symbol === token)?.protocol ?? 'Lido';

  // Step 2: Enter amount
  let amount = (prefill?.amount as string) ?? '';
  if (!amount) {
    await ctx.reply(strings.stake_enter_amount, { parse_mode: 'HTML' });

    const amountCtx = await conversation.waitFor('message:text', {
      maxMilliseconds: STEP_TIMEOUT_MS,
      otherwise: (ctx) => ctx.reply(strings.wizard_enter_amount, { parse_mode: 'HTML' }),
    });
    amount = amountCtx.message.text.trim();

    if (amount.toLowerCase() === 'cancel') {
      await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
      return;
    }

    if (!isValidAmount(amount)) {
      await ctx.reply(strings.wizard_invalid_amount, { parse_mode: 'HTML' });
      const retryCtx = await conversation.waitFor('message:text', {
        maxMilliseconds: STEP_TIMEOUT_MS,
      });
      amount = retryCtx.message.text.trim();
      if (!isValidAmount(amount)) {
        await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
        return;
      }
    }
  }

  // Step 3: Confirmation
  const summary = typeof strings.stake_summary === 'function'
    ? strings.stake_summary(token, amount, protocol)
    : `Stake ${amount} ${token} via ${protocol}`;

  const confirmKeyboard = new InlineKeyboard()
    .text(strings.btn_confirm, 'stake_confirm')
    .text(strings.btn_cancel, 'stake_cancel_confirm');

  await ctx.reply(
    `${strings.wizard_confirm_details}\n\n${summary}`,
    { parse_mode: 'HTML', reply_markup: confirmKeyboard },
  );

  const confirmCtx = await conversation.waitForCallbackQuery(
    /^stake_(confirm|cancel_confirm)$/,
    { maxMilliseconds: STEP_TIMEOUT_MS },
  );
  await confirmCtx.answerCallbackQuery();

  if (confirmCtx.callbackQuery.data === 'stake_cancel_confirm') {
    await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
    return;
  }

  // Step 4: Execute
  await ctx.reply(strings.wizard_processing, { parse_mode: 'HTML' });

  try {
    const userId = await conversation.external((ctx) =>
      String((ctx as BotContext).from?.id ?? ''),
    );

    const result = await conversation.external(async () => {
      return dcaClient.signAndExecute(address, userId, address, '0', '0x', 8453);
    });

    if (result.success) {
      await ctx.reply(
        `${strings.wizard_success}\n\n🔗 Tx: <code>${result.transactionHash}</code>`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .url(strings.btn_view_tx, `https://basescan.org/tx/${result.transactionHash}`)
            .row()
            .text(strings.btn_back, 'open_menu'),
        },
      );
      try {
        const chatId = await conversation.external((ctx) => (ctx as BotContext).chat?.id);
        if (chatId) {
          const { txTracker } = getServices();
          await txTracker.track(chatId, result.transactionHash, 8453, 'stake');
        }
      } catch {}
    } else {
      await ctx.reply(strings.wizard_failed, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text(strings.btn_back, 'open_menu'),
      });
    }
  } catch (error) {
    console.error('[Stake] Execution failed:', error);
    await ctx.reply(strings.wizard_failed, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text(strings.btn_back, 'open_menu'),
    });
  }

  await conversation.external((ctx) => {
    (ctx as BotContext).session.wizardData = undefined;
    (ctx as BotContext).session.lastIntent = undefined;
  });
}

function isValidAmount(input: string): boolean {
  const num = parseFloat(input);
  return !isNaN(num) && num > 0 && isFinite(num);
}
