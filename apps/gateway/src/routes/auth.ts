import { FastifyInstance } from 'fastify';
import { verifyTelegramAuth } from '../services/authService.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function registerAuthRoutes(app: FastifyInstance) {
  const env = process.env;

  // Serve auth HTML with injected THIRDWEB_CLIENT_ID
  app.get('/auth/wallet', async (req, reply) => {
    try {
      const htmlPath = join(__dirname, '../views/auth.html');
      let html = readFileSync(htmlPath, 'utf-8');

      // Inject THIRDWEB_CLIENT_ID as a global variable
      const clientId = process.env.THIRDWEB_CLIENT_ID || '';
      const scriptTag = `<script>window.THIRDWEB_CLIENT_ID = '${clientId}';</script>`;
      html = html.replace('</head>', `${scriptTag}\n</head>`);

      reply.type('text/html').send(html);
    } catch (error) {
      console.error('❌ [AUTH] Failed to serve auth HTML:', error);
      reply.code(500).send({ error: 'Failed to load authentication page' });
    }
  });

  // Serve auth callback page for OAuth redirects
  app.get('/auth/callback', async (req, reply) => {
    try {
      const htmlPath = join(__dirname, '../views/auth-callback.html');
      let html = readFileSync(htmlPath, 'utf-8');

      // Inject THIRDWEB_CLIENT_ID as a global variable
      const clientId = process.env.THIRDWEB_CLIENT_ID || '';
      const scriptTag = `<script>window.THIRDWEB_CLIENT_ID = '${clientId}';</script>`;
      html = html.replace('</head>', `${scriptTag}\n</head>`);

      reply.type('text/html').send(html);
    } catch (error) {
      console.error('❌ [AUTH] Failed to serve auth callback:', error);
      reply.code(500).send({ error: 'Failed to load callback page' });
    }
  });

  // Serve external auth page for Telegram WebView
  app.get('/auth/external', async (req, reply) => {
    try {
      const htmlPath = join(__dirname, '../views/auth-external.html');
      let html = readFileSync(htmlPath, 'utf-8');

      // Inject THIRDWEB_CLIENT_ID as a global variable
      const clientId = process.env.THIRDWEB_CLIENT_ID || '';
      const scriptTag = `<script>window.THIRDWEB_CLIENT_ID = '${clientId}';</script>`;
      html = html.replace('</head>', `${scriptTag}\n</head>`);

      reply.type('text/html').send(html);
    } catch (error) {
      console.error('❌ [AUTH] Failed to serve external auth:', error);
      reply.code(500).send({ error: 'Failed to load external auth page' });
    }
  });

  // Serve auth.js
  app.get('/static/auth.js', async (req, reply) => {
    try {
      const jsPath = join(__dirname, '../views/auth.js');
      const js = readFileSync(jsPath, 'utf-8');
      reply.type('application/javascript').send(js);
    } catch (error) {
      console.error('❌ [AUTH] Failed to serve auth.js:', error);
      reply.code(500).send({ error: 'Failed to load auth script' });
    }
  });

  // Serve auth.css
  app.get('/static/auth.css', async (req, reply) => {
    try {
      const cssPath = join(__dirname, '../views/auth.css');
      const css = readFileSync(cssPath, 'utf-8');
      reply.type('text/css').send(css);
    } catch (error) {
      console.error('❌ [AUTH] Failed to serve auth.css:', error);
      reply.code(500).send({ error: 'Failed to load auth styles' });
    }
  });

  app.post('/auth/telegram/verify', async (req, reply) => {
    try {
      const { address, sessionKeyAddress, loginPayload, signature, telegram_user_id } = req.body as {
        address: string;
        sessionKeyAddress: string;
        loginPayload: any;
        signature: string;
        telegram_user_id: string;
      };

      if (!address || !sessionKeyAddress || !loginPayload || !signature || !telegram_user_id) {
        return reply.code(400).send({ error: 'Dados de autenticação incompletos' });
      }

      console.log('🔐 [AUTH] Verifying authentication...', {
        address,
        sessionKeyAddress,
        telegram_user_id,
        loginPayload: loginPayload,
        signature: signature ? signature.substring(0, 20) + '...' : 'NONE'
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

      console.log('✅ [AUTH] Authentication successful:', {
        zico_user_id: result.zico_user_id,
        telegram_user_id: result.id,
        jwt_token: result.jwt_token ? 'Present' : 'Missing'
      });

      return reply.send({
        success: true,
        zico_user_id: result.zico_user_id,
        telegram_user_id: result.id,
        jwt_token: result.jwt_token
      });
    } catch (err) {
      console.error('❌ [AUTH] Authentication error:', err);
      return reply.code(500).send({ error: 'Erro interno do servidor' });
    }
  });
}