import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest, FastifyServerOptions } from 'fastify';
import fastifyStatic from '@fastify/static';
import { Bot, webhookCallback } from 'grammy';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';

import { parseEnv } from './env.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerMetricsRoutes } from './routes/metrics.js';
import { registerCommandHandlers } from './handlers/commands.js';
import { registerErrorHandler } from './middleware/errorHandler.js';

export async function createServer(): Promise<FastifyInstance> {
  const env = parseEnv();

  let httpsOptions: { key: Buffer; cert: Buffer; ca?: Buffer } | undefined;
  if (env.PRIVKEY && env.FULLCHAIN) {
    try {
      const key = readFileSync(env.PRIVKEY);
      const cert = readFileSync(env.FULLCHAIN);
      const ca = undefined;
      httpsOptions = { key, cert, ca };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Failed to load HTTPS certificates, falling back to HTTP', err);
    }
  }

  const serverOptions: FastifyServerOptions = {
    logger: {
      level: 'info',
      transport: process.env['NODE_ENV'] === 'production' ? undefined : {
        target: 'pino-pretty',
        options: { translateTime: 'SYS:standard' },
      },
    },
  };

  if (httpsOptions) {
    (serverOptions as any).https = httpsOptions;
  }

  const app = Fastify(serverOptions);

  await app.register(cors, {
    origin: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: null, // usar in-memory para dev, Redis para prod
  });

  // Dynamic tonconnect manifest that always matches the external public origin
  app.get('/miniapp/manifest.json', async (req, reply) => {
    // Prefer configured PUBLIC_GATEWAY_URL if available to avoid proxy header ambiguities
    let publicOrigin: string | null = null;
    try {
      const env = parseEnv();
      if (env.PUBLIC_GATEWAY_URL) {
        publicOrigin = new URL(env.PUBLIC_GATEWAY_URL).origin;
      }
    } catch {}

    if (!publicOrigin) {
      // Fallback to forwarded headers, then request host
      const xfProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0];
      const xfHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]
        || (req.headers['x-original-host'] as string | undefined)?.split(',')[0];
      const host = xfHost || (req.headers['host'] as string | undefined);
      const proto = xfProto || (req.protocol as string) || 'https';
      publicOrigin = host ? `${proto}://${host}` : `${proto}://localhost:${process.env['PORT'] ?? '7777'}`;
    }

    const origin = publicOrigin.replace(/\/$/, '');
    const body = {
      url: `${origin}/miniapp/`,
      name: 'Zico MiniApp — TON Wallet',
      iconUrl: `${origin}/miniapp/telegram_img.png`,
      termsOfUseUrl: '',
      privacyPolicyUrl: '',
    };
    reply.header('cache-control', 'no-store');
    return reply.send(body);
  });

  // Proxy to Next.js miniapp server
  const NEXTJS_PORT = process.env.NEXTJS_PORT || '3000';
  const NEXTJS_URL = `http://localhost:${NEXTJS_PORT}`;

  app.all('/miniapp', async (req, reply) => {
    return reply.redirect(302, '/miniapp/');
  });

  app.all('/miniapp/*', async (req, reply) => {
    try {
      const targetUrl = `${NEXTJS_URL}${req.url}`;
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: req.headers as any,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
      });

      const contentType = response.headers.get('content-type');
      if (contentType) {
        reply.header('content-type', contentType);
      }

      reply.code(response.status);
      return reply.send(await response.text());
    } catch (err) {
      app.log.error({ err, url: req.url }, 'Failed to proxy to Next.js');
      return reply.code(502).send({ error: 'Failed to connect to miniapp' });
    }
  });

  app.log.info({ NEXTJS_URL }, 'Miniapp proxying to Next.js server');

  // Debug: log miniapp requests and expose a probe
  app.addHook('onRequest', async (req) => {
    if (req.url.startsWith('/miniapp') || req.url.startsWith('/webapp')) {
      req.log.info({ url: req.url, ua: req.headers['user-agent'] }, 'miniapp request');
    }
  });
  app.get('/__miniapp_debug', async () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const paths = [
      join(__dirname, '../../miniapp-next/.next/static'),
      join(__dirname, '../../../miniapp-next/.next/static'),
      join(process.cwd(), '../miniapp-next/.next/static'),
      join(process.cwd(), '../../apps/miniapp-next/.next/static'),
    ];
    const report = paths.map((p) => ({ path: p, exists: existsSync(p) }));
    return {
      ok: true,
      report,
      env: {
        PUBLIC_WEBAPP_URL: process.env['PUBLIC_WEBAPP_URL'] ?? null,
        PUBLIC_GATEWAY_URL: process.env['PUBLIC_GATEWAY_URL'] ?? null,
        NODE_ENV: process.env['NODE_ENV'] ?? null,
      },
    };
  });

  // Error handling
  await registerErrorHandler(app);

  // Routes
  app.get('/healthz', async () => ({ status: 'ok' }));
  await registerAuthRoutes(app);
  await registerMetricsRoutes(app);

  // Telegram Bot via webhook
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  registerCommandHandlers(bot);

  // Inicializar o bot
  await bot.init();
  console.log('🤖 Bot initialized successfully!');

  // Handler customizado que ignora verificação de secret
  const handleWebhookCustom = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Processar a mensagem diretamente sem verificação de secret
      const body = req.body as any;
      
      console.log('🎯 [CUSTOM WEBHOOK] Processing message directly...');
      console.log('📨 Message:', body.message?.text);
      console.log('👤 From:', body.message?.from?.username);
      
      // Processar o update diretamente
      await bot.handleUpdate(body);
      
      reply.status(200).send({ ok: true });
    } catch (error) {
      console.error('❌ [CUSTOM WEBHOOK] Error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  };

  // Função para processar o webhook
  const handleWebhook = async (req: FastifyRequest, reply: FastifyReply) => {
    const reqId = `req-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('🚀 [WEBHOOK] Request received!');
    console.log('📡 URL:', req.url);
    console.log('📡 Method:', req.method);
    console.log('📡 Headers:', JSON.stringify(req.headers, null, 2));


    try {

      app.log.info({ reqId }, 'calling webhook callback...');
      const result = await webhookCallback(bot, 'fastify')(req, reply);
      
      app.log.info({
        reqId,
        res: {
          statusCode: reply.statusCode,
        },
        responseTime: reply.getResponseTime()
      }, 'request completed');
      
      return result;
    } catch (error: any) {
      app.log.error({
        reqId,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
          code: error.code,
          statusCode: error.statusCode,
        }
      }, 'webhook error');
      

      reply.status(500).send({ error: 'Internal server error' });
    }
  };

  app.post('/telegram/webhook', handleWebhookCustom);
  
  return app;
}

export async function start() {
  const env = parseEnv();
  const app = await createServer();
  const port = Number(env.PORT);
  await app.listen({ port, host: '0.0.0.0' });
}
