import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import { Bot, webhookCallback } from 'grammy';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';

import { parseEnv } from './env.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerMetricsRoutes } from './routes/metrics.js';
import { registerChatHandlers } from './handlers/chat.js';
import { registerCommandHandlers } from './handlers/commands.js';
import { registerErrorHandler } from './middleware/errorHandler.js';
// start onboarding now handled inside command handlers to avoid middleware ordering issues
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

  // Serve Miniapp (if built dist exists) at /miniapp/
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const candidates = [
      join(__dirname, '../../miniapp/dist'),       // tsx dev (src -> apps/miniapp/dist)
      join(__dirname, '../../../miniapp/dist'),     // compiled (dist/src -> apps/miniapp/dist)
      join(process.cwd(), '../miniapp/dist'),       // cwd = apps/gateway
      join(process.cwd(), '../../apps/miniapp/dist')// cwd = repo root
    ];
    const miniappDist = candidates.find((p) => existsSync(p));
    if (miniappDist) {
      // Serve under /miniapp/ (preferred)
      await app.register(fastifyStatic, {
        root: miniappDist,
        prefix: '/miniapp/',
        index: 'index.html',
        decorateReply: true,
        // During debugging, avoid stale caches entirely
        cacheControl: false,
        etag: false,
        lastModified: false,
        setHeaders(res, path) {
          // Aggressive no-store to defeat intermediary caches while we debug
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          // Keep correct types for JS modules
          if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
          }
        },
      });
      // Note: fastify-static already registers GET /miniapp/* to serve files.
      // Do not add another GET /miniapp/* here to avoid FST_ERR_DUPLICATED_ROUTE.
      try {
        const files = await readdir(miniappDist);
        app.log.info({ miniappDist, files }, 'Miniapp dist mounted');
      } catch {}
      // Backward-compat: redirect /webapp/* to /miniapp/*
      app.get('/webapp', async (_req, reply) => {
        reply.redirect(302, '/miniapp/');
      });
      app.get('/webapp/*', async (req, reply) => {
        const rest = (req.params as any)['*'] ?? '';
        const target = `/miniapp/${rest}`.replace(/\/+/g, '/');
        reply.redirect(302, target);
      });
      app.log.info({ miniappDist }, 'Miniapp static serving enabled at /miniapp/ (with /webapp redirect)');
    } else {
      app.log.info({ candidates }, 'Miniapp dist not found; static serving disabled');
    }
  } catch (e) {
    app.log.warn({ err: e }, 'Failed to enable miniapp static serving');
  }

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
      join(__dirname, '../../miniapp/dist'),
      join(__dirname, '../../../miniapp/dist'),
      join(process.cwd(), '../miniapp/dist'),
      join(process.cwd(), '../../apps/miniapp/dist'),
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
  registerChatHandlers(bot);

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
