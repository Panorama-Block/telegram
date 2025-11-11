/**
 * Lending Service Type Definitions
 * 
 * This file contains all TypeScript interfaces and types used by the Lending Service.
 * It provides type safety and better developer experience when working with the API.
 */

export interface LendingToken {
  /** Token symbol (e.g., "AVAX", "USDC") */
  symbol: string;
  
  /** Contract address of the token */
  address: string;
  
  /** Optional URL for token icon */
  icon?: string;
  
  /** Number of decimal places for the token */
  decimals: number;
  
  /** Annual Percentage Yield for supplying this token */
  supplyAPY: number;
  
  /** Annual Percentage Yield for borrowing this token */
  borrowAPY: number;
  
  /** Total amount supplied across all users */
  totalSupply: string;
  
  /** Total amount borrowed across all users */
  totalBorrowed: string;
  
  /** Available liquidity for borrowing */
  availableLiquidity: string;
  
  /** Collateral factor (0-1) determining how much can be borrowed against this token */
  collateralFactor: number;
  
  /** Whether this token can be used as collateral */
  isCollateral: boolean;
}

export interface LendingPosition {
  /** Token information */
  token: LendingToken;
  
  /** Amount supplied by the user */
  suppliedAmount: string;
  
  /** Amount borrowed by the user */
  borrowedAmount: string;
  
  /** Total value of supplied tokens in USD */
  collateralValue: string;
  
  /** Total value of borrowed tokens in USD */
  borrowValue: string;
  
  /** Health factor indicating position safety (higher is safer) */
  healthFactor: number;
  
  /** Threshold below which position can be liquidated */
  liquidationThreshold: number;
}

export interface LendingAction {
  /** Type of lending action */
  action: 'supply' | 'withdraw' | 'borrow' | 'repay';
  
  /** Token address for the action */
  token: string;
  
  /** Amount for the action */
  amount: string;
}

export interface ValidationResponse {
  /** HTTP status code */
  status: number;
  
  /** Response message */
  msg: string;
  
  /** Validation data */
  data: {
    /** Amount being validated */
    amount: string;
    
    /** Tax amount to be paid */
    taxAmount: string;
    
    /** Tax rate applied */
    taxRate: string;
    
    /** Amount remaining after tax */
    restAmount: string;
  };
}

export interface SwapResponse {
  /** HTTP status code */
  status: number;
  
  /** Response message */
  msg: string;
  
  /** Swap transaction data */
  data: {
    /** Blockchain chain ID */
    chainId: string;
    
    /** From token address */
    from: string;
    
    /** To token address */
    to: string;
    
    /** Value in wei */
    value: string;
    
    /** Gas limit */
    gas: string;
    
    /** Transaction data */
    data: string;
    
    /** Gas price in wei */
    gasPrice: string;
    
    /** Reference ID for tracking */
    referenceId: string;
    
    /** Transaction status */
    status: string;
    
    /** Additional note */
    note: string;
  };
}

export interface TransactionData {
  /** Recipient address */
  to: string;
  
  /** Transaction value in wei */
  value: string;
  
  /** Transaction data (encoded function call) */
  data: string;
  
  /** Gas limit */
  gasLimit: string;
  
  /** Gas price in wei (optional) */
  gasPrice?: string;
  
  /** Chain ID */
  chainId: number;
}

export interface AuthData {
  /** User wallet address */
  address: string;
  
  /** Signature of the message */
  signature: string;
  
  /** Original message that was signed */
  message: string;
  
  /** Timestamp when message was created */
  timestamp: number;
  
  /** Type of wallet used */
  walletType: 'smart_wallet' | 'private_key';
  
  /** Blockchain chain ID */
  chainId: number;
  
  /** Whether this is a smart wallet */
  isSmartWallet: boolean;
}

export interface CacheStatus {
  /** Whether cache has data */
  hasCache: boolean;
  
  /** Age of cached data in milliseconds */
  cacheAge: number;
  
  /** Whether cache has expired */
  isExpired: boolean;
}

export interface LendingConfig {
  /** API base URL */
  baseUrl: string;
  
  /** Cache duration in milliseconds */
  cacheDuration: number;
  
  /** Request timeout in milliseconds */
  requestTimeout: number;
  
  /** Default chain ID */
  chainId: number;
  
  /** Default wallet type */
  walletType: 'smart_wallet' | 'private_key';
}

export interface LendingError extends Error {
  /** Error code */
  code?: string;
  
  /** HTTP status code if applicable */
  status?: number;
  
  /** Additional error data */
  data?: any;
}

export type LendingActionType = 'supply' | 'withdraw' | 'borrow' | 'repay';

export type LendingStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface LendingTransaction {
  /** Unique transaction ID */
  id: string;
  
  /** User address */
  userAddress: string;
  
  /** Type of transaction */
  type: LendingActionType;
  
  /** Amount involved */
  amount: string;
  
  /** Token address */
  tokenAddress: string;
  
  /** Transaction status */
  status: LendingStatus;
  
  /** Transaction hash (if executed) */
  transactionHash?: string;
  
  /** Block number (if confirmed) */
  blockNumber?: number;
  
  /** Gas used */
  gasUsed?: string;
  
  /** Timestamp */
  timestamp: Date;
  
  /** Transaction data for execution */
  transactionData?: TransactionData;
}

export interface LendingQuote {
  /** Token address */
  tokenAddress: string;
  
  /** Amount */
  amount: string;
  
  /** APY for the operation */
  apy: number;
  
  /** Fees involved */
  fees: {
    /** Protocol fee */
    protocol: string;
    
    /** Gas fee estimate */
    gas: string;
    
    /** Total fees */
    total: string;
  };
  
  /** Expected outcome */
  expected: {
    /** Amount after fees */
    netAmount: string;
    
    /** Interest earned/paid */
    interest: string;
  };
}

export interface LendingStats {
  /** Total value locked across all tokens */
  totalValueLocked: string;
  
  /** Total borrowed across all tokens */
  totalBorrowed: string;
  
  /** Number of active users */
  activeUsers: number;
  
  /** Number of active tokens */
  activeTokens: number;
  
  /** Average APY across all tokens */
  averageAPY: number;
  
  /** Last updated timestamp */
  lastUpdated: Date;
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// API Response types
export interface ApiResponse<T = any> {
  status: number;
  msg: string;
  data: T;
}

export interface PaginatedResponse<T = any> {
  status: number;
  msg: string;
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

// Event types for real-time updates
export interface LendingEvent {
  type: 'position_updated' | 'token_updated' | 'transaction_completed';
  data: any;
  timestamp: Date;
}

export interface LendingEventListener {
  (event: LendingEvent): void;
}