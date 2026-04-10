import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../bot/context.js';
import { t } from '../i18n/index.js';
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
      const strings = t(ctx.session.language);
      if (!ctx.session.smartAccountAddress) {
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
        ).catch((e) => console.error('[Callback] editMessageText failed:', e));
      } else {
        await sendMenu(ctx);
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

    // Switch active wallet mode
    if (data === 'wallet_use_smart') {
      if (!ctx.session.smartAccountAddress) {
        await ctx.answerCallbackQuery({ text: 'No PanoramaBlock Wallet yet' });
        return;
      }
      ctx.session.walletMode = 'smart';
      await ctx.answerCallbackQuery({ text: '✅ PanoramaBlock Wallet active' });
      const { sendWalletStatus } = await import('../commands/wallet.js');
      await sendWalletStatus(ctx);
      return;
    }
    if (data === 'wallet_use_external') {
      if (!ctx.session.externalWallet) {
        await ctx.answerCallbackQuery({ text: 'No external wallet connected' });
        return;
      }
      ctx.session.walletMode = 'external';
      await ctx.answerCallbackQuery({ text: '✅ External wallet active' });
      const { sendWalletStatus } = await import('../commands/wallet.js');
      await sendWalletStatus(ctx);
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

    // Wallet
    if (data === 'open_wallet') {
      await ctx.answerCallbackQuery();
      await sendWalletInfo(ctx, false);
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

    // DeFi wizard entry from menu buttons (swap_start, stake_start, etc.)
    if (data === 'swap_start' || data === 'stake_start' || data === 'lend_start' ||
        data === 'dca_start' || data === 'bridge_start') {
      const wizardName = data.replace('_start', '');
      await ctx.answerCallbackQuery();
      await ctx.conversation.enter(wizardName);
      return;
    }

    // Unknown callback
    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error('[Callback] Error handling callback:', data, error);
    await ctx.answerCallbackQuery({ text: 'Error processing action' }).catch(() => {});
  }
}

const INTENT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Handle intent_* callbacks from AI chat action buttons.
 * Enters the corresponding wizard conversation with pre-filled data from session.
 */
async function handleIntentCallback(ctx: BotContext, data: string): Promise<void> {
  const strings = t(ctx.session.language);
  const intentType = data.replace('intent_', '') as 'swap' | 'stake' | 'lend' | 'dca' | 'bridge';

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

  // Enter wizard with pre-filled data already in session.wizardData
  await ctx.conversation.enter(intentType);
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

