import { TOKEN_ICONS as SHARED_TOKEN_ICONS } from '@/features/lending/config';

export const BASE_CHAIN_ID = 8453;

export const BASESCAN_URL = 'https://basescan.org/tx/';

export const AERO_ICON = 'https://assets.coingecko.com/coins/images/31745/small/token.png';

/** Re-export shared token icons and add Base-specific ones */
export const TOKEN_ICONS: Record<string, string> = {
  ...SHARED_TOKEN_ICONS,
  USDbC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  wstETH: 'https://assets.coingecko.com/coins/images/18834/small/wstETH.png',
};

export const YIELD_CONFIG = {
  CACHE_DURATION: 5 * 60 * 1000,
  REQUEST_TIMEOUT: 30 * 1000,
  MIN_FETCH_INTERVAL: 2 * 60 * 1000,
  DEFAULT_SLIPPAGE_BPS: 100,
} as const;

export const API_ENDPOINTS = {
  POOLS: '/staking/pools',
  PROTOCOL_INFO: '/staking/protocol-info',
  POSITION: '/staking/position',
  PORTFOLIO: '/staking/portfolio',
  PREPARE_ENTER: '/staking/prepare-enter',
  PREPARE_EXIT: '/staking/prepare-exit',
  PREPARE_CLAIM: '/staking/prepare-claim',
  TRANSACTION_SUBMIT: '/staking/transaction/submit',
  TRANSACTION_STATUS: '/staking/transaction',
  HISTORY: '/staking/history',
} as const;
