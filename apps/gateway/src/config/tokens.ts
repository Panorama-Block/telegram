// Token configurations for supported chains
export interface Token {
  symbol: string;
  address: string;
}

export interface TokenConfig {
  [chainId: number]: Token[];
}

export const SUPPORTED_CHAINS = {
  ETHEREUM: 1,
  POLYGON: 137,
  BASE: 8453,
} as const;

export const TOKENS: TokenConfig = {
  [SUPPORTED_CHAINS.ETHEREUM]: [
    { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000' },
    { symbol: 'USDC', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
    { symbol: 'USDT', address: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
    { symbol: 'WBTC', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599' }
  ],
  [SUPPORTED_CHAINS.POLYGON]: [
    { symbol: 'MATIC', address: '0x0000000000000000000000000000000000000000' },
    { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
    { symbol: 'USDT', address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f' }
  ],
  [SUPPORTED_CHAINS.BASE]: [
    { symbol: 'ETH', address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' }
  ]
};

// Helper functions
export function getTokenBySymbol(chainId: number, symbol: string): Token | undefined {
  return TOKENS[chainId]?.find(token => token.symbol === symbol);
}

export function getSupportedTokens(chainId: number): Token[] {
  return TOKENS[chainId] || [];
}

export function isChainSupported(chainId: number): boolean {
  return chainId in TOKENS;
}
