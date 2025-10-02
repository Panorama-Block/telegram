import { FastifyInstance } from 'fastify';
import { verifyTelegramAuth } from '../services/authService.js';

export async function registerAuthRoutes(app: FastifyInstance) {
  const env = process.env;

  // Static files are already registered in server.ts

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