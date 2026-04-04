import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../bot/context.js';
import { t, detectLanguage } from '../i18n/index.js';
import { defaultSession } from '../bot/context.js';
import { sendMenu } from '../commands/menu.js';
import { sendWalletInfo, handleDeposited } from '../commands/wallet.js';
import { DcaClient } from '../clients/dcaClient.js';

/**
 * Central callback query dispatcher.
 * Routes callback_data by prefix to the appropriate handler.
 */
export async function handleCallbackQuery(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    // Language selection
    if (data === 'lang_en' || data === 'lang_pt') {
      ctx.session.language = data === 'lang_pt' ? 'pt' : 'en';
      await ctx.answerCallbackQuery({ text: data === 'lang_pt' ? 'Idioma: Português' : 'Language: English' });
      // Show create wallet or menu depending on onboarding state
      if (!ctx.session.onboardingComplete) {
        const strings = t(ctx.session.language);
        await ctx.editMessageText(
          `${strings.welcome_title}\n\n${strings.welcome_body}`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: strings.btn_create_wallet, callback_data: 'create_wallet' }],
                [{ text: strings.btn_skip, callback_data: 'skip_onboarding' }],
              ],
            },
          },
        );
      }
      return;
    }

    // Create wallet
    if (data === 'create_wallet') {
      await ctx.answerCallbackQuery();
      // This will be handled by the wallet command
      await sendWalletInfo(ctx, true);
      return;
    }

    // Skip onboarding
    if (data === 'skip_onboarding') {
      ctx.session.onboardingComplete = true;
      await ctx.answerCallbackQuery();
      await sendMenu(ctx);
      return;
    }

    // Check deposit
    if (data === 'check_deposit') {
      await handleDeposited(ctx);
      return;
    }

    // Menu navigation
    if (data === 'open_menu') {
      await ctx.answerCallbackQuery();
      await sendMenu(ctx);
      return;
    }

    // Settings: language
    if (data === 'settings_lang') {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(t(ctx.session.language).settings_title, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🇺🇸 English', callback_data: 'lang_en' },
              { text: '🇧🇷 Português', callback_data: 'lang_pt' },
            ],
            [{ text: t(ctx.session.language).btn_back, callback_data: 'open_menu' }],
          ],
        },
      });
      return;
    }

    // Intent confirmation from AI chat (Phase 2)
    if (data.startsWith('intent_')) {
      await handleIntentCallback(ctx, data);
      return;
    }

    // Execute confirmed intent (Phase 2)
    if (data.startsWith('exec_')) {
      await handleExecCallback(ctx, data);
      return;
    }

    // DeFi operation callbacks (Phase 3 wizards)
    if (data.startsWith('swap_') || data.startsWith('stake_') || data.startsWith('lend_') ||
        data.startsWith('dca_') || data.startsWith('bridge_')) {
      await ctx.answerCallbackQuery({ text: 'Coming soon!' });
      return;
    }

    // Unknown callback
    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error('[Callback] Error handling callback:', data, error);
    await ctx.answerCallbackQuery({ text: 'Error processing action' }).catch(() => {});
  }
}

const INTENT_LABELS: Record<string, { en: string; pt: string }> = {
  swap:   { en: '🔄 Swap',   pt: '🔄 Swap' },
  stake:  { en: '📈 Stake',  pt: '📈 Stake' },
  lend:   { en: '💰 Lend',   pt: '💰 Lending' },
  dca:    { en: '🔁 DCA',    pt: '🔁 DCA' },
  bridge: { en: '🌉 Bridge', pt: '🌉 Bridge' },
};

const INTENT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Handle intent_* callbacks from AI chat action buttons.
 * Shows a confirmation card with intent params, then either
 * executes via dca-service or queues for Phase 3 wizard.
 */
