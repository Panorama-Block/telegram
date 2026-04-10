import { InlineKeyboard } from 'grammy';
import type { Context } from 'grammy';
import type { BotConversation } from './types.js';
import type { BotContext } from '../bot/context.js';
import { POPULAR_TOKENS, STEP_TIMEOUT_MS } from './types.js';
import { t } from '../i18n/index.js';
import { DcaClient } from '../clients/dcaClient.js';
import { getServices } from '../services/index.js';

const dcaClient = new DcaClient();

/**
 * DCA wizard conversation.
 * Steps: select spend token → select buy token → amount → frequency → duration → confirm → execute.
 */
export async function dcaConversation(
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

  // Step 1: Select token to spend
  let fromToken = (prefill?.fromToken as string) ?? '';
  if (!fromToken) {
    const keyboard = buildTokenKeyboard('dca_from_');
    await ctx.reply(`${strings.dca_title}\n\n${strings.dca_select_from}`, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });

    const fromCtx = await conversation.waitForCallbackQuery(/^dca_from_/, {
      maxMilliseconds: STEP_TIMEOUT_MS,
      otherwise: (ctx) => ctx.reply(strings.wizard_select_token, { parse_mode: 'HTML' }),
    });
    await fromCtx.answerCallbackQuery();
    fromToken = fromCtx.callbackQuery.data.replace('dca_from_', '');

    if (fromToken === 'cancel') {
      await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
      return;
    }
  }

  // Step 2: Select token to accumulate
  let toToken = (prefill?.toToken as string) ?? '';
  if (!toToken) {
    const keyboard = buildTokenKeyboard('dca_to_', fromToken);
    await ctx.reply(strings.dca_select_to, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });

    const toCtx = await conversation.waitForCallbackQuery(/^dca_to_/, {
      maxMilliseconds: STEP_TIMEOUT_MS,
      otherwise: (ctx) => ctx.reply(strings.wizard_select_token, { parse_mode: 'HTML' }),
    });
    await toCtx.answerCallbackQuery();
    toToken = toCtx.callbackQuery.data.replace('dca_to_', '');

    if (toToken === 'cancel') {
      await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
      return;
    }
  }

  // Step 3: Amount per execution
  let amount = (prefill?.amount as string) ?? '';
  if (!amount) {
    await ctx.reply(strings.dca_enter_amount, { parse_mode: 'HTML' });

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

  // Step 4: Frequency
  let frequency = (prefill?.frequency as string) ?? '';
  if (!frequency) {
    const freqKeyboard = new InlineKeyboard()
      .text(strings.btn_freq_daily, 'dca_freq_daily')
      .text(strings.btn_freq_weekly, 'dca_freq_weekly')
      .row()
      .text(strings.btn_freq_biweekly, 'dca_freq_biweekly')
      .text(strings.btn_freq_monthly, 'dca_freq_monthly')
      .row()
      .text(strings.btn_cancel, 'dca_freq_cancel');

    await ctx.reply(strings.dca_select_frequency, {
      parse_mode: 'HTML',
      reply_markup: freqKeyboard,
    });

    const freqCtx = await conversation.waitForCallbackQuery(/^dca_freq_/, {
      maxMilliseconds: STEP_TIMEOUT_MS,
    });
    await freqCtx.answerCallbackQuery();
    frequency = freqCtx.callbackQuery.data.replace('dca_freq_', '');

    if (frequency === 'cancel') {
      await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
      return;
    }
  }

  // Step 5: Duration
  let duration = (prefill?.duration as string) ?? '';
  if (!duration) {
    const durKeyboard = new InlineKeyboard()
      .text(strings.btn_dur_1month, 'dca_dur_1month')
      .text(strings.btn_dur_3months, 'dca_dur_3months')
      .row()
      .text(strings.btn_dur_6months, 'dca_dur_6months')
      .text(strings.btn_dur_12months, 'dca_dur_12months')
      .row()
      .text(strings.btn_cancel, 'dca_dur_cancel');

    await ctx.reply(strings.dca_select_duration, {
      parse_mode: 'HTML',
      reply_markup: durKeyboard,
    });

    const durCtx = await conversation.waitForCallbackQuery(/^dca_dur_/, {
      maxMilliseconds: STEP_TIMEOUT_MS,
    });
    await durCtx.answerCallbackQuery();
    duration = durCtx.callbackQuery.data.replace('dca_dur_', '');

    if (duration === 'cancel') {
      await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
      return;
    }
  }

  // Step 6: Confirmation
  const freqLabel = frequency.charAt(0).toUpperCase() + frequency.slice(1);
  const durLabel = duration.replace(/(\d+)/, '$1 ');
  const summary = typeof strings.dca_summary === 'function'
    ? strings.dca_summary(fromToken, toToken, amount, freqLabel, durLabel)
    : `DCA ${amount} ${fromToken} → ${toToken} ${freqLabel} for ${durLabel}`;

  const confirmKeyboard = new InlineKeyboard()
    .text(strings.btn_confirm, 'dca_confirm')
    .text(strings.btn_cancel, 'dca_cancel_confirm');

  await ctx.reply(
    `${strings.wizard_confirm_details}\n\n${summary}`,
    { parse_mode: 'HTML', reply_markup: confirmKeyboard },
  );

  const confirmCtx = await conversation.waitForCallbackQuery(
    /^dca_(confirm|cancel_confirm)$/,
    { maxMilliseconds: STEP_TIMEOUT_MS },
  );
  await confirmCtx.answerCallbackQuery();

  if (confirmCtx.callbackQuery.data === 'dca_cancel_confirm') {
    await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
    return;
  }

  // Step 7: Execute
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
          await txTracker.track(chatId, result.transactionHash, 8453, 'dca');
        }
      } catch {}
    } else {
      await ctx.reply(strings.wizard_failed, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text(strings.btn_back, 'open_menu'),
      });
    }
  } catch (error) {
    console.error('[DCA] Execution failed:', error);
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

function buildTokenKeyboard(prefix: string, exclude?: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const tokens = POPULAR_TOKENS.filter((t) => t.symbol !== exclude);

  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i]!;
    keyboard.text(tk.symbol, `${prefix}${tk.symbol}`);
    if ((i + 1) % 3 === 0) keyboard.row();
  }
  keyboard.row().text('❌ Cancel', `${prefix}cancel`);
  return keyboard;
}

function isValidAmount(input: string): boolean {
  const num = parseFloat(input);
  return !isNaN(num) && num > 0 && isFinite(num);
}
