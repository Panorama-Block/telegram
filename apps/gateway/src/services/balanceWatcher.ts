import type { Notifier } from './notifier.js';
import { getRedis } from '../bot/session.js';

const BALANCE_POLL_INTERVAL_MS = 30_000; // 30 seconds
const BALANCE_REDIS_PREFIX = 'panorama:balance:';
const WATCH_REDIS_PREFIX = 'panorama:watch:';

interface WatchEntry {
  chatId: number;
  address: string;
  lastBalance: string;
}

/**
 * Watches smart account balances for deposits.
 * Notifies users when their balance changes.
 */
export class BalanceWatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private notifier: Notifier) {}

  /**
   * Register an address to watch for balance changes.
   */
  async watch(chatId: number, address: string): Promise<void> {
    const redis = getRedis();
    const entry: WatchEntry = {
      chatId,
      address,
      lastBalance: '0',
    };

    await redis.set(
      `${WATCH_REDIS_PREFIX}${address}`,
      JSON.stringify(entry),
      'EX',
      86400 * 7, // 7 days TTL
    );

    console.log(`[BalanceWatcher] Watching ${address} for chat ${chatId}`);
  }

  /**
   * Stop watching an address.
   */
  async unwatch(address: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`${WATCH_REDIS_PREFIX}${address}`);
  }

  start(): void {
    if (this.timer) return;
    this.running = true;
    this.timer = setInterval(() => this.poll(), BALANCE_POLL_INTERVAL_MS);
    console.log('[BalanceWatcher] Started polling');
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[BalanceWatcher] Stopped polling');
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    const redis = getRedis();
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${WATCH_REDIS_PREFIX}*`, 'COUNT', 50);
      cursor = nextCursor;

      for (const key of keys) {
        const raw = await redis.get(key);
        if (!raw) continue;

        try {
          const entry: WatchEntry = JSON.parse(raw);
          await this.checkBalance(entry, key);
        } catch (error) {
          console.error(`[BalanceWatcher] Error checking ${key}:`, error);
        }
      }
    } while (cursor !== '0');
  }

  private async checkBalance(entry: WatchEntry, redisKey: string): Promise<void> {
    const redis = getRedis();

    try {
      const newBalance = await this.fetchBalance(entry.address);

      if (newBalance !== entry.lastBalance && newBalance !== '0') {
        const oldBalance = entry.lastBalance;
        entry.lastBalance = newBalance;
        await redis.set(redisKey, JSON.stringify(entry), 'KEEPTTL');

        // Only notify if balance increased (deposit)
        const oldNum = parseFloat(oldBalance);
        const newNum = parseFloat(newBalance);
        if (newNum > oldNum) {
          await this.notifier.sendBalanceAlert(
            entry.chatId,
            entry.address,
            oldBalance,
            newBalance,
          );
        }
      }
    } catch {
      // RPC error — skip this cycle
    }
  }

  private async fetchBalance(address: string): Promise<string> {
    const res = await fetch('https://mainnet.base.org', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
    });

    const data = await res.json() as { result?: string };
    if (!data.result) return '0';

    // Convert wei to ETH (18 decimals)
    const wei = BigInt(data.result);
    const eth = Number(wei) / 1e18;
    return eth.toFixed(6);
  }
}
