import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';

import { AgentsClient } from '../clients/agentsClient.js';
import { getRedisClient } from '../redis/client.js';
import { getConversationId, setConversationId } from '../repos/conversations.js';
import { ChatLock } from '../utils/locks.js';
import { StructuredLogger, measureTime } from '../utils/logger.js';
import { incrementMetric, incrementApiCall } from '../routes/metrics.js';

export function registerChatHandlers(bot: Bot) {
  bot.on('message:text', async (ctx) => {
    const text = (ctx.message?.text ?? '').trim();
    if (!text) return;
    // ignore comandos aqui; serão tratados em etapa dedicada
    if (text.startsWith('/')) return;

    const chatId = ctx.chat?.id ?? 0;
    const telegramUserId = ctx.from?.id ?? 0;
    const conversationStableId = `tg:${chatId}`;
    const userStableId = `tg_user:${telegramUserId || chatId}`;

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
        const res = await agents.chat({
          user_id: userStableId,
          conversation_id: conversationStableId,
          prompt: text,
          metadata: {
            channel: 'telegram',
            chat_id: chatId,
            telegram_user_id: telegramUserId,
          },
        });

        // Responder com inline keyboard se há ações requeridas
        if (res.requires_action && res.actions && res.actions.length > 0) {
          const keyboard = new InlineKeyboard();
          
          // Adicionar botões para cada ação
          res.actions.forEach((action, index) => {
            const callbackData = `action:${action.type}:${index}:${Date.now()}`;
            keyboard.text(action.label, callbackData);
            if (index % 2 === 1) keyboard.row(); // Nova linha a cada 2 botões
          });
          
          await ctx.reply(res.message ?? '', { reply_markup: keyboard });
        } else {
          await ctx.reply(res.message ?? '');
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


