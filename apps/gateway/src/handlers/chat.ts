import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';

import { AgentsClient } from '../clients/agentsClient.js';
import { getRedisClient } from '../redis/client.js';
import { getConversationId, setConversationId } from '../repos/conversations.js';
import { ChatLock } from '../utils/locks.js';
import { StructuredLogger, measureTime } from '../utils/logger.js';
import { incrementMetric, incrementApiCall } from '../routes/metrics.js';
import { getLink } from '../repos/links.js';
import { getSession, saveSession } from '../repos/sessions.js';
import { AuthClient, decodeJwtExp } from '../clients/authClient.js';
import { parseEnv } from '../env.js';

export function registerChatHandlers(bot: Bot) {
  bot.on('message:text', async (ctx) => {
    const text = (ctx.message?.text ?? '').trim();
    if (!text) return;
    // ignore comandos aqui; serão tratados em etapa dedicada
    if (text.startsWith('/')) return;

    const chatId = ctx.chat?.id ?? 0;
    const telegramUserId = ctx.from?.id ?? 0;
    const conversationStableId = `tg:${chatId}`;

    const redis = getRedisClient();
    const lock = new ChatLock(redis);

    // Usar lock para evitar mensagens duplicadas/concorrentes no mesmo chat
    const result = await lock.withLock(chatId, async () => {
      const timer = measureTime();
      const logger = new StructuredLogger();
      
      try {
        // Métricas
        incrementMetric('totalMessages');
        incrementMetric('totalUsers', telegramUserId);
        incrementMetric('totalChats', chatId);

        // Determinar identidade e sessão (auto-link via Auth se possível)
        let link = await getLink(redis, telegramUserId);
        const now = Math.floor(Date.now() / 1000);
        let jwt: string | undefined;
        if (!link && process.env['AUTH_API_BASE']) {
          try {
            const auth = new AuthClient();
            // tenta exchange; se não existir, registra
            let ex;
            try {
              ex = await auth.exchangeTelegram({ telegramUserId });
            } catch {
              ex = await auth.registerTelegram({
                telegramUserId,
                profile: {
                  username: ctx.from?.username ?? null,
                  language_code: (ctx.from as any)?.language_code ?? null,
                  first_name: ctx.from?.first_name ?? null,
                  last_name: ctx.from?.last_name ?? null,
                },
              });
            }
            // salvar link e sessão
            link = {
              telegram_user_id: telegramUserId,
              zico_user_id: ex.userId,
              username: ctx.from?.username ?? null,
              language_code: (ctx.from as any)?.language_code ?? null,
              linked_at: now,
              status: 'linked',
            };
            await saveSession(redis, {
              zico_user_id: ex.userId,
              channel: 'telegram',
              chat_id: chatId,
              jwt: ex.jwt,
              expires_at: decodeJwtExp(ex.jwt) ?? now + 3600,
            });
          } catch {
            // ok, segue como anônimo
          }
        }

        // resolver userStableId e JWT a partir do link/sessão
        const userStableId = link && link.status === 'linked' ? link.zico_user_id : `tg_user:${telegramUserId || chatId}`;
        if (link && link.status === 'linked') {
          const sess = await getSession(redis, link.zico_user_id, chatId);
          if (sess && sess.expires_at > now) {
            jwt = sess.jwt;
          }
        }

        logger.chatOperation('message_received', {
          chatId,
          userId: telegramUserId,
          conversationId: conversationStableId,
        });
        const existingConv = await getConversationId(redis, chatId);
        if (!existingConv) {
          await setConversationId(redis, chatId, conversationStableId);
        }

        await ctx.api.sendChatAction(chatId, 'typing');

        // Incrementar métrica de chamada API
        incrementApiCall('agents');
        
        const agents = new AgentsClient();
        const env = parseEnv();
        const walletAddress = env.DEFAULT_WALLET_ADDRESS ?? '0x0000000000000000000000000000000000000000';
        const res = await agents.chat({
          user_id: userStableId,
          conversation_id: conversationStableId,
          message: text,
          chain_id: String(env.DEFAULT_CHAIN_ID),
          wallet_address: walletAddress,
          metadata: {
            channel: 'telegram',
            chat_id: chatId,
            telegram_user_id: telegramUserId,
          },
        }, { jwt });

        // Responder com inline keyboard se há ações requeridas
        const safeMsg = (res.message ?? '').toString().trim();
        const loggerMeta = {
          hasMessage: Boolean(safeMsg.length),
          requires_action: Boolean(res.requires_action),
          actions_len: Array.isArray(res.actions) ? res.actions.length : 0,
        };
        if (res.requires_action && res.actions && res.actions.length > 0) {
          const keyboard = new InlineKeyboard();
          
          // Adicionar botões para cada ação
          res.actions.forEach((action, index) => {
            const callbackData = `action:${action.type}:${index}:${Date.now()}`;
            keyboard.text(action.label, callbackData);
            if (index % 2 === 1) keyboard.row(); // Nova linha a cada 2 botões
          });
          
          const sent = await ctx.reply(safeMsg || 'Selecione uma opção abaixo:', { reply_markup: keyboard });
          new StructuredLogger().info('reply_sent', { ...loggerMeta, message_id: sent.message_id, chatId });
        } else {
          const sent = await ctx.reply(safeMsg || '…');
          new StructuredLogger().info('reply_sent', { ...loggerMeta, message_id: sent.message_id, chatId });
        }

        // Log de performance
        const duration = timer();
        logger.performance('chat_message_processed', duration, {
          chatId,
          userId: telegramUserId,
          conversationId: conversationStableId,
        });

        return true;
      } catch (err) {
        incrementMetric('totalErrors');
        logger.error('erro no proxy de chat', {
          chatId,
          userId: telegramUserId,
          conversationId: conversationStableId,
          error: err as Error,
        });
        await ctx.reply('Desculpe, ocorreu um erro ao processar sua mensagem.');
        return false;
      }
    });

    // Se lock não foi adquirido, mensagem já está sendo processada
    if (result === null) {
      await ctx.reply('⏳ Processando mensagem anterior...');
    }
  });

  // Handler para callback queries de ações
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    
    // Parse callback data: action:type:index:timestamp
    if (data.startsWith('action:')) {
      const [, actionType, actionIndex, timestamp] = data.split(':');
      
      await ctx.answerCallbackQuery(`Executando ${actionType}...`);
      
      // TODO: Implementar lógica específica por tipo de ação
      // Por enquanto, apenas confirma a ação
      await ctx.reply(`✅ Ação "${actionType}" executada com sucesso!`);
      
      // Log da ação
      incrementMetric('totalActions');
      const logger = new StructuredLogger();
      logger.info('Ação executada', {
        action: actionType,
        actionIndex: Number(actionIndex),
        timestamp: Number(timestamp),
        userId: ctx.from?.id,
        chatId: ctx.chat?.id,
      });
    }
  });
}
