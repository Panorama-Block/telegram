import type { Notifier } from './notifier.js';
import { getRedis } from '../bot/session.js';

const PRICE_POLL_INTERVAL_MS = 60_000; // 1 minute
const ALERTS_REDIS_PREFIX = 'panorama:alert:';

export interface PriceAlert {
  id: string;
  chatId: number;
  token: string;
  targetPrice: number;
  direction: 'above' | 'below';
  createdAt: number;
  triggered: boolean;
}

// CoinGecko IDs for supported tokens
const TOKEN_IDS: Record<string, string> = {
  ETH: 'ethereum',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  WETH: 'weth',
  AVAX: 'avalanche-2',
  AERO: 'aerodrome-finance',
  cbETH: 'coinbase-wrapped-staked-eth',
};

/**
 * Price alert system.
 * Users can set price targets. When reached, they get notified.
 */
export class PriceAlertService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private priceCache: Map<string, number> = new Map();

  constructor(private notifier: Notifier) {}

  /**
   * Create a new price alert.
   */
  async createAlert(
    chatId: number,
    token: string,
    targetPrice: number,
    direction: 'above' | 'below',
  ): Promise<PriceAlert> {
    const redis = getRedis();
    const id = `${chatId}_${token}_${direction}_${Date.now()}`;
    const alert: PriceAlert = {
      id,
      chatId,
      token: token.toUpperCase(),
      targetPrice,
      direction,
      createdAt: Date.now(),
      triggered: false,
    };

    await redis.set(
      `${ALERTS_REDIS_PREFIX}${id}`,
      JSON.stringify(alert),
      'EX',
      86400 * 30, // 30 days TTL
    );

    return alert;
  }

  /**
   * Remove a price alert.
   */
  async removeAlert(id: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`${ALERTS_REDIS_PREFIX}${id}`);
  }

  /**
   * List alerts for a specific chat.
   */
  async listAlerts(chatId: number): Promise<PriceAlert[]> {
    const redis = getRedis();
    const alerts: PriceAlert[] = [];
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${ALERTS_REDIS_PREFIX}${chatId}_*`, 'COUNT', 100);
      cursor = nextCursor;

      for (const key of keys) {
        const raw = await redis.get(key);
        if (!raw) continue;
        try {
          alerts.push(JSON.parse(raw));
        } catch {}
      }
    } while (cursor !== '0');

    return alerts.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get current cached price for a token.
   */
  getCachedPrice(token: string): number | undefined {
    return this.priceCache.get(token.toUpperCase());
  }

  start(): void {
    if (this.timer) return;
    this.running = true;
    // Fetch prices immediately, then on interval
    this.poll();
    this.timer = setInterval(() => this.poll(), PRICE_POLL_INTERVAL_MS);
    console.log('[PriceAlerts] Started polling');
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[PriceAlerts] Stopped polling');
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      await this.fetchPrices();
      await this.checkAlerts();
    } catch (error) {
      console.error('[PriceAlerts] Poll error:', error);
    }
  }

  private async fetchPrices(): Promise<void> {
    const ids = Object.values(TOKEN_IDS).join(',');
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { headers: { accept: 'application/json' } },
    );

    if (!res.ok) return;
    const data = await res.json() as Record<string, { usd?: number }>;

    for (const [symbol, cgId] of Object.entries(TOKEN_IDS)) {
      const price = data[cgId]?.usd;
      if (price != null) {
        this.priceCache.set(symbol, price);
      }
    }
  }

  private async checkAlerts(): Promise<void> {
    const redis = getRedis();
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${ALERTS_REDIS_PREFIX}*`, 'COUNT', 100);
      cursor = nextCursor;

      for (const key of keys) {
        const raw = await redis.get(key);
        if (!raw) continue;

        try {
          const alert: PriceAlert = JSON.parse(raw);
          if (alert.triggered) continue;

          const currentPrice = this.priceCache.get(alert.token);
          if (currentPrice == null) continue;

          const triggered =
            (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
            (alert.direction === 'below' && currentPrice <= alert.targetPrice);

          if (triggered) {
            alert.triggered = true;
            await redis.del(key); // one-shot alert

            await this.notifier.sendPriceAlert(
              alert.chatId,
              alert.token,
              currentPrice.toFixed(2),
              alert.targetPrice.toFixed(2),
              alert.direction,
            );
          }
        } catch {}
      }
    } while (cursor !== '0');
  }
}
