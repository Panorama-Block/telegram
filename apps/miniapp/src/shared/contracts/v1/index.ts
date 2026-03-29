/**
 * Versioned response contracts — v1
 *
 * Canonical TypeScript types that mirror backend API schemas.
 * Both API clients and React components should reference these types.
 * Zod runtime validation lives in shared/lib/responseSchemas.ts.
 */

export const SCHEMA_VERSION = 'v1' as const;

// ── Error Contract ────────────────────────────────────────────────

export interface ErrorContract {
  code: string;
  message: string;
  traceId?: string;
}

export interface ErrorResponseContract {
  success: false;
  error: ErrorContract;
}

// ── Execution Contract ────────────────────────────────────────────

export interface PreparedTransactionContract {
  to: string;
  data: string;
  value: string;
  chainId: number;
  description?: string;
}

export interface TransactionBundleContract {
  steps: PreparedTransactionContract[];
  totalSteps: number;
  summary: string;
}

export interface ExecutionResultContract {
  transactionHash: string;
  confirmed: boolean;
  source?: 'wallet' | 'recovered';
}

// ── Quote Contract ────────────────────────────────────────────────

export interface QuoteContract {
  success: boolean;
  quote?: {
    fromChainId: number;
    toChainId: number;
    fromToken: string;
    toToken: string;
    amount: string;
    estimatedReceiveAmount: string;
    estimatedDuration?: number;
    exchangeRate?: string;
    fees?: {
      bridgeFee?: string;
      gasFee?: string;
      totalFee?: string;
      totalFeeUsd?: string;
    };
    provider?: string;
  };
  message?: string;
}

// ── Prepare Contract ──────────────────────────────────────────────

export interface PrepareContract {
  prepared?: {
    transactions?: Array<{
      to: string;
      data: string;
      value?: string | number | null;
      chainId: number;
      gasLimit?: string | number | null;
    }>;
    steps?: Array<{
      name?: string;
      chainId: number;
      transactions: Array<{
        to: string;
        data: string;
        value?: string | number | null;
        chainId: number;
      }>;
    }>;
    metadata?: Record<string, unknown>;
  };
  provider?: string;
  message?: string;
}

// ── Portfolio Contract ────────────────────────────────────────────

export interface TokenInfoContract {
  symbol: string;
  address: string;
  decimals: number;
}

export interface PortfolioAssetContract {
  poolId: string;
  poolName: string;
  tokenA: TokenInfoContract & { balance: string };
  tokenB: TokenInfoContract & { balance: string };
  lpStaked: string;
  pendingRewards: string;
  rewardTokenSymbol: string;
}

export interface PortfolioContract {
  userAddress: string;
  totalPositions: number;
  assets: PortfolioAssetContract[];
  walletBalances: Record<string, string>;
}

// ── Yield / Staking Contract ──────────────────────────────────────

export interface YieldPoolContract {
  id: string;
  name: string;
  tokenA: TokenInfoContract;
  tokenB: TokenInfoContract;
  stable: boolean;
  poolAddress: string;
  gaugeAddress: string;
  gaugeAlive: boolean;
  rewardToken: TokenInfoContract;
  totalStaked: string;
  rewardRate: string;
}

export interface UserPositionContract {
  poolId: string;
  poolName: string;
  poolAddress: string;
  gaugeAddress: string;
  tokenA: TokenInfoContract;
  tokenB: TokenInfoContract;
  stable: boolean;
  stakedBalance: string;
  walletLpBalance: string;
  earnedRewards: string;
  rewardToken: TokenInfoContract;
}

// ── Lending Contract ──────────────────────────────────────────────

export interface LendingTokenContract {
  symbol: string;
  address: string;
  qTokenAddress: string;
  decimals: number;
  supplyAPY: string;
  borrowAPY: string;
  collateralFactor: string;
  availableLiquidity: string;
  icon?: string;
}

export interface LendingPositionContract {
  supplied: Array<{
    symbol: string;
    qTokenAddress: string;
    underlyingBalance: string;
    qTokenBalance: string;
  }>;
  borrowed: Array<{
    symbol: string;
    qTokenAddress: string;
    borrowBalance: string;
  }>;
  healthFactor: string | null;
}
