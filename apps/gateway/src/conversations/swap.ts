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
 * Swap wizard conversation.
 * Steps: select sell token → select buy token → enter amount → confirm → execute.
 */
export async function swapConversation(
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

  // Pre-fill from wizardData if coming from AI intent
  const prefill = await conversation.external((ctx) =>
    (ctx as BotContext).session.wizardData,
  );

  // Step 1: Select token to sell
  let fromToken = (prefill?.fromToken as string) ?? '';
  if (!fromToken) {
    const tokenKeyboard = buildTokenKeyboard('swap_from_');
    await ctx.reply(`${strings.swap_title}\n\n${strings.swap_select_from}`, {
      parse_mode: 'HTML',
      reply_markup: tokenKeyboard,
    });

    const fromCtx = await conversation.waitForCallbackQuery(/^swap_from_/, {
      maxMilliseconds: STEP_TIMEOUT_MS,
      otherwise: (ctx) => ctx.reply(strings.wizard_select_token, { parse_mode: 'HTML' }),
    });
    await fromCtx.answerCallbackQuery();
    fromToken = fromCtx.callbackQuery.data.replace('swap_from_', '');

    if (fromToken === 'cancel') {
      await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
      return;
    }
  }

  // Step 2: Select token to buy
  let toToken = (prefill?.toToken as string) ?? '';
  if (!toToken) {
    const tokenKeyboard = buildTokenKeyboard('swap_to_', fromToken);
    await ctx.reply(strings.swap_select_to, {
      parse_mode: 'HTML',
      reply_markup: tokenKeyboard,
    });

    const toCtx = await conversation.waitForCallbackQuery(/^swap_to_/, {
      maxMilliseconds: STEP_TIMEOUT_MS,
      otherwise: (ctx) => ctx.reply(strings.wizard_select_token, { parse_mode: 'HTML' }),
    });
    await toCtx.answerCallbackQuery();
    toToken = toCtx.callbackQuery.data.replace('swap_to_', '');

    if (toToken === 'cancel') {
      await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
      return;
    }
  }

  // Step 3: Enter amount
  let amount = (prefill?.amount as string) ?? '';
  if (!amount) {
    const amountPrompt = strings.swap_enter_amount.replace('${token}', fromToken);
    await ctx.reply(amountPrompt, { parse_mode: 'HTML' });

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
      // Retry once
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

  // Step 4: Confirmation
  const summary = typeof strings.swap_summary === 'function'
    ? strings.swap_summary(fromToken, toToken, amount)
    : `Swap ${amount} ${fromToken} → ${toToken}`;

  const confirmKeyboard = new InlineKeyboard()
    .text(strings.btn_confirm, 'swap_confirm')
    .text(strings.btn_cancel, 'swap_cancel_confirm');

  await ctx.reply(
    `${strings.wizard_confirm_details}\n\n${summary}`,
    { parse_mode: 'HTML', reply_markup: confirmKeyboard },
  );

  const confirmCtx = await conversation.waitForCallbackQuery(
    /^swap_(confirm|cancel_confirm)$/,
    { maxMilliseconds: STEP_TIMEOUT_MS },
  );
  await confirmCtx.answerCallbackQuery();

  if (confirmCtx.callbackQuery.data === 'swap_cancel_confirm') {
    await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
    return;
  }

  // Step 5: Execute
  await ctx.reply(strings.wizard_processing, { parse_mode: 'HTML' });

  try {
    const userId = await conversation.external((ctx) =>
      String((ctx as BotContext).from?.id ?? ''),
    );

    const result = await conversation.external(async () => {
      return dcaClient.signAndExecute(
        address,
        userId,
        address, // to (self for swap)
        '0',
        '0x', // data placeholder — Phase 3+ will encode swap calldata
        8453,
      );
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

      // Track tx for confirmation notification
      try {
        const chatId = await conversation.external((ctx) => (ctx as BotContext).chat?.id);
        if (chatId) {
          const { txTracker } = getServices();
          await txTracker.track(chatId, result.transactionHash, 8453, 'swap');
        }
      } catch {}
    } else {
      await ctx.reply(strings.wizard_failed, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text(strings.btn_back, 'open_menu'),
      });
    }
  } catch (error) {
    console.error('[Swap] Execution failed:', error);
    await ctx.reply(strings.wizard_failed, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text(strings.btn_back, 'open_menu'),
    });
  }

  // Clear wizard data
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
