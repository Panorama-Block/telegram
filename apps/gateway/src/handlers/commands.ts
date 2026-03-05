import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { parseEnv } from '../env.js';
import { AgentsClient } from '../clients/agentsClient.js';
import { TelegramIdentityClient } from '../clients/telegramIdentityClient.js';
import { incrementApiCall, incrementIdentityResolve, incrementMetric } from '../routes/metrics.js';
import { chunkTelegramText, formatForTelegram } from '../utils/telegramText.js';

type ReadyActionEvent = 'swap_intent_ready' | 'lending_intent_ready' | 'staking_intent_ready';

export function buildTelegramConversationId(chatId: number | string): string {
  return `tgchat:${String(chatId)}`;
}

function appendPath(basePathname: string, segment?: string): string {
  const base = (basePathname || '').replace(/\/+$/, '');
  if (!segment) return base || '/';
  const cleanSegment = segment.replace(/^\/+/, '');
  if (!base || base === '/') return `/${cleanSegment}`;
  return `${base}/${cleanSegment}`;
}

export function buildMiniappUrl(baseUrl: string, options?: { subPath?: string; search?: Record<string, string> }): string {
  const url = new URL(baseUrl);
  url.pathname = appendPath(url.pathname, options?.subPath);
  for (const [key, value] of Object.entries(options?.search ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function detectReadyActionEvent(metadata?: Record<string, unknown> | null): ReadyActionEvent | null {
  const event = typeof metadata?.event === 'string' ? metadata.event : '';
  if (event === 'swap_intent_ready') return event;
  if (event === 'lending_intent_ready') return event;
  if (event === 'staking_intent_ready') return event;
  return null;
}

function actionButtonLabel(event: ReadyActionEvent): string {
  if (event === 'swap_intent_ready') return 'Review Swap';
  if (event === 'lending_intent_ready') return 'Review Lending';
  return 'Review Staking';
}

export function buildActionKeyboard(baseWebappUrl: string, conversationId: string, telegramUserId: string, event: ReadyActionEvent): InlineKeyboard {
  const actionUrl = buildMiniappUrl(baseWebappUrl, {
    subPath: 'chat',
    search: {
      conversation_id: conversationId,
      telegram_user_id: telegramUserId,
      tma: '1',
    },
  });
  return new InlineKeyboard().webApp(actionButtonLabel(event), actionUrl);
}

interface CommandHandlerDeps {
  agentsClient?: AgentsClient;
  telegramIdentityClient?: TelegramIdentityClient;
}

export async function resolveGatewayUserId(
  telegramUserId: string,
  identityClient: TelegramIdentityClient,
): Promise<{ effectiveUserId: string; mode: 'found' | 'fallback' | 'error'; mappedUserId?: string; errorMessage?: string }> {
  const fallbackUserId = String(telegramUserId || '').trim();
  if (!fallbackUserId) {
    return { effectiveUserId: fallbackUserId, mode: 'fallback' };
  }

  try {
    const resolved = await identityClient.resolveUserId(fallbackUserId);
    if (resolved.found && resolved.zico_user_id) {
      return {
        effectiveUserId: resolved.zico_user_id,
        mode: 'found',
        mappedUserId: resolved.zico_user_id,
      };
    }
    return { effectiveUserId: fallbackUserId, mode: 'fallback' };
  } catch (error) {
    return {
      effectiveUserId: fallbackUserId,
      mode: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export function registerCommandHandlers(bot: Bot, deps: CommandHandlerDeps = {}) {
  const env = parseEnv();
  const agentsClient = deps.agentsClient ?? new AgentsClient();
  const telegramIdentityClient = deps.telegramIdentityClient ?? new TelegramIdentityClient();

  // Comando principal - apenas redireciona para miniapp
  bot.command('start', async (ctx) => {
    const fromId = ctx.from?.id;

    // Simple message with miniapp button
    const baseUrl = env.PUBLIC_WEBAPP_URL || env.PUBLIC_GATEWAY_URL;
    if (!baseUrl) {
      await ctx.reply('Miniapp URL is not configured. Please contact support.');
      return;
    }
    const webappUrl = buildMiniappUrl(baseUrl, {
      search: {
        telegram_user_id: String(fromId ?? ''),
        tma: '1',
      },
    });

    const keyboard = new InlineKeyboard().webApp('🚀 Open Panorama Block', webappUrl);

    await ctx.reply(
      '🎉 Welcome to Panorama Block!\n\n' +
      'Click the button below to access the miniapp and start trading:',
      { reply_markup: keyboard },
    );
  });

  bot.on('message:text', async (ctx) => {
    const text = (ctx.message?.text || '').trim();
    if (!text || text.startsWith('/')) return;

    const fromId = ctx.from?.id;
    const chatId = ctx.chat.id;
    const telegramUserId = String(fromId ?? chatId);
    const conversationId = buildTelegramConversationId(chatId);

    incrementMetric('totalMessages');
    if (typeof fromId === 'number') incrementMetric('totalUsers', fromId);
    if (typeof chatId === 'number') incrementMetric('totalChats', chatId);

    const logBase = {
      operation: 'telegram_message',
      telegram_user_id: fromId ?? null,
      chat_id: chatId,
      conversation_id: conversationId,
      username: ctx.from?.username ?? null,
    };
    console.log(JSON.stringify({ level: 'info', message: 'incoming_telegram_text', ...logBase }));

    try {
      incrementApiCall('agents');
      incrementApiCall('auth');
      const userResolution = await resolveGatewayUserId(telegramUserId, telegramIdentityClient);
      if (userResolution.mode === 'found') {
        incrementIdentityResolve('found');
        console.log(
          JSON.stringify({
            level: 'info',
            message: 'identity_resolve_found',
            ...logBase,
            mapped_user_id_suffix: userResolution.mappedUserId?.slice(-6) ?? null,
          }),
        );
      } else if (userResolution.mode === 'error') {
        incrementIdentityResolve('error');
        console.warn(
          JSON.stringify({
            level: 'warn',
            message: 'identity_resolve_error',
            ...logBase,
            error: userResolution.errorMessage ?? 'unknown',
            auth_api_base: process.env.AUTH_API_BASE ?? null,
          }),
        );
      } else {
        incrementIdentityResolve('fallback');
        console.log(JSON.stringify({ level: 'info', message: 'identity_resolve_fallback', ...logBase }));
      }

      const response = await agentsClient.chat({
        message: { role: 'user', content: text },
        user_id: userResolution.effectiveUserId,
        conversation_id: conversationId,
        metadata: {
          source: 'telegram-gateway',
          telegram_user_id: fromId ?? null,
          telegram_chat_id: chatId,
          telegram_username: ctx.from?.username ?? null,
          sent_at: new Date().toISOString(),
        },
      });

      const replyText =
        response.message && response.message.trim().length > 0
          ? response.message
          : 'I could not generate a response right now. Please try again.';
      const formattedReply = formatForTelegram(replyText);
      const replyChunks = chunkTelegramText(formattedReply);
      console.log(
        JSON.stringify({
          level: 'info',
          message: 'telegram_reply_formatted',
          ...logBase,
          chunks: replyChunks.length,
        }),
      );

      const event = detectReadyActionEvent(response.metadata);
      const baseUrl = env.PUBLIC_WEBAPP_URL || env.PUBLIC_GATEWAY_URL;

      if (event && baseUrl) {
        const keyboard = buildActionKeyboard(baseUrl, conversationId, telegramUserId, event);
        for (let i = 0; i < replyChunks.length; i++) {
          const chunk = replyChunks[i];
          if (!chunk) continue;
          if (i === replyChunks.length - 1) {
            await ctx.reply(chunk, { reply_markup: keyboard });
          } else {
            await ctx.reply(chunk);
          }
        }
        incrementMetric('totalActions');
        console.log(JSON.stringify({ level: 'info', message: 'telegram_action_ready', ...logBase, event }));
      } else {
        for (const chunk of replyChunks) {
          if (!chunk) continue;
          await ctx.reply(chunk);
        }
      }

      console.log(
        JSON.stringify({
          level: 'info',
          message: 'telegram_reply_sent',
          ...logBase,
          agent_name: response.agent_name ?? null,
          has_metadata: Boolean(response.metadata),
        }),
      );
    } catch (error) {
      incrementMetric('totalErrors');
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'telegram_message_handling_failed',
          ...logBase,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      await ctx.reply('Sorry, I could not get a response right now. Please try again in a moment.');
    }
  });
}
