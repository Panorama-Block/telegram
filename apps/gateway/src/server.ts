import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

import { parseEnv, type Env } from './env.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerMetricsRoutes } from './routes/metrics.js';
import { registerWalletRoutes } from './routes/wallet.js';
import { registerErrorHandler } from './middleware/errorHandler.js';
import { createBot, registerCommands } from './bot/index.js';
import { disconnectRedis } from './bot/session.js';
import { initServices, startServices, stopServices } from './services/index.js';

type HttpsConfig = {
  options: {
    key: Buffer;
    cert: Buffer;
    ca?: Buffer;
  };
  paths: {
    certPath: string;
    keyPath: string;
  };
};

const GATEWAY_LOG_PREFIX = '[Gateway Service]';

function appendPath(basePathname: string, segment?: string): string {
  const base = (basePathname || '').replace(/\/+$/, '');
  if (!segment) return base || '/';
  const cleanSegment = segment.replace(/^\/+/, '');
  if (!base || base === '/') return `/${cleanSegment}`;
  return `${base}/${cleanSegment}`;
}

function buildPublicMiniappUrl(baseUrl: string, requestUrl: string): string {
  const url = new URL(baseUrl);
  const [pathnamePart, searchPart] = requestUrl.split('?', 2);
  const relativePath = (pathnamePart ?? '/miniapp').replace(/^\/miniapp\/?/, '');
  url.pathname = appendPath(url.pathname, relativePath);
  url.search = searchPart ? `?${searchPart}` : '';
  return url.toString();
}

function loadHttpsConfig(env: Env): HttpsConfig | null {
  try {
    const certPath = env.FULLCHAIN || '/etc/letsencrypt/live/api.panoramablock.com/fullchain.pem';
    const keyPath = env.PRIVKEY || '/etc/letsencrypt/live/api.panoramablock.com/privkey.pem';

    console.log(`${GATEWAY_LOG_PREFIX} Checking SSL certificates at: ${certPath} and ${keyPath}`);

    const certExists = existsSync(certPath);
    const keyExists = existsSync(keyPath);

    if (certExists && keyExists) {
      console.log(`${GATEWAY_LOG_PREFIX} ✅ SSL certificates found!`);
      return {
        options: {
          key: readFileSync(keyPath),
          cert: readFileSync(certPath),
        },
        paths: {
          certPath,
          keyPath,
        },
      };
    }

    console.warn(`${GATEWAY_LOG_PREFIX} ⚠️ SSL certificates not found at provided paths:`);
    console.warn(`- Cert: ${certPath} (${certExists ? 'exists' : 'missing'})`);
    console.warn(`- Key: ${keyPath} (${keyExists ? 'exists' : 'missing'})`);
    console.warn(`${GATEWAY_LOG_PREFIX} Running in HTTP mode.`);
    return null;
  } catch (error) {
    console.warn(`${GATEWAY_LOG_PREFIX} ❌ Error while loading SSL certificates:`, error);
    return null;
  }
}

