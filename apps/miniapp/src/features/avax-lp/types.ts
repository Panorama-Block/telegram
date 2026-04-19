export type AvaxLpAction = 'add' | 'remove' | 'stake' | 'unstake' | 'claim';

export interface AvaxTokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  isNative?: boolean;
}

export interface AvaxLpPool {
  poolId: number;
  name: string;
  tokenA: AvaxTokenInfo;
  tokenB: AvaxTokenInfo;
  lpTokenAddress: string;
  farmAddress: string | null;
  estimatedAPR: string | null;
  totalLiquidityUsd: string | null;
  totalStaked: string;
  rewardToken: AvaxTokenInfo | null;
}

export interface AvaxLpUserPosition {
  poolId: number;
  poolName: string;
  lpTokenAddress: string;
  tokenA: AvaxTokenInfo;
  tokenB: AvaxTokenInfo;
  walletLpBalance: string;
  stakedBalance: string;
  pendingRewards: string;
  rewardToken: AvaxTokenInfo | null;
  farmAddress: string | null;
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

export interface AvaxLpPrepareResponse {
  bundle: TransactionBundle;
  metadata: Record<string, unknown>;
}

export interface TransactionExecutionStatus {
  transactionHash: string;
  confirmed: boolean;
  source?: 'wallet' | 'recovered';
}
