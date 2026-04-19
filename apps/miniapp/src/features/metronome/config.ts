/**
 * Metronome Synth — frontend config.
 *
 * The backend module mounts at `/modules/metronome/*` on the execution-layer
 * Express app (port 3010). The Next.js dev proxy exposes it at
 * `/api/base-execution/modules/metronome/*` (see next.config.ts rewrites).
 */

import { resolveDefiBaseUrl } from '@/shared/lib/defiApiBase';

export const METRONOME_BASE_CHAIN_ID = 8453;

export const METRONOME_CONFIG = {
  CACHE_MARKETS_TTL_MS:  5 * 60 * 1000, // markets are static catalog → long TTL
  CACHE_POSITION_TTL_MS: 30 * 1000,     // positions change on-chain → short TTL
  REQUEST_TIMEOUT_MS:    30_000,
  MIN_FETCH_INTERVAL_MS: 10_000,
  DEFAULT_SLIPPAGE_BPS:  100,
} as const;

export const API_ENDPOINTS = {
  MARKETS:         '/modules/metronome/markets',
  POSITION:        '/modules/metronome/position',        // append `/${userAddress}`
  PREPARE_DEPOSIT: '/modules/metronome/prepare-deposit',
  PREPARE_WITHDRAW:'/modules/metronome/prepare-withdraw',
  PREPARE_MINT:    '/modules/metronome/prepare-mint',
  PREPARE_REPAY:   '/modules/metronome/prepare-repay',
  PREPARE_UNWIND:  '/modules/metronome/prepare-unwind',
} as const;

/**
 * Resolve the Metronome HTTP base.
 *
 * Same precedence used by yield/lending-avax: explicit env var first, then
 * fall back to the same-origin Next.js rewrite (`/api/base-execution`).
 */
export function resolveMetronomeBase(): string {
  return resolveDefiBaseUrl({
    envCandidates: [
      process.env.NEXT_PUBLIC_BASE_EXECUTION_API_URL,
      process.env.NEXT_PUBLIC_YIELD_API_URL,
      process.env.BASE_EXECUTION_SERVICE_URL,
    ],
    proxyPath: '/api/base-execution',
  });
}
