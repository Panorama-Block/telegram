import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { parseEnv } from '../env.js';
import { AuthClient, decodeJwtExp } from '../clients/authClient.js';
import { getRedisClient } from '../redis/client.js';
import { saveLink } from '../repos/links.js';
import { saveSession } from '../repos/sessions.js';
import {
  computeHmacHex,
  deriveSecretKey,
  parseInitDataString,
  validateInitDataBody,
} from '../utils/telegramInitData.js';
import { getLastChat } from '../repos/lastChat.js';
import { Api } from 'grammy';
import { getLinkSuccessText, getTutorialMessages } from '../utils/onboarding.js';

export async function registerAuthRoutes(app: FastifyInstance) {
  const env = parseEnv();

  app.post('/auth/telegram/verify', async (req, reply) => {
    try {
      const body = validateInitDataBody(req.body);
      const { dataCheckString, hash, authDate, user } = parseInitDataString(body.initData);

      // anti‑replay
      const now = Math.floor(Date.now() / 1000);
      const maxAge = env.TELEGRAM_INITDATA_MAX_AGE_SECONDS;
      if (now - authDate > maxAge) {
        return reply.code(401).send({ error: 'initData expirado' });
      }

      // HMAC
      const secretKey = deriveSecretKey(env.TELEGRAM_BOT_TOKEN);
      const calc = computeHmacHex(secretKey, dataCheckString);
      if (calc !== hash) {
        return reply.code(401).send({ error: 'assinatura inválida' });
      }

      const result = z
        .object({ id: z.number(), username: z.string().optional(), language_code: z.string().optional() })
        .parse(user);

      // Integração com Auth: se indisponível, fazer fallback local para liberar o Miniapp
      let zicoUserId: string;
      try {
        if (parseEnv().AUTH_API_BASE) {
          const client = new AuthClient();
          let auth = await client
            .exchangeTelegram({ telegramUserId: result.id })
            .catch(async () =>
              client.registerTelegram({
                telegramUserId: result.id,
                profile: { username: result.username ?? null, language_code: result.language_code ?? null },
              }),
            );
          // Se chegou aqui, Auth respondeu OK
          const _exp = decodeJwtExp(auth.jwt); // atualmente não usado neste endpoint
          zicoUserId = auth.userId;
        } else {
          // Auth não configurado: fallback local
          zicoUserId = `local:tg:${result.id}`;
        }
      } catch (e) {
        // Auth falhou (timeout/erro): fallback local para não bloquear a UI
        req.log.warn({ err: e }, 'Auth unavailable, using local fallback for miniapp verify');
        zicoUserId = `local:tg:${result.id}`;
      }

      const redis = getRedisClient();
      await saveLink(redis, {
        telegram_user_id: result.id,
        zico_user_id: zicoUserId,
        username: result.username ?? null,
        language_code: result.language_code ?? null,
        linked_at: Math.floor(Date.now() / 1000),
        status: 'linked',
      });
      // chat_id não é conhecido neste endpoint do Mini App; salvar sessão só com user escopo é opcional

      // Try to notify user in their last chat with the bot
      try {
        const lastChatId = await getLastChat(getRedisClient(), result.id);
        if (lastChatId) {
          const api = new Api(env.TELEGRAM_BOT_TOKEN);
          await api.sendMessage(lastChatId, getLinkSuccessText(zicoUserId), { parse_mode: 'Markdown' });
          for (const msg of getTutorialMessages()) {
            await api.sendMessage(lastChatId, msg);
          }
        }
      } catch (e) {
        req.log.warn({ err: e }, 'failed to send link notification');
      }

      return reply.send({
        telegram_user_id: result.id,
        username: result.username ?? null,
        language_code: result.language_code ?? null,
        auth_date: authDate,
        valid: true,
        zico_user_id: zicoUserId,
      });
    } catch (err) {
      req.log.error({ err }, 'falha em /auth/telegram/verify');
      return reply.code(400).send({ error: 'payload inválido' });
    }
  });
}
