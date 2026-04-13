import type { FastifyInstance } from 'fastify';
import type { Api } from 'grammy';
import { getRedis } from '../bot/session.js';
import type { SessionData, ExternalWallet } from '../bot/context.js';
import { parseEnv } from '../env.js';
import { verifyTelegramInitData } from '../lib/telegramInitData.js';
import { t } from '../i18n/index.js';

const SUPPORTED_CHAIN_IDS = new Set([1, 10, 8453, 42161]);

interface ConnectBody {
  address: string;
  chainId: number;
  walletId?: string;
}

function isEvmAddress(v: unknown): v is string {
  return typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v);
}

/**
 * Read the Grammy session for a given Telegram user (private chat id === user id).
 * Writes back a mutated copy.
 */
async function mutateSession(
  userId: number,
  mutator: (s: SessionData) => SessionData,
): Promise<SessionData> {
  const redis = getRedis();
  const key = String(userId);
  const raw = await redis.get(key);
  const current: SessionData = raw
    ? (JSON.parse(raw) as SessionData)
    : {
        walletMode: 'smart',
        defaultChainId: 8453,
        language: 'en',
        onboardingComplete: false,
        hasFundedAccount: false,
      };
  const next = mutator(current);
  await redis.set(key, JSON.stringify(next));
  await redis.expire(key, 60 * 60 * 24 * 30);
  return next;
}

export async function registerWalletRoutes(
  app: FastifyInstance,
  botApi: Api,
): Promise<void> {
  const env = parseEnv();

  app.post('/api/wallet/external/connect', async (req, reply) => {
    const body = (req.body ?? {}) as Partial<ConnectBody>;

    if (!isEvmAddress(body.address)) {
      return reply.code(400).send({ error: 'invalid_address' });
    }
    if (typeof body.chainId !== 'number' || !SUPPORTED_CHAIN_IDS.has(body.chainId)) {
      return reply.code(400).send({ error: 'unsupported_chain' });
    }

    const initData =
      (req.headers['x-telegram-init-data'] as string | undefined) ??
      (req.headers['x-telegram-initdata'] as string | undefined) ??
      '';

    const verified = verifyTelegramInitData(
      initData,
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_INITDATA_MAX_AGE_SECONDS,
    );
    if (!verified) {
      req.log.warn('[wallet/connect] initData verification failed');
      return reply.code(401).send({ error: 'invalid_init_data' });
    }

    const userId = verified.user.id;
    const externalWallet: ExternalWallet = {
      address: body.address.toLowerCase(),
      chainId: body.chainId,
      walletId: body.walletId,
      connectedAt: Date.now(),
    };

    try {
      const next = await mutateSession(userId, (s) => ({
        ...s,
        externalWallet,
        walletMode: 'external',
      }));

      // Best-effort: notify the user in Telegram
      try {
        const strings = t(next.language ?? 'en');
        const short = `${externalWallet.address.slice(0, 6)}…${externalWallet.address.slice(-4)}`;
        const chainName = chainLabel(externalWallet.chainId);
        const msg =
          next.language === 'pt'
            ? `✅ Carteira externa conectada\n\n🔗 <code>${short}</code>\n🌐 ${chainName}\n\nAgora as operações DeFi vão pedir confirmação no app da sua carteira.`
            : `✅ External wallet connected\n\n🔗 <code>${short}</code>\n🌐 ${chainName}\n\nDeFi operations will now ask for approval in your wallet app.`;
        void strings; // reserved for future localized strings
        await botApi.sendMessage(userId, msg, { parse_mode: 'HTML' });
      } catch (notifyErr) {
        req.log.warn({ err: notifyErr }, '[wallet/connect] notify failed');
      }

      return reply.send({ ok: true, address: externalWallet.address });
    } catch (err) {
      req.log.error({ err }, '[wallet/connect] persist failed');
      return reply.code(500).send({ error: 'internal' });
    }
  });
}

function chainLabel(chainId: number): string {
  switch (chainId) {
    case 1:
      return 'Ethereum';
    case 10:
      return 'Optimism';
    case 8453:
      return 'Base';
    case 42161:
      return 'Arbitrum';
    default:
      return `Chain ${chainId}`;
  }
}