export async function createServer(): Promise<FastifyInstance> {
  const env = parseEnv();
  const httpsConfig = loadHttpsConfig(env);

  const serverOptions: FastifyServerOptions = {
    logger: {
      level: 'info',
      // Temporarily disabled pino-pretty due to Node.js v24 compatibility issues
      // transport: process.env['NODE_ENV'] === 'production' ? undefined : {
      //   target: 'pino-pretty',
      //   options: { translateTime: 'SYS:standard' },
      // },
    },
  };

  if (httpsConfig) {
    (serverOptions as any).https = httpsConfig.options;
  }

  const app = Fastify(serverOptions) as FastifyInstance & { httpsConfig?: HttpsConfig | null };
  app.httpsConfig = httpsConfig;

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
  const NEXTJS_PORT = process.env.NEXTJS_PORT || '7777';
  const NEXTJS_URL = `http://localhost:${NEXTJS_PORT}`;
  const shouldProxyMiniapp = env.NEXTJS_PROXY_ENABLED;
  const publicMiniappUrl = env.PUBLIC_WEBAPP_URL || null;

  app.all('/miniapp', async (req, reply) => {
    if (!shouldProxyMiniapp && publicMiniappUrl) {
      return reply.redirect(302, buildPublicMiniappUrl(publicMiniappUrl, req.url));
    }
    const suffix = req.url.slice('/miniapp'.length);
    return reply.redirect(302, `/miniapp/${suffix}`);
  });

  app.all('/miniapp/*', async (req, reply) => {
    if (!shouldProxyMiniapp) {
      if (publicMiniappUrl) {
        return reply.redirect(302, buildPublicMiniappUrl(publicMiniappUrl, req.url));
      }

      return reply.code(503).send({ error: 'Miniapp proxy is disabled and no public miniapp URL is configured.' });
    }

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

  app.log.info({ NEXTJS_URL, shouldProxyMiniapp, publicMiniappUrl }, 'Miniapp routing configured');

  // ===== SWAP SERVICE PROXY =====
  const SWAP_SERVICE_URL = process.env.SWAP_SERVICE_URL || 'http://localhost:3002';

  app.all('/swap/*', async (req, reply) => {
    try {
      const targetUrl = `${SWAP_SERVICE_URL}${req.url}`;
      console.log(`[Gateway] → Swap: ${targetUrl}`);

      const response = await fetch(targetUrl, {
        method: req.method,
        headers: { ...req.headers, 'content-type': 'application/json' } as any,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
      });

      reply.code(response.status);
      return reply.send(await response.json());
    } catch (err) {
      app.log.error({ err, url: req.url }, 'Swap proxy failed');
      return reply.code(502).send({ success: false, error: { code: 'SWAP_UNAVAILABLE', message: 'Swap service down' } });
    }
  });

  app.log.info({ SWAP_SERVICE_URL }, 'Swap proxy configured');

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
  app.get('/healthz/services', async () => {
    try {
      const { getServices: getSvc } = await import('./services/index.js');
      const services = getSvc();
      return {
        status: 'ok',
        services: {
          txTracker: 'running',
          balanceWatcher: 'running',
          priceAlerts: 'running',
        },
      };
    } catch {
      return { status: 'not_initialized' };
    }
  });
  await registerAuthRoutes(app);
  await registerMetricsRoutes(app);

  // Telegram Bot via webhook (new modular setup)
  const bot = createBot();

  await bot.init();
  await registerCommands(bot);

  // Initialize and start background services (tx tracking, balance watcher, price alerts)
  initServices(bot.api);
  startServices();
  console.log('🤖 Bot initialized with plugins, commands, and background services!');

  // Webhook handler — processes updates directly
  const handleWebhook = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = req.body as any;
      await bot.handleUpdate(body);
      reply.status(200).send({ ok: true });
    } catch (error) {
      console.error('[Webhook] Error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  };

  app.post('/telegram/webhook', handleWebhook);

  // External wallet routes (PR1: connect flow from miniapp)
  await registerWalletRoutes(app, bot.api);

  return app;
}

export async function start() {
  const env = parseEnv();
  const app = await createServer();
  const httpsConfig = (app as FastifyInstance & { httpsConfig?: HttpsConfig | null }).httpsConfig ?? null;
  const port = Number(env.PORT);

  try {
    await app.listen({ port, host: '0.0.0.0' });

    const protocol = httpsConfig ? 'HTTPS' : 'HTTP';
    const originPrefix = httpsConfig ? 'https' : 'http';

    console.log(`\n🎉 ${GATEWAY_LOG_PREFIX} ${protocol} Server running successfully!`);
    console.log(`📊 Port: ${port}`);
    console.log(`🔒 Protocol: ${protocol}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📋 Health check: ${originPrefix}://localhost:${port}/healthz`);
    console.log(`📖 Documentation: ${originPrefix}://localhost:${port}/`);
    console.log('');

    if (!httpsConfig && process.env.NODE_ENV === 'production') {
      console.warn(`${GATEWAY_LOG_PREFIX} WARNING: Running in HTTP mode in production. SSL certificates not found.`);
    }
  } catch (error) {
    const err = error as Error;
    console.error(`${GATEWAY_LOG_PREFIX} 💥 Fatal error initializing service:`, err.message);
    if (process.env.DEBUG === 'true') {
      console.error(`${GATEWAY_LOG_PREFIX} Stack trace:`, err.stack);
    }
    process.exit(1);
  }

  process.once('SIGTERM', async () => {
    console.log(`${GATEWAY_LOG_PREFIX} SIGTERM received, shutting down gracefully...`);
    try {
      stopServices();
      await app.close();
      await disconnectRedis();
      console.log(`${GATEWAY_LOG_PREFIX} Server closed`);
      process.exit(0);
    } catch (shutdownError) {
      console.error(`${GATEWAY_LOG_PREFIX} Error while shutting down:`, shutdownError);
      process.exit(1);
    }
  });
}
