import { InlineKeyboard } from 'grammy';
import type { Context } from 'grammy';
import type { BotConversation } from './types.js';
import type { BotContext } from '../bot/context.js';
import { POPULAR_TOKENS, CHAINS, STEP_TIMEOUT_MS } from './types.js';
import { t } from '../i18n/index.js';
import { DcaClient } from '../clients/dcaClient.js';
import { getServices } from '../services/index.js';

const dcaClient = new DcaClient();

/**
 * Bridge wizard conversation.
 * Steps: select source chain → select dest chain → select token → amount → confirm → execute.
 */
export async function bridgeConversation(
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

  // Step 1: Select source chain
  let fromChain = (prefill?.fromChain as string) ?? '';
  if (!fromChain) {
    const chainKeyboard = new InlineKeyboard();
    for (const c of CHAINS) {
      chainKeyboard.text(c.name, `bridge_fc_${c.name}`);
    }
    chainKeyboard.row().text('❌ Cancel', 'bridge_fc_cancel');

    await ctx.reply(`${strings.bridge_title}\n\n${strings.bridge_select_from_chain}`, {
      parse_mode: 'HTML',
      reply_markup: chainKeyboard,
    });

    const fromCtx = await conversation.waitForCallbackQuery(/^bridge_fc_/, {
      maxMilliseconds: STEP_TIMEOUT_MS,
    });
    await fromCtx.answerCallbackQuery();
    fromChain = fromCtx.callbackQuery.data.replace('bridge_fc_', '');

    if (fromChain === 'cancel') {
      await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
      return;
    }
  }

  // Step 2: Select destination chain
  let toChain = (prefill?.toChain as string) ?? '';
  if (!toChain) {
    const chainKeyboard = new InlineKeyboard();
    for (const c of CHAINS.filter((c) => c.name !== fromChain)) {
      chainKeyboard.text(c.name, `bridge_tc_${c.name}`);
    }
    chainKeyboard.row().text('❌ Cancel', 'bridge_tc_cancel');

    await ctx.reply(strings.bridge_select_to_chain, {
      parse_mode: 'HTML',
      reply_markup: chainKeyboard,
    });

    const toCtx = await conversation.waitForCallbackQuery(/^bridge_tc_/, {
      maxMilliseconds: STEP_TIMEOUT_MS,
    });
    await toCtx.answerCallbackQuery();
    toChain = toCtx.callbackQuery.data.replace('bridge_tc_', '');

    if (toChain === 'cancel') {
      await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
      return;
    }
  }

  // Step 3: Select token
  let token = (prefill?.token as string) ?? '';
  if (!token) {
    const bridgeTokens = POPULAR_TOKENS.filter((t) =>
      ['ETH', 'USDC', 'USDT', 'WETH'].includes(t.symbol),
    );
    const keyboard = new InlineKeyboard();
    for (const tk of bridgeTokens) {
      keyboard.text(tk.symbol, `bridge_tk_${tk.symbol}`);
    }
    keyboard.row().text('❌ Cancel', 'bridge_tk_cancel');

    await ctx.reply(strings.bridge_select_token, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });

    const tokenCtx = await conversation.waitForCallbackQuery(/^bridge_tk_/, {
      maxMilliseconds: STEP_TIMEOUT_MS,
      otherwise: (ctx) => ctx.reply(strings.wizard_select_token, { parse_mode: 'HTML' }),
    });
    await tokenCtx.answerCallbackQuery();
    token = tokenCtx.callbackQuery.data.replace('bridge_tk_', '');

    if (token === 'cancel') {
      await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
      return;
    }
  }

  // Step 4: Amount
  let amount = (prefill?.amount as string) ?? '';
  if (!amount) {
    await ctx.reply(strings.bridge_enter_amount, { parse_mode: 'HTML' });

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

  // Step 5: Confirmation
  const summary = typeof strings.bridge_summary === 'function'
    ? strings.bridge_summary(token, amount, fromChain, toChain)
    : `Bridge ${amount} ${token} from ${fromChain} to ${toChain}`;

  const confirmKeyboard = new InlineKeyboard()
    .text(strings.btn_confirm, 'bridge_confirm')
    .text(strings.btn_cancel, 'bridge_cancel_confirm');

  await ctx.reply(
    `${strings.wizard_confirm_details}\n\n${summary}`,
    { parse_mode: 'HTML', reply_markup: confirmKeyboard },
  );

  const confirmCtx = await conversation.waitForCallbackQuery(
    /^bridge_(confirm|cancel_confirm)$/,
    { maxMilliseconds: STEP_TIMEOUT_MS },
  );
  await confirmCtx.answerCallbackQuery();

  if (confirmCtx.callbackQuery.data === 'bridge_cancel_confirm') {
    await ctx.reply(strings.wizard_cancelled, { parse_mode: 'HTML' });
    return;
  }

  // Step 6: Execute
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
          await txTracker.track(chatId, result.transactionHash, 8453, 'bridge');
        }
      } catch {}
    } else {
      await ctx.reply(strings.wizard_failed, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text(strings.btn_back, 'open_menu'),
      });
    }
  } catch (error) {
    console.error('[Bridge] Execution failed:', error);
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
