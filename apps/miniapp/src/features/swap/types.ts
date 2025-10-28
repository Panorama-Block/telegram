export type QuoteRequest = {
  fromChainId: number;
  toChainId: number;
  fromToken: string; // "native" or ERC-20 address
  toToken: string;   // "native" or ERC-20 address
  amount: string;    // token units (human-readable decimal string)
  smartAccountAddress?: string | null;
};

export type QuoteResponse = {
  success: boolean;
  quote?: {
    fromChainId: number;
    toChainId: number;
    fromToken: string;
    toToken: string;
    amount: string; // wei string
    amountHuman?: string;
    amountUsd?: string;
    estimatedReceiveAmount: string; // wei string
    estimatedReceiveAmountUsd?: string;
    estimatedDuration?: number; // seconds or ms depending on backend
    exchangeRate?: string;
    fees?: {
      bridgeFee?: string;
      gasFee?: string;
      totalFee?: string;
      totalFeeUsd?: string;
    };
  };
  message?: string;
};

export type PrepareRequest = {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  amount: string; // wei string
  sender?: string;
};

export type PreparedTx = {
  to: string;
  data: string;
  value?: string | number | bigint | null;
  chainId: number;
  gasLimit?: string | number | bigint | null;
  maxFeePerGas?: string | number | bigint | null;
  maxPriorityFeePerGas?: string | number | bigint | null;
};

export type PrepareResponse = {
  prepared?: {
    transactions?: PreparedTx[];
    steps?: Array<{
      name?: string;
      chainId: number;
      transactions: PreparedTx[];
    }>;
    estimatedExecutionTimeMs?: number;
  };
  message?: string;
};

export type StatusResponse = {
  success: boolean;
  data?: {
    status: string;
    transactionHash: string;
    chainId: number;
    userAddress?: string;
  };
};
