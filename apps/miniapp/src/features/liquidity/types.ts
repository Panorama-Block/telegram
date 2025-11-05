/**
 * Liquidity Provision Types
 * Based on Uniswap V3 style liquidity provision
 */

export type LiquidityToken = {
  symbol: string;
  address: string;
  amount: string; // human-readable
  amountWei?: string;
  decimals: number;
  usdValue?: string;
};

export type PriceRange = {
  min: string; // price of token1 per token0
  max: string;
  current: string;
};

export type LiquidityQuoteRequest = {
  chainId: number;
  token0: string; // address or "native"
  token1: string; // address or "native"
  amount0: string; // human-readable amount
  amount1: string; // human-readable amount
  feeTier?: number; // 0.01%, 0.05%, 0.3%, 1% -> 100, 500, 3000, 10000
  priceRangeLower?: string; // optional for concentrated liquidity
  priceRangeUpper?: string;
};

export type LiquidityQuoteResponse = {
  success: boolean;
  quote?: {
    chainId: number;
    poolAddress?: string;
    token0: LiquidityToken;
    token1: LiquidityToken;
    feeTier: number; // basis points
    feeTierLabel: string; // "0.01%", "0.3%", etc
    priceRange: PriceRange;
    liquidityAmount: string; // LP tokens to receive
    shareOfPool: string; // percentage
    estimatedApr?: string; // annual percentage rate
    estimatedGasFee?: string; // in native token
    estimatedGasFeeUsd?: string;
  };
  message?: string;
};

export type LiquidityPrepareRequest = {
  chainId: number;
  token0: string;
  token1: string;
  amount0Wei: string;
  amount1Wei: string;
  feeTier: number;
  priceRangeLower?: string;
  priceRangeUpper?: string;
  sender: string;
  slippageTolerance?: number; // in basis points, e.g., 50 = 0.5%
};

export type LiquidityPreparedTx = {
  to: string;
  data: string;
  value?: string | number | bigint | null;
  chainId: number;
  gasLimit?: string | number | bigint | null;
  maxFeePerGas?: string | number | bigint | null;
  maxPriorityFeePerGas?: string | number | bigint | null;
};

export type LiquidityPrepareResponse = {
  success: boolean;
  prepared?: {
    transactions: LiquidityPreparedTx[];
    steps?: Array<{
      name: string;
      description: string;
      transactions: LiquidityPreparedTx[];
    }>;
    estimatedGas?: string;
  };
  message?: string;
};

export type LiquidityPositionStatus = {
  success: boolean;
  data?: {
    positionId: string;
    poolAddress: string;
    transactionHash: string;
    chainId: number;
    token0Amount: string;
    token1Amount: string;
    liquidityAmount: string;
    status: 'pending' | 'confirmed' | 'failed';
  };
  message?: string;
};

export type FeeTier = {
  value: number; // basis points
  label: string; // "0.01%"
  description: string; // "Best for very stable pairs"
  isRecommended?: boolean;
};

export const FEE_TIERS: FeeTier[] = [
  {
    value: 100,
    label: '0.01%',
    description: 'Best for very stable pairs',
  },
  {
    value: 500,
    label: '0.05%',
    description: 'Best for stable pairs',
  },
  {
    value: 3000,
    label: '0.3%',
    description: 'Best for most pairs',
    isRecommended: true,
  },
  {
    value: 10000,
    label: '1%',
    description: 'Best for exotic pairs',
  },
];
