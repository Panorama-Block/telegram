import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Bot, webhookCallback } from 'grammy';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { parseEnv } from './env.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerMetricsRoutes } from './routes/metrics.js';
import { registerChatHandlers } from './handlers/chat.js';
import { registerCommandHandlers } from './handlers/commands.js';
import { registerErrorHandler } from './middleware/errorHandler.js';
import { buildStartMenu, getLongWelcomeText } from './utils/onboarding.js';
import { getRedisClient } from './redis/client.js';
import { saveLastChat } from './repos/lastChat.js';

export async function createServer(): Promise<FastifyInstance> {
  const env = parseEnv();
  const app = Fastify({
    logger: {
      level: 'info',
      transport: process.env['NODE_ENV'] === 'production' ? undefined : {
        target: 'pino-pretty',
        options: { translateTime: 'SYS:standard' },
      },
    },
  });

  await app.register(cors, {
    origin: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: null, // usar in-memory para dev, Redis para prod
  });

  // WebApp desativado no modo chat-only.

  // Error handling
  await registerErrorHandler(app);

  // Routes
  app.get('/healthz', async () => ({ status: 'ok' }));
  await registerAuthRoutes(app);
  await registerMetricsRoutes(app);

  // Telegram Bot via webhook
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  registerCommandHandlers(bot);
  registerChatHandlers(bot);
  bot.command('start', async (ctx) => {
    const env = parseEnv();
    // Persist the last chat to enable post-link notifications
    const fromId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    if (fromId && chatId) {
      const redis = getRedisClient();
      await saveLastChat(redis, fromId, chatId);
    }

    await ctx.reply(getLongWelcomeText(), { reply_markup: buildStartMenu(env) });
  });

  const callback = webhookCallback(bot, 'fastify', 'return', 10000, env.TELEGRAM_WEBHOOK_SECRET);

  app.post('/telegram/webhook', async (req: FastifyRequest, reply: FastifyReply) => {
    // Verificação do header secreto é feita pelo grammY ao validar a requisição
    return callback(req, reply);
  });

  return app;
}

export async function start() {
  const env = parseEnv();
  const app = await createServer();
  const port = Number(env.PORT);
  await app.listen({ port, host: '0.0.0.0' });
}
