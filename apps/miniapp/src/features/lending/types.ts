export type LendingToken = {
  symbol: string;
  address: string;
  icon?: string;
  decimals: number;
  supplyAPY: number;
  borrowAPY: number;
  totalSupply: string;
  totalBorrowed: string;
  availableLiquidity: string;
  collateralFactor: number;
  isCollateral: boolean;
};

export type LendingPosition = {
  token: LendingToken;
  suppliedAmount: string;
  borrowedAmount: string;
  collateralValue: string;
  borrowValue: string;
  healthFactor: number;
  liquidationThreshold: number;
};

export type LendingAction = 'supply' | 'withdraw' | 'borrow' | 'repay';

export type LendingRequest = {
  action: LendingAction;
  tokenAddress: string;
  amount: string;
  userAddress: string;
  chainId: number;
};

export type LendingResponse = {
  success: boolean;
  transactionHash?: string;
  message?: string;
  position?: LendingPosition;
};

export type LendingMarket = {
  chainId: number;
  protocol: string;
  tokens: LendingToken[];
  totalValueLocked: string;
  totalBorrowed: string;
  utilizationRate: number;
};

