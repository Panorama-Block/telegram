import { InlineKeyboard } from 'grammy';
import type { Context } from 'grammy';
import type { BotConversation } from './types.js';
import type { BotContext } from '../bot/context.js';
import { POPULAR_TOKENS, STEP_TIMEOUT_MS } from './types.js';
import { t } from '../i18n/index.js';
import { DcaClient } from '../clients/dcaClient.js';
import { getServices } from '../services/index.js';

const dcaClient = new DcaClient();

type LendAction = 'supply' | 'borrow' | 'repay' | 'withdraw';

/**
 * Lending wizard conversation.
 * Steps: select action → select token → enter amount → confirm → execute.
 */
export async function lendConversation(
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

  // Step 1: Select action
  let action = (prefill?.action as LendAction) ?? '';
  if (!action) {
    const actionKeyboard = new InlineKeyboard()
      .text(strings.btn_lend_supply, 'lend_act_supply')
      .text(strings.btn_lend_borrow, 'lend_act_borrow')
      .row()
      .text(strings.btn_lend_repay, 'lend_act_repay')
      .text(strings.btn_lend_withdraw, 'lend_act_withdraw')
      .row()
      .text(strings.btn_cancel, 'lend_act_cancel');

    await ctx.reply(`${strings.lend_title}\n\n${strings.lend_select_action}`, {
      parse_mode: 'HTML',
      reply_markup: actionKeyboard,
    });

    const actionCtx = await conversation.waitForCallbackQuery(/^lend_act_/, {
      maxMilliseconds: STEP_TIMEOUT_MS,
    });
    await actionCtx.answerCallbackQuery();
    action = actionCtx.callbackQuery.data.replace('lend_act_', '') as LendAction;

    if (action === ('cancel' as LendAction)) {
      await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
      return;
    }
  }

  // Step 2: Select token
  let token = (prefill?.token as string) ?? '';
  if (!token) {
    const lendTokens = POPULAR_TOKENS.filter((t) =>
      ['ETH', 'USDC', 'USDT', 'DAI', 'WETH'].includes(t.symbol),
    );
    const keyboard = new InlineKeyboard();
    for (let i = 0; i < lendTokens.length; i++) {
      const tk = lendTokens[i]!;
      keyboard.text(tk.symbol, `lend_tk_${tk.symbol}`);
      if ((i + 1) % 3 === 0) keyboard.row();
    }
    keyboard.row().text('❌ Cancel', 'lend_tk_cancel');

    await ctx.reply(strings.lend_select_token, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });

    const tokenCtx = await conversation.waitForCallbackQuery(/^lend_tk_/, {
      maxMilliseconds: STEP_TIMEOUT_MS,
      otherwise: (ctx) => ctx.reply(strings.wizard_select_token, { parse_mode: 'HTML' }),
    });
    await tokenCtx.answerCallbackQuery();
    token = tokenCtx.callbackQuery.data.replace('lend_tk_', '');

    if (token === 'cancel') {
      await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
      return;
    }
  }

  // Step 3: Enter amount
  let amount = (prefill?.amount as string) ?? '';
  if (!amount) {
    await ctx.reply(strings.lend_enter_amount, { parse_mode: 'HTML' });

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

  // Step 4: Confirmation
  const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
  const summary = typeof strings.lend_summary === 'function'
    ? strings.lend_summary(actionLabel, token, amount)
    : `${actionLabel} ${amount} ${token}`;

  const confirmKeyboard = new InlineKeyboard()
    .text(strings.btn_confirm, 'lend_confirm')
    .text(strings.btn_cancel, 'lend_cancel_confirm');

  await ctx.reply(
    `${strings.wizard_confirm_details}\n\n${summary}`,
    { parse_mode: 'HTML', reply_markup: confirmKeyboard },
  );

  const confirmCtx = await conversation.waitForCallbackQuery(
    /^lend_(confirm|cancel_confirm)$/,
    { maxMilliseconds: STEP_TIMEOUT_MS },
  );
  await confirmCtx.answerCallbackQuery();

  if (confirmCtx.callbackQuery.data === 'lend_cancel_confirm') {
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
          await txTracker.track(chatId, result.transactionHash, 8453, 'lend');
        }
      } catch {}
    } else {
      await ctx.reply(strings.wizard_failed, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text(strings.btn_back, 'open_menu'),
      });
    }
  } catch (error) {
    console.error('[Lend] Execution failed:', error);
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