async function handleIntentCallback(ctx: BotContext, data: string): Promise<void> {
  const strings = t(ctx.session.language);
  const intentType = data.replace('intent_', '') as 'swap' | 'stake' | 'lend' | 'dca' | 'bridge';
  const label = INTENT_LABELS[intentType]?.[ctx.session.language] ?? intentType;

  await ctx.answerCallbackQuery();

  // Check wallet
  if (!ctx.session.smartAccountAddress) {
    await ctx.reply(strings.chat_no_wallet, { parse_mode: 'HTML' });
    return;
  }

  // Check if intent is still fresh
  const intent = ctx.session.lastIntent;
  if (!intent || intent.type !== intentType || Date.now() - intent.timestamp > INTENT_EXPIRY_MS) {
    await ctx.reply(
      strings.intent_expired ?? '⏰ This action has expired. Please describe what you want to do again.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  // Build confirmation card with intent params
  const paramLines = formatIntentParams(intent.params, ctx.session.language);
  const confirmText =
    `${strings.intent_confirm_title ?? `⚡ <b>${label} — Confirm</b>`}\n\n` +
    `${paramLines}\n\n` +
    `${strings.intent_confirm_body ?? 'Review the details above. Tap Confirm to proceed.'}`;

  const keyboard = new InlineKeyboard()
    .text(strings.btn_confirm, `exec_${intentType}`)
    .text(strings.btn_cancel, 'open_menu');

  await ctx.reply(confirmText, { parse_mode: 'HTML', reply_markup: keyboard });
}

const dcaClient = new DcaClient();

/**
 * Handle exec_* callbacks — user confirmed an intent, execute the transaction.
 * In Phase 2 this sends a placeholder execution via dca-service signAndExecute.
 * Phase 3 will replace this with full wizard conversations.
 */
async function handleExecCallback(ctx: BotContext, data: string): Promise<void> {
  const strings = t(ctx.session.language);
  const intentType = data.replace('exec_', '');

  await ctx.answerCallbackQuery();

  const address = ctx.session.smartAccountAddress;
  if (!address) {
    await ctx.reply(strings.intent_no_wallet, { parse_mode: 'HTML' });
    return;
  }

  const intent = ctx.session.lastIntent;
  if (!intent || intent.type !== intentType) {
    await ctx.reply(strings.intent_expired, { parse_mode: 'HTML' });
    return;
  }

  await ctx.reply(strings.intent_executing, { parse_mode: 'HTML' });

  try {
    const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');

    // Phase 2: delegate to dca-service signAndExecute with intent params
    // Phase 3 will use protocol-specific services (swap-service, lido-service, etc.)
    const txResult = await dcaClient.signAndExecute(
      address,
      userId,
      (intent.params.to as string) ?? address,
      (intent.params.value as string) ?? '0',
      (intent.params.data as string) ?? '0x',
      ctx.session.defaultChainId,
    );

    if (txResult.success) {
      const txHashText = typeof strings.intent_tx_hash === 'function'
        ? strings.intent_tx_hash(txResult.transactionHash)
        : `🔗 Tx: <code>${txResult.transactionHash}</code>`;

      await ctx.reply(
        `${strings.intent_success}\n\n${txHashText}`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .url(strings.btn_view_tx, `https://basescan.org/tx/${txResult.transactionHash}`)
            .row()
            .text(strings.btn_back, 'open_menu'),
        },
      );
    } else {
      await ctx.reply(strings.intent_failed, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text(strings.btn_back, 'open_menu'),
      });
    }

    // Clear consumed intent
    ctx.session.lastIntent = undefined;
    ctx.session.wizardData = undefined;
  } catch (error) {
    console.error('[Exec] Transaction execution failed:', error);
    await ctx.reply(strings.intent_failed, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text(strings.btn_back, 'open_menu'),
    });
  }
}

/**
 * Format intent params as readable lines for confirmation card.
 */
function formatIntentParams(params: Record<string, unknown>, lang: 'en' | 'pt'): string {
  if (!params || Object.keys(params).length === 0) {
    return lang === 'pt' ? '<i>Nenhum parâmetro detectado</i>' : '<i>No parameters detected</i>';
  }

  const lines: string[] = [];
  const labelMap: Record<string, { en: string; pt: string }> = {
    fromToken:   { en: 'From',        pt: 'De' },
    toToken:     { en: 'To',          pt: 'Para' },
    amount:      { en: 'Amount',      pt: 'Quantidade' },
    token:       { en: 'Token',       pt: 'Token' },
    chain:       { en: 'Chain',       pt: 'Rede' },
    fromChain:   { en: 'From Chain',  pt: 'Rede Origem' },
    toChain:     { en: 'To Chain',    pt: 'Rede Destino' },
    protocol:    { en: 'Protocol',    pt: 'Protocolo' },
    frequency:   { en: 'Frequency',   pt: 'Frequência' },
    duration:    { en: 'Duration',    pt: 'Duração' },
    slippage:    { en: 'Slippage',    pt: 'Slippage' },
  };

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    const label = labelMap[key]?.[lang] ?? key;
    lines.push(`• <b>${label}:</b> ${String(value)}`);
  }

  return lines.length > 0 ? lines.join('\n') : (lang === 'pt' ? '<i>Parâmetros pendentes</i>' : '<i>Parameters pending</i>');
}
