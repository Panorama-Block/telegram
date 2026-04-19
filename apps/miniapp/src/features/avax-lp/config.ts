export const AVAX_CHAIN_ID = 43114;
export const SNOWTRACE_URL = 'https://snowtrace.io/tx/';

export const JOE_ICON = 'https://assets.coingecko.com/coins/images/17569/small/traderjoe.png';
export const WAVAX_ADDRESS = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';

export const TOKEN_ICONS: Record<string, string> = {
  AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  WAVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  'USDC.e': 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  JOE: JOE_ICON,
  WETH: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  'WETH.e': 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  'WBTC.e': 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
};

export const AVAX_LP_CONFIG = {
  CACHE_DURATION: 5 * 60 * 1000,
  REQUEST_TIMEOUT: 30_000,
  MIN_FETCH_INTERVAL: 2 * 60 * 1000,
  DEFAULT_SLIPPAGE_BPS: 100,
} as const;

export const AVAX_LP_ENDPOINTS = {
  POOLS: '/avax/lp/pools',
  POSITION: '/avax/lp/position',
  PREPARE_ADD: '/avax/lp/prepare-add-liquidity',
  PREPARE_REMOVE: '/avax/lp/prepare-remove-liquidity',
  PREPARE_STAKE: '/avax/lp/prepare-stake',
  PREPARE_UNSTAKE: '/avax/lp/prepare-unstake',
  PREPARE_CLAIM: '/avax/lp/prepare-claim-rewards',
} as const;
