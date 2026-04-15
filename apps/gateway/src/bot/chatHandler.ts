import { InlineKeyboard } from 'grammy';
import type { BotContext } from './context.js';
import type { ChatResponse } from '../clients/agentsClient.js';
import { AgentsClient } from '../clients/agentsClient.js';
import { TelegramIdentityClient } from '../clients/telegramIdentityClient.js';
import { parseEnv } from '../env.js';
import { formatForTelegramHtml, chunkMessage } from '../formatters/html.js';
import { t } from '../i18n/index.js';
import { incrementApiCall, incrementIdentityResolve, incrementMetric } from '../routes/metrics.js';
import {
  buildTelegramConversationId,
  resolveGatewayUserId,
  detectReadyActionEvent,
  buildActionKeyboard,
} from '../handlers/commands.js';

const agentsClient = new AgentsClient();
const identityClient = new TelegramIdentityClient();

/** Map agent action types to in-chat callback prefixes. */
const ACTION_TYPE_MAP: Record<string, string> = {
  swap: 'intent_swap',
  stake: 'intent_stake',
  lend: 'intent_lend',
  dca: 'intent_dca',
  bridge: 'intent_bridge',
  deposit: 'create_wallet',
  portfolio: 'portfolio_view',
};

/** Intent types that can be stored in session for wizard pre-fill. */
const WIZARD_INTENT_TYPES = new Set(['swap', 'stake', 'lend', 'dca', 'bridge']);

/**
 * Build an inline keyboard from agent-provided actions.
 * Falls back to miniapp deep link if no structured actions are available.
 */
function buildActionsKeyboard(
  response: ChatResponse,
  conversationId: string,
  telegramUserId: string,
  strings: ReturnType<typeof t>,
): InlineKeyboard | null {
  // 1) Use structured actions from agent response
  if (response.actions && response.actions.length > 0) {
    const keyboard = new InlineKeyboard();
    for (const action of response.actions) {
      const callbackPrefix = ACTION_TYPE_MAP[action.type];
      if (callbackPrefix) {
        keyboard.text(action.label || strings.btn_confirm, callbackPrefix);
      }
    }
    return keyboard.row().text(strings.btn_cancel, 'open_menu');
  }

  // 2) Fallback: check metadata for legacy intent events → miniapp deep link
  const event = detectReadyActionEvent(response.metadata);
  if (event) {
    const env = parseEnv();
    const baseUrl = env.PUBLIC_WEBAPP_URL || env.PUBLIC_GATEWAY_URL;
    if (baseUrl) {
      const miniappKeyboard = buildActionKeyboard(baseUrl, conversationId, telegramUserId, event);

      // Also add an in-chat button for the same intent
      const intentType = event.replace('_intent_ready', '') as 'swap' | 'stake' | 'lend';
      const callbackData = ACTION_TYPE_MAP[intentType];
      if (callbackData) {
        miniappKeyboard.row().text(
          `⚡ ${strings.btn_execute_in_chat ?? 'Execute in Chat'}`,
          callbackData,
        );
      }

      return miniappKeyboard;
    }
  }

  return null;
}

/**
 * Store agent intent data in session for Phase 3 wizard pre-fill.
 */
function storeIntentInSession(ctx: BotContext, response: ChatResponse): void {
  if (!response.actions || response.actions.length === 0) return;

  const primaryAction = response.actions[0];
  if (!primaryAction || !WIZARD_INTENT_TYPES.has(primaryAction.type)) return;

  const intentType = primaryAction.type as 'swap' | 'stake' | 'lend' | 'dca' | 'bridge';
  const params = (primaryAction.payload as Record<string, unknown>) ?? {};

  ctx.session.lastIntent = {
    type: intentType,
    params,
    timestamp: Date.now(),
  };

  // Also store in wizardData for backward compat
  ctx.session.wizardData = {
    intent: intentType,
    ...params,
  };
}

/**
 * Handle free-text messages by forwarding to the AI agents API.
 * Enhanced with HTML formatting, structured actions, and intent-to-wizard bridge.
 */
export async function handleTextMessage(ctx: BotContext): Promise<void> {
  const text = (ctx.message?.text || '').trim();
  if (!text || text.startsWith('/')) return;

  const fromId = ctx.from?.id;
  const chatId = ctx.chat!.id;
  const telegramUserId = String(fromId ?? chatId);
  const conversationId = buildTelegramConversationId(chatId);
  const strings = t(ctx.session.language);

  incrementMetric('totalMessages');
  if (typeof fromId === 'number') incrementMetric('totalUsers', fromId);
  if (typeof chatId === 'number') incrementMetric('totalChats', chatId);

  try {
    incrementApiCall('agents');
    incrementApiCall('auth');

    const userResolution = await resolveGatewayUserId(telegramUserId, identityClient);
    if (userResolution.mode === 'found') {
      incrementIdentityResolve('found');
    } else if (userResolution.mode === 'error') {
      incrementIdentityResolve('error');
    } else {
      incrementIdentityResolve('fallback');
    }

    const response = await agentsClient.chat({
      message: { role: 'user', content: text },
      user_id: userResolution.effectiveUserId,
      conversation_id: conversationId,
      wallet_address: ctx.session.smartAccountAddress,
      metadata: {
        source: 'telegram-gateway',
        telegram_user_id: fromId ?? null,
        telegram_chat_id: chatId,
        telegram_username: ctx.from?.username ?? null,
        language: ctx.session.language,
        has_smart_account: Boolean(ctx.session.smartAccountAddress),
        sent_at: new Date().toISOString(),
      },
    });

    const replyText = response.message?.trim() || strings.chat_error;
    const formattedReply = formatForTelegramHtml(replyText);
    const replyChunks = chunkMessage(formattedReply);

    // Store intent data in session for wizard pre-fill
    storeIntentInSession(ctx, response);

    // Build action keyboard (structured actions or legacy miniapp fallback)
    const actionKeyboard = buildActionsKeyboard(response, conversationId, telegramUserId, strings);

    // Agent attribution prefix
    const agentLabel = response.agent_name
      ? `<i>🤖 ${response.agent_name}</i>\n\n`
      : '';

    for (let i = 0; i < replyChunks.length; i++) {
      const chunk = replyChunks[i];
      if (!chunk) continue;

      const isFirst = i === 0;
      const isLast = i === replyChunks.length - 1;
      const content = isFirst ? `${agentLabel}${chunk}` : chunk;

      if (isLast && actionKeyboard) {
        await ctx.reply(content, { parse_mode: 'HTML', reply_markup: actionKeyboard });
        incrementMetric('totalActions');
      } else {
        await ctx.reply(content, { parse_mode: 'HTML' });
      }
    }
  } catch (error) {
    incrementMetric('totalErrors');
    console.error('[Chat] Message handling failed:', error);
    await ctx.reply(strings.chat_error, { parse_mode: 'HTML' });
  }
}
