/**
 * Lending Service Configuration
 * 
 * This file contains configuration constants and default values
 * for the Lending Service module.
 */

export const VALIDATION_FEE = {
  /** Validation fee rate (10% = 0.1) */
  RATE: 0.1,
  
  /** Net amount rate after fee (90% = 0.9) */
  NET_RATE: 0.9,
  
  /** Validation fee percentage for display */
  PERCENTAGE: 10,
  
  /** Net amount percentage for display */
  NET_PERCENTAGE: 90,
} as const;

export const LENDING_CONFIG = {
  /** Cache duration in milliseconds (5 minutes) */
  CACHE_DURATION: 5 * 60 * 1000,
  
  /** Request timeout in milliseconds (10 seconds) */
  REQUEST_TIMEOUT: 10 * 1000,
  
  /** Default chain ID (Avalanche C-Chain) */
  DEFAULT_CHAIN_ID: 43114,
  
  /** Default wallet type */
  DEFAULT_WALLET_TYPE: 'smart_wallet' as const,
  
  /** Minimum fetch interval in milliseconds (2 minutes) */
  MIN_FETCH_INTERVAL: 2 * 60 * 1000,
  
  /** Maximum retry attempts for failed requests */
  MAX_RETRY_ATTEMPTS: 3,
  
  /** Retry delay in milliseconds (exponential backoff) */
  RETRY_DELAY: 1000,
} as const;

export const API_ENDPOINTS = {
  /** Get available lending tokens */
  TOKENS: '/dex/tokens',
  
  /** Get user lending position */
  POSITION: '/lending/position',
  
  /** Calculate tax/fees */
  CALCULATE_TAX: '/validation/calculate',
  
  /** Prepare supply transaction */
  PREPARE_SUPPLY: '/benqi-validation/validateAndSupply',
  
  /** Prepare withdraw transaction */
  PREPARE_WITHDRAW: '/benqi-validation/validateAndWithdraw',
  
  /** Prepare borrow transaction */
  PREPARE_BORROW: '/benqi-validation/validateAndBorrow',
  
  /** Prepare repay transaction */
  PREPARE_REPAY: '/benqi-validation/validateAndRepay',
  
  /** Get supply quote */
  SUPPLY_QUOTE: '/benqi-validation/getValidationAndSupplyQuote',
  
  /** Get borrow quote */
  BORROW_QUOTE: '/benqi-validation/getValidationAndBorrowQuote',
} as const;

// Token icons from CoinGecko
export const TOKEN_ICONS: Record<string, string> = {
  // Major tokens
  'ETH': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  'WETH': 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  'WBTC': 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  'BTC.b': 'https://assets.coingecko.com/coins/images/26115/small/btcb.png',
  'cbBTC': 'https://assets.coingecko.com/coins/images/40489/small/cbBTC.png',

  // Stablecoins
  'USDC': 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  'USDT': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  'DAI': 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',
  'TUSD': 'https://assets.coingecko.com/coins/images/3449/small/tusd.png',
  'MIM': 'https://assets.coingecko.com/coins/images/16786/small/mimlogopng.png',
  'USDe': 'https://assets.coingecko.com/coins/images/33613/small/USDE.png',

  // Avalanche
  'AVAX': 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  'WAVAX': 'https://assets.coingecko.com/coins/images/15075/small/wrapped-avax.png',
  'JOE': 'https://assets.coingecko.com/coins/images/17569/small/traderjoe.png',

  // DeFi protocols
  'AAVE': 'https://assets.coingecko.com/coins/images/12645/small/aave-token-round.png',
  'COMP': 'https://assets.coingecko.com/coins/images/10775/small/COMP.png',
  'UNI': 'https://assets.coingecko.com/coins/images/12504/small/uni.jpg',
  'LINK': 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  'LDO': 'https://assets.coingecko.com/coins/images/13573/small/Lido_DAO.png',
  'GMX': 'https://assets.coingecko.com/coins/images/18323/small/arbit.png',
  'QUICK': 'https://assets.coingecko.com/coins/images/13970/small/1_pOU6pBMEmiL-ZJVb0CYRjQ.png',
  'CAKE': 'https://assets.coingecko.com/coins/images/12632/small/IMG_0440.PNG',
  'AERO': 'https://assets.coingecko.com/coins/images/31745/small/token.png',

  // Layer 1 / Layer 2
  'MATIC': 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  'ARB': 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
  'OP': 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
  'BNB': 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  'TON': 'https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png',
  'WLD': 'https://assets.coingecko.com/coins/images/31069/small/worldcoin.jpeg',

  // Other tokens
  'SAND': 'https://assets.coingecko.com/coins/images/12129/small/sandbox_logo.jpg',
  'ADA': 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
  'DOGE': 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  'XRP': 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
  'DOT': 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
  'PEPE': 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg',
  'CRV': 'https://assets.coingecko.com/coins/images/12124/small/Curve.png',
};

