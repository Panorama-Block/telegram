export type SwapErrorCode =
  | 'INVALID_TOKEN_ADDRESS'
  | 'INVALID_AMOUNT'
  | 'INVALID_CHAIN'
  | 'INVALID_SLIPPAGE'
  | 'INVALID_DEADLINE'
  | 'MISSING_REQUIRED_PARAMS'
  | 'INVALID_REQUEST'
  | 'NO_ROUTE_FOUND'
  | 'INSUFFICIENT_LIQUIDITY'
  | 'UNSUPPORTED_CHAIN'
  | 'UNSUPPORTED_TOKEN'
  | 'PRICE_IMPACT_TOO_HIGH'
  | 'SLIPPAGE_TOO_HIGH'
  | 'APPROVAL_REQUIRED'
  | 'INSUFFICIENT_BALANCE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'QUOTA_EXCEEDED'
  | 'PROVIDER_ERROR'
  | 'RPC_ERROR'
  | 'TIMEOUT'
  | 'CACHE_ERROR'
  | 'DATABASE_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'SERVICE_UNAVAILABLE'
  | 'MAINTENANCE'
  | 'UNKNOWN_ERROR'
  | (string & {});

export type UserFacingErrorCategory = 'user-action' | 'temporary' | 'blocked' | 'unknown';

export type UserFacingErrorActions = {
  primary: {
    type: 'retry';
    label: string;
    disabledUntil?: string;
  };
  secondary?: {
    type: 'support' | 'docs';
    label: string;
    href?: string;
  };
};

export type UserFacingErrorDetails = {
  code: SwapErrorCode;
  category: UserFacingErrorCategory;
  title: string;
  description: string;
  actions: UserFacingErrorActions;
  traceId: string;
  canRetry: boolean;
  retryAfterSeconds?: number;
};

export type UserFacingErrorResponse = {
  success: false;
  error: UserFacingErrorDetails;
};

export type QuoteRequest = {
  fromChainId: number;
  toChainId: number;
  fromToken: string; // "native" or ERC-20 address
  toToken: string;   // "native" or ERC-20 address
  amount: string;    // token units (human-readable decimal string) OR wei (see unit)
  // IMPORTANT: Always send unit explicitly to avoid double-conversion bugs.
  unit: 'token' | 'wei';
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
    provider?: string; // Provider used for quote (e.g., 'uniswap-trading-api')
    // Bridge specific properties
    sourceNetwork?: string;
    destinationNetwork?: string;
    sourceToken?: string;
    destinationToken?: string;
    fee?: number;
    toAmount?: string; // Alias for estimatedReceiveAmount in some contexts
    refuelAmount?: number;
    refuelAmountInUsd?: number;
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
  provider?: string; // Optional: force specific provider (from quote response)
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
    metadata?: Record<string, any>;
  };
  provider?: string; // Provider name (e.g., 'uniswap-smart-router', 'thirdweb')
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
