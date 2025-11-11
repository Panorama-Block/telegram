export type StakingToken = {
  symbol: string;
  address: string;
  icon?: string;
  decimals: number;
  stakingAPY: number;
  totalStaked: string;
  totalRewards: string;
  minimumStake: string;
  lockPeriod: number; // in days
  isActive: boolean;
};

export type StakingPosition = {
  token: StakingToken;
  stakedAmount: string;
  pendingRewards: string;
  stakingStartTime: number;
  lockEndTime?: number;
  isLocked: boolean;
  canWithdraw: boolean;
};

export type StakingAction = 'stake' | 'unstake' | 'claim' | 'restake';

export type StakingRequest = {
  action: StakingAction;
  tokenAddress: string;
  amount: string;
  userAddress: string;
  chainId: number;
  lockPeriod?: number;
};

export type StakingResponse = {
  success: boolean;
  transactionHash?: string;
  message?: string;
  position?: StakingPosition;
};

export type StakingPool = {
  chainId: number;
  protocol: string;
  tokens: StakingToken[];
  totalValueStaked: string;
  totalRewardsDistributed: string;
  averageAPY: number;
};

