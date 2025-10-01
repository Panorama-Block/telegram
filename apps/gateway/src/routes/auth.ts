import { FastifyInstance } from 'fastify';
import { Api } from 'grammy';
import { getRedisClient } from '../redis/client.js';
import { saveLink } from '../repos/links.js';
import { getLastChat } from '../repos/lastChat.js';
import { getLink } from '../repos/links.js';
import { getLinkSuccessText, getTutorialMessages } from '../utils/messages.js';
import { verifyTelegramAuth } from '../services/authService.js';
import path from 'path';
import fs from 'fs/promises';

export async function registerAuthRoutes(app: FastifyInstance) {
  const env = process.env;

  // Static files are already registered in server.ts

  app.get('/auth/telegram', async (req, reply) => {
    const { telegram_user_id } = req.query as { telegram_user_id?: string };
    
    if (!telegram_user_id) {
      return reply.code(400).send('telegram_user_id é obrigatório');
    }

    // Serve the professional auth page
    const authPagePath = path.join(__dirname, '../views/auth.html');
    const authPage = await fs.readFile(authPagePath, 'utf-8');
    
    return reply.type('text/html').send(authPage);
  });

  app.post('/auth/telegram/init-data', async (req, reply) => {
    try {
      const { initData } = req.body as { initData: string };
      
      if (!initData) {
        return reply.code(400).send({ error: 'initData é obrigatório' });
      }

      console.log('🔐 [AUTH] Verifying Telegram initData...', { initData: initData.substring(0, 50) + '...' });

      // Mock verification - in production, verify the initData
      const mockUser = {
        id: '123456789',
        username: 'testuser',
        language_code: 'pt',
        auth_date: Math.floor(Date.now() / 1000),
        valid: true
      };

      return reply.send(mockUser);
    } catch (err) {
      req.log.error({ err }, 'falha em /auth/telegram/init-data');
      return reply.code(400).send({ error: 'initData inválido' });
    }
  });

  app.get('/debug/link/:userId', async (req, reply) => {
    try {
      const { userId } = req.params as { userId: string };
      const redis = getRedisClient();
      const link = await getLink(redis, parseInt(userId));
      return reply.send({ userId, link });
    } catch (err) {
      return reply.code(500).send({ error: 'Debug failed', details: err });
    }
  });

  app.post('/auth/telegram/verify', async (req, reply) => {
    try {
      const { address, sessionKeyAddress, loginPayload, signature, telegram_user_id } = req.body as {
        address: string;
        sessionKeyAddress: string;
        loginPayload: string;
        signature: string;
        telegram_user_id: string;
      };

      if (!address || !sessionKeyAddress || !loginPayload || !signature || !telegram_user_id) {
        return reply.code(400).send({ error: 'Dados de autenticação incompletos' });
      }

      console.log('🔐 [AUTH] Verifying authentication...', {
        address,
        sessionKeyAddress,
        telegram_user_id
      });

      // Verify the authentication
      const result = await verifyTelegramAuth({
        address,
        sessionKeyAddress,
        loginPayload,
        signature,
        telegram_user_id
      });

      if (!result.valid) {
        return reply.code(401).send({ error: 'Autenticação inválida' });
      }

      // Save the link
      const zicoUserId = result.zico_user_id;
      const redis = getRedisClient();
      const linkData = {
        telegram_user_id: parseInt(result.id),
        zico_user_id: zicoUserId,
        username: result.username ?? null,
        language_code: result.language_code ?? null,
        linked_at: Math.floor(Date.now() / 1000),
        status: 'linked' as const,
      };
      
      console.log('🔗 [AUTH] Saving link:', linkData);
      await saveLink(redis, linkData);
      console.log('✅ [AUTH] Link saved successfully');

      // Try to notify user in their last chat with the bot
      try {
        const telegramUserId = parseInt(result.id);
        console.log('🔍 [AUTH] Looking for last chat for user:', telegramUserId);
        const lastChatId = await getLastChat(getRedisClient(), telegramUserId);
        console.log('📱 [AUTH] Last chat ID for user:', telegramUserId, 'is:', lastChatId);
        if (lastChatId) {
          const api = new Api(env.TELEGRAM_BOT_TOKEN!);
          console.log('📤 [AUTH] Sending success message to chat:', lastChatId);
          await api.sendMessage(lastChatId, getLinkSuccessText(zicoUserId), { parse_mode: 'Markdown' });
          for (const msg of getTutorialMessages()) {
            await api.sendMessage(lastChatId, msg);
          }
        } else {
          console.log('⚠️ [AUTH] No last chat found for user:', telegramUserId);
          console.log('💡 [AUTH] User needs to send /start first to save last chat');
        }
      } catch (e) {
        console.error('❌ [AUTH] Failed to send link notification:', e);
        req.log.warn({ err: e }, 'failed to send link notification');
      }

      return reply.send({
        telegram_user_id: result.id,
        username: result.username ?? null,
        language_code: result.language_code ?? null,
        auth_date: result.auth_date,
        valid: true,
        zico_user_id: zicoUserId,
      });
    } catch (err) {
      req.log.error({ err }, 'falha em /auth/telegram/verify');
      return reply.code(400).send({ error: 'payload inválido' });
    }
  });
}