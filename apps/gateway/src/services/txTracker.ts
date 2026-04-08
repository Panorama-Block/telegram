import type { Notifier } from './notifier.js';
import { getRedis } from '../bot/session.js';

const TX_POLL_INTERVAL_MS = 10_000; // 10 seconds
const TX_MAX_POLL_ATTEMPTS = 60; // 10 min max
const TX_REDIS_PREFIX = 'panorama:tx:';

interface TrackedTx {
  chatId: number;
  txHash: string;
  chainId: number;
  operation: string;
  attempts: number;
  createdAt: number;
}

/**
 * Tracks pending transactions and notifies users when they confirm or fail.
 * Uses Redis as the backing store for tracked transactions.
 */
export class TxTracker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private notifier: Notifier) {}

  /**
   * Track a new pending transaction.
   */
  async track(chatId: number, txHash: string, chainId = 8453, operation = 'transaction'): Promise<void> {
    const redis = getRedis();
    const entry: TrackedTx = {
      chatId,
      txHash,
      chainId,
      operation,
      attempts: 0,
      createdAt: Date.now(),
    };

    await redis.set(
      `${TX_REDIS_PREFIX}${txHash}`,
      JSON.stringify(entry),
      'EX',
      TX_MAX_POLL_ATTEMPTS * Math.ceil(TX_POLL_INTERVAL_MS / 1000) + 60,
    );

    console.log(`[TxTracker] Tracking ${txHash} for chat ${chatId}`);
  }

  /**
   * Start polling loop.
   */
  start(): void {
    if (this.timer) return;
    this.running = true;
    this.timer = setInterval(() => this.poll(), TX_POLL_INTERVAL_MS);
    console.log('[TxTracker] Started polling');
  }

  /**
   * Stop polling loop.
   */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[TxTracker] Stopped polling');
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    const redis = getRedis();
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${TX_REDIS_PREFIX}*`, 'COUNT', 50);
      cursor = nextCursor;

      for (const key of keys) {
        const raw = await redis.get(key);
        if (!raw) continue;

        try {
          const entry: TrackedTx = JSON.parse(raw);
          await this.checkTx(entry, key);
        } catch (error) {
          console.error(`[TxTracker] Error processing ${key}:`, error);
        }
      }
    } while (cursor !== '0');
  }

  private async checkTx(entry: TrackedTx, redisKey: string): Promise<void> {
    const redis = getRedis();
    entry.attempts++;

    // Max attempts reached
    if (entry.attempts >= TX_MAX_POLL_ATTEMPTS) {
      await redis.del(redisKey);
      await this.notifier.sendTxUpdate(
        entry.chatId,
        'pending',
        entry.txHash,
        '⏰ Tracking timed out. Check Basescan for final status.',
      );
      return;
    }

    try {
      const status = await this.fetchTxStatus(entry.txHash, entry.chainId);

      if (status === 'confirmed') {
        await redis.del(redisKey);
        await this.notifier.sendTxUpdate(
          entry.chatId,
          'confirmed',
          entry.txHash,
          `✨ Your ${entry.operation} has been confirmed on-chain!`,
        );
      } else if (status === 'failed') {
        await redis.del(redisKey);
        await this.notifier.sendTxUpdate(
          entry.chatId,
          'failed',
          entry.txHash,
          `Your ${entry.operation} failed. You can try again.`,
        );
      } else {
        // Still pending — update attempt count
        await redis.set(redisKey, JSON.stringify(entry), 'KEEPTTL');
      }
    } catch (error) {
      // Network error — just increment attempt and retry next cycle
      await redis.set(redisKey, JSON.stringify(entry), 'KEEPTTL');
    }
  }

  /**
   * Fetch transaction receipt status from a public RPC.
   * Returns 'confirmed', 'failed', or 'pending'.
   */
  private async fetchTxStatus(txHash: string, chainId: number): Promise<'confirmed' | 'failed' | 'pending'> {
    const rpcUrl = getRpcUrl(chainId);
    if (!rpcUrl) return 'pending';

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }),
    });

    const data = await res.json() as { result?: { status?: string } };

    if (!data.result) return 'pending';
    if (data.result.status === '0x1') return 'confirmed';
    if (data.result.status === '0x0') return 'failed';
    return 'pending';
  }
}

function getRpcUrl(chainId: number): string | null {
  const rpcs: Record<number, string> = {
    8453: 'https://mainnet.base.org',
    1: 'https://eth.llamarpc.com',
    42161: 'https://arb1.arbitrum.io/rpc',
    43114: 'https://api.avax.network/ext/bc/C/rpc',
  };
  return rpcs[chainId] ?? null;
}
