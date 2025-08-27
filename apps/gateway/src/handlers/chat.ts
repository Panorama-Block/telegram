import type { Bot } from 'grammy';

import { AgentsClient } from '../clients/agentsClient';
import { getRedisClient } from '../redis/client';
import { getConversationId, setConversationId } from '../repos/conversations';

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

    try {
      const redis = getRedisClient();
      const existingConv = await getConversationId(redis, chatId);
      if (!existingConv) {
        await setConversationId(redis, chatId, conversationStableId);
      }

      await ctx.api.sendChatAction(chatId, 'typing');

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

      await ctx.reply(res.message ?? '');
      // TODO: se requires_action, renderizar inline keyboard (etapas posteriores)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('erro no proxy de chat', err);
      await ctx.reply('Desculpe, ocorreu um erro ao processar sua mensagem.');
    }
  });
}


