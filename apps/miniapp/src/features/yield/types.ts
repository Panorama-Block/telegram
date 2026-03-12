export type YieldAction = 'enter' | 'exit' | 'claim';

export interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
}

export interface YieldPool {
  id: string;
  name: string;
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  stable: boolean;
  poolAddress: string;
  gaugeAddress: string;
  gaugeAlive: boolean;
  rewardToken: TokenInfo;
  totalStaked: string;
  rewardRate: string;
}

export interface PoolProtocolInfo {
  poolId: string;
  poolName: string;
  poolAddress: string;
  gaugeAddress: string;
  stable: boolean;
  rewardRatePerSecond: string;
  totalStaked: string;
  estimatedAPR: string;
  totalLiquidityUsd?: string | null;
}

export interface UserPosition {
  poolId: string;
  poolName: string;
  poolAddress: string;
  gaugeAddress: string;
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  stable: boolean;
  stakedBalance: string;
  earnedRewards: string;
  rewardToken: TokenInfo;
}

export interface PortfolioAsset {
  poolId: string;
  poolName: string;
  tokenA: TokenInfo & { balance: string };
  tokenB: TokenInfo & { balance: string };
  lpStaked: string;
  pendingRewards: string;
  rewardTokenSymbol: string;
}

export interface Portfolio {
  userAddress: string;
  totalPositions: number;
  assets: PortfolioAsset[];
  walletBalances: Record<string, string>;
}

export interface PreparedTransaction {
  to: string;
  data: string;
  value: string;
  chainId: number;
  description?: string;
}

export interface TransactionBundle {
  steps: PreparedTransaction[];
  totalSteps: number;
  summary: string;
}

export interface YieldPrepareResponse {
  bundle: TransactionBundle;
  metadata: Record<string, unknown>;
}

export interface TransactionExecutionStatus {
  transactionHash: string;
  confirmed: boolean;
  source?: 'wallet' | 'recovered';
}

/** Pool merged with APR data from protocol-info */
export interface YieldPoolWithAPR extends YieldPool {
  estimatedAPR: string | null;
  totalLiquidityUsd: string | null;
}
