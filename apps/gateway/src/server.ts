import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Bot, InlineKeyboard, webhookCallback } from 'grammy';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { parseEnv } from './env';
import { registerAuthRoutes } from './routes/auth';
import { registerChatHandlers } from './handlers/chat';

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

  // Servir WebApp estática (build de apps/webapp)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const webappDir = join(__dirname, '../../webapp/dist');
  await app.register(fastifyStatic, {
    root: webappDir,
    prefix: '/webapp/',
    decorateReply: false,
  });

  // Healthcheck
  app.get('/healthz', async () => ({ status: 'ok' }));
  await registerAuthRoutes(app);

  // Telegram Bot via grammY
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  registerChatHandlers(bot);
  bot.command('start', async (ctx) => {
    const env = parseEnv();
    const webAppUrl = process.env['PUBLIC_WEBAPP_URL'] || '';
    const kb = new InlineKeyboard().webApp('Abrir Zico', webAppUrl || 'https://example.com');
    await ctx.reply('Zico Agent no Telegram — pronto!', {
      reply_markup: kb,
    });
  });

  const callback = webhookCallback(bot, 'fastify', {
    secretToken: env.TELEGRAM_WEBHOOK_SECRET,
  });

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


