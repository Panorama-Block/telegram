import { useState, useEffect } from 'react';
import type { PortfolioAsset } from './types';

export type HistoryPoint = { date: string; value: number; timestamp: number };
export type TimeRange = '1W' | '1M';

// Maps our token symbols to CoinGecko coin IDs
const COINGECKO_ID: Record<string, string> = {
  'ETH':    'ethereum',
  'WETH':   'ethereum',
  'stETH':  'ethereum',
  'wstETH': 'ethereum',
  'BTC':    'bitcoin',
  'WBTC':   'bitcoin',
  'cbBTC':  'bitcoin',
  'AVAX':   'avalanche-2',
  'WAVAX':  'avalanche-2',
  'MATIC':  'matic-network',
  'POL':    'matic-network',
  'BNB':    'binancecoin',
  'ARB':    'arbitrum',
  'OP':     'optimism',
  'TON':    'the-open-network',
  'AAVE':   'aave',
  'UNI':    'uniswap',
  'LINK':   'chainlink',
  'AERO':   'aerodrome-finance',
  'LDO':    'lido-dao',
  'WLD':    'worldcoin-wld',
  'GMX':    'gmx',
  'JOE':    'joe',
  'CAKE':   'pancakeswap-token',
  'SAND':   'the-sandbox',
};

const STABLES = new Set(['USDC', 'USDT', 'DAI', 'USDe', 'FRAX', 'BUSD', 'LUSD', 'cUSD']);

const CACHE_KEY = (range: TimeRange) => `pano_ph_${range}`;
const CACHE_TTL = 15 * 60 * 1000; // 15 min

function parseBalance(raw: string): number {
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function usePortfolioHistory(assets: PortfolioAsset[], range: TimeRange) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (assets.length === 0) return;

    // Build groups: volatile (cgId → balance sum) and stable (USD value sum)
    const volatileGroups: Record<string, number> = {};
    let stableTotal = 0;

    for (const asset of assets) {
      const bal = parseBalance(asset.balance);
      if (bal <= 0) continue;

      if (STABLES.has(asset.symbol)) {
        stableTotal += asset.valueRaw ?? bal;
      } else {
        const cgId = COINGECKO_ID[asset.symbol];
        if (cgId) {
          volatileGroups[cgId] = (volatileGroups[cgId] ?? 0) + bal;
        }
      }
    }

    const cgIds = Object.keys(volatileGroups);
    if (cgIds.length === 0 && stableTotal === 0) return;

    // Check session cache
    try {
      const cached = sessionStorage.getItem(CACHE_KEY(range));
      if (cached) {
        const { ts, data } = JSON.parse(cached) as { ts: number; data: HistoryPoint[] };
        if (Date.now() - ts < CACHE_TTL && data.length > 0) {
          setHistory(data);
          return;
        }
      }
    } catch { /* ignore */ }

    const days = range === '1W' ? 7 : 30;
    setLoading(true);

    const controller = new AbortController();

    const run = async () => {
      try {
        // Fetch market_chart for each unique CoinGecko ID in parallel
        const pricesByDay: Record<string, number[]> = {};

        await Promise.all(
          cgIds.map(async (cgId) => {
            try {
              const res = await fetch(
                `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
                { signal: controller.signal }
              );
              if (!res.ok) return;
              const json = await res.json() as { prices: [number, number][] };
              pricesByDay[cgId] = json.prices.map(([, p]) => p);
            } catch {
              // Use last known price as flat line fallback
            }
          })
        );

        // Find min common length across all fetched series
        const lengths = Object.values(pricesByDay).map(a => a.length);
        const minLen = lengths.length > 0 ? Math.min(...lengths) : 1;

        const now = Date.now();
        const points: HistoryPoint[] = [];

        for (let i = 0; i < minLen; i++) {
          let dayValue = stableTotal;

          for (const [cgId, balance] of Object.entries(volatileGroups)) {
            const prices = pricesByDay[cgId];
            if (prices && prices[i] != null) {
              dayValue += balance * prices[i];
            } else {
              // fallback: use current asset value proportion
              const asset = assets.find(a => COINGECKO_ID[a.symbol] === cgId);
              dayValue += asset?.valueRaw ?? 0;
            }
          }

          const daysAgo = minLen - 1 - i;
          const ts = now - daysAgo * 86_400_000;
          const d = new Date(ts);
          const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          points.push({ date: label, value: Math.round(dayValue * 100) / 100, timestamp: ts });
        }

        if (points.length > 0) {
          setHistory(points);
          try {
            sessionStorage.setItem(CACHE_KEY(range), JSON.stringify({ ts: Date.now(), data: points }));
          } catch { /* ignore */ }
        }
      } catch {
        // Silent — chart stays empty
      } finally {
        setLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.length, range]);

  // Compute P&L from first → last point
  const pnl = (() => {
    if (history.length < 2) return null;
    const first = history[0].value;
    const last = history[history.length - 1].value;
    if (first === 0) return null;
    const diff = last - first;
    const pct = (diff / first) * 100;
    return {
      amount: diff,
      percent: pct,
      isPositive: diff >= 0,
      amountStr: `${diff >= 0 ? '+' : ''}$${Math.abs(diff).toFixed(2)}`,
      percentStr: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
    };
  })();

  return { history, loading, pnl };
}