export const FALLBACK_TOKENS = [
  {
    symbol: 'AVAX',
    address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    icon: TOKEN_ICONS['AVAX'],
    decimals: 18,
    supplyAPY: 3.5,
    borrowAPY: 5.2,
    totalSupply: '0',
    totalBorrowed: '0',
    availableLiquidity: '0',
    collateralFactor: 0.8,
    isCollateral: true
  },
  {
    symbol: 'USDC',
    address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
    icon: TOKEN_ICONS['USDC'],
    decimals: 6,
    supplyAPY: 2.8,
    borrowAPY: 4.5,
    totalSupply: '0',
    totalBorrowed: '0',
    availableLiquidity: '0',
    collateralFactor: 0.9,
    isCollateral: true
  }
] as const;

export const ERROR_MESSAGES = {
  ACCOUNT_NOT_CONNECTED: 'Account not connected',
  INVALID_TRANSACTION_DATA: 'Invalid transaction data',
  INVALID_ADDRESS: 'Invalid address format',
  INVALID_AMOUNT: 'Invalid amount',
  NETWORK_ERROR: 'Network error occurred',
  API_ERROR: 'API error occurred',
  TRANSACTION_FAILED: 'Transaction failed',
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  INSUFFICIENT_LIQUIDITY: 'Insufficient liquidity',
  POSITION_NOT_FOUND: 'Position not found',
  TOKEN_NOT_FOUND: 'Token not found',
  UNAUTHORIZED: 'Unauthorized access',
  RATE_LIMITED: 'Rate limited',
  TIMEOUT: 'Request timeout',
} as const;

export const SUCCESS_MESSAGES = {
  SUPPLY_SUCCESS: 'Supply successful',
  WITHDRAW_SUCCESS: 'Withdraw successful',
  BORROW_SUCCESS: 'Borrow successful',
  REPAY_SUCCESS: 'Repay successful',
  TRANSACTION_SUBMITTED: 'Transaction submitted successfully',
  DATA_REFRESHED: 'Data refreshed successfully',
  CACHE_CLEARED: 'Cache cleared successfully',
} as const;

export const VALIDATION_RULES = {
  /** Minimum amount for transactions */
  MIN_AMOUNT: 0.000001,
  
  /** Maximum amount for transactions */
  MAX_AMOUNT: 1000000,
  
  /** Minimum health factor before warning */
  MIN_HEALTH_FACTOR_WARNING: 1.5,
  
  /** Minimum health factor before critical warning */
  MIN_HEALTH_FACTOR_CRITICAL: 1.1,
  
  /** Maximum number of decimal places */
  MAX_DECIMALS: 18,
  
  /** Address validation regex */
  ADDRESS_REGEX: /^0x[a-fA-F0-9]{40}$/,
  
  /** Amount validation regex */
  AMOUNT_REGEX: /^\d+(\.\d+)?$/,
} as const;

export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
} as const;

export const CACHE_KEYS = {
  TOKENS: 'lending_tokens',
  POSITION: 'lending_position',
  QUOTES: 'lending_quotes',
} as const;

export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export const WALLET_TYPES = {
  SMART_WALLET: 'smart_wallet',
  PRIVATE_KEY: 'private_key',
} as const;

export const CHAIN_IDS = {
  AVALANCHE: 43114,
  ETHEREUM: 1,
  POLYGON: 137,
  BSC: 56,
} as const;

export type LendingConfigType = typeof LENDING_CONFIG;
export type ApiEndpointsType = typeof API_ENDPOINTS;
export type FallbackTokensType = typeof FALLBACK_TOKENS;
export type ErrorMessagesType = typeof ERROR_MESSAGES;
export type SuccessMessagesType = typeof SUCCESS_MESSAGES;
export type ValidationRulesType = typeof VALIDATION_RULES;
export type LogLevelsType = typeof LOG_LEVELS;
export type CacheKeysType = typeof CACHE_KEYS;
export type TransactionStatusType = typeof TRANSACTION_STATUS;
export type WalletTypesType = typeof WALLET_TYPES;
export type ChainIdsType = typeof CHAIN_IDS;
