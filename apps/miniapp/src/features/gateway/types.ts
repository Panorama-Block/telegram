// ============================================================================
// GATEWAY API TYPES
// Types para comunicação com o Database Gateway
// ============================================================================

// ----------------------------------------------------------------------------
// Base Types
// ----------------------------------------------------------------------------

export type WalletType = 'ton' | 'evm' | 'smart_wallet' | 'panorama_wallet';

export type PositionType = 'balance' | 'supply' | 'borrow' | 'stake' | 'lp' | 'derivative' | 'reward';

export type TransactionAction =
  | 'swap'
  | 'bridge'
  | 'stake'
  | 'unstake'
  | 'supply'
  | 'withdraw'
  | 'borrow'
  | 'repay'
  | 'claim'
  | 'approve';

export type TransactionStatus =
  | 'created'
  | 'submitted'
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'refunded';

export type TxHashType = 'approval' | 'swap' | 'bridge' | 'stake' | 'lend' | 'other';

export type NotificationType =
  | 'tx_confirmed'
  | 'tx_failed'
  | 'health_warning'
  | 'price_alert'
  | 'dca_executed'
  | 'stake_matured'
  | 'welcome';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type PositionSource = 'onchain' | 'cached' | 'api';

// ----------------------------------------------------------------------------
// Wallet
// ----------------------------------------------------------------------------

export interface Wallet {
  id: string;
  userId: string;
  chain: string;
  address: string;
  walletType: WalletType;
  name?: string;
  isPrimary: boolean;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWalletInput {
  userId: string;
  chain: string;
  address: string;
  walletType: WalletType;
  name?: string;
  isPrimary?: boolean;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
  tenantId: string;
}

export interface UpdateWalletInput {
  name?: string;
  isPrimary?: boolean;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Transaction
// ----------------------------------------------------------------------------

export interface TxHash {
  hash: string;
  chainId: number;
  type?: TxHashType;
  status?: 'pending' | 'success' | 'failed';
}

export interface Transaction {
  id: string;
  userId: string;
  walletId: string;
  conversationId?: string;

  // Action
  action: TransactionAction;
  protocol?: string;

  // From
  fromChainId: number;
  fromAssetAddress: string;
  fromAssetSymbol: string;
  fromAssetDecimals: number;
  fromAmountRaw: string;
  fromAmountDisplay: string;
  fromAmountUsd?: string;

  // To
  toChainId?: number;
  toAssetAddress?: string;
  toAssetSymbol?: string;
  toAssetDecimals?: number;
  toAmountRaw?: string;
  toAmountDisplay?: string;
  toAmountUsd?: string;

  // Execution
  txHashes: TxHash[];
  status: TransactionStatus;
  provider?: string;

  // Fees
  gasFee?: string;
  bridgeFee?: string;
  protocolFee?: string;
  totalFeeUsd?: string;

  // Exchange info
  exchangeRate?: string;
  slippage?: string;
  priceImpact?: string;

  // Error
  errorCode?: string;
  errorMessage?: string;

  // Bridge
  bridgeId?: string;

  // Meta
  metadata?: Record<string, unknown>;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
}

export interface CreateTransactionInput {
  userId: string;
  walletId: string;
  conversationId?: string;

  action: TransactionAction;
  protocol?: string;

  // From
  fromChainId: number;
  fromAssetAddress: string;
  fromAssetSymbol: string;
  fromAssetDecimals: number;
  fromAmountRaw: string;
  fromAmountDisplay: string;
  fromAmountUsd?: string;

  // To
  toChainId?: number;
  toAssetAddress?: string;
  toAssetSymbol?: string;
  toAssetDecimals?: number;
  toAmountRaw?: string;
  toAmountDisplay?: string;
  toAmountUsd?: string;

  // Execution
  txHashes?: TxHash[];
  status?: TransactionStatus;
  provider?: string;

  // Fees
  gasFee?: string;
  bridgeFee?: string;
  protocolFee?: string;
  totalFeeUsd?: string;

  // Exchange info
  exchangeRate?: string;
  slippage?: string;
  priceImpact?: string;

  // Bridge
  bridgeId?: string;

  // Meta
  metadata?: Record<string, unknown>;
  tenantId: string;
}

export interface UpdateTransactionInput {
  // To (pode ser atualizado com valor real após execução)
  toAmountRaw?: string;
  toAmountDisplay?: string;
  toAmountUsd?: string;

  // Execution
  txHashes?: TxHash[];
  status?: TransactionStatus;

  // Fees
  gasFee?: string;
  bridgeFee?: string;
  protocolFee?: string;
  totalFeeUsd?: string;

  // Error
  errorCode?: string;
  errorMessage?: string;

  // Bridge
  bridgeId?: string;

  // Meta
  metadata?: Record<string, unknown>;
  confirmedAt?: string;
}

// ----------------------------------------------------------------------------
// Position Snapshot
// ----------------------------------------------------------------------------

export interface PositionSnapshot {
  id: string;
  userId: string;
  walletId: string;
  chain: string;

  protocol: string;
  market?: string;
  positionType: PositionType;

  assetAddress: string;
  assetSymbol: string;
  assetDecimals: number;

  amountRaw: string;
  amountDisplay: string;
  amountUsd?: string;
  priceUsd?: string;

  accruedRaw?: string;
  accruedDisplay?: string;
  apy?: string;
  healthFactor?: string;

  snapshotBlock?: string;
  snapshotTimestamp: string;
  source: PositionSource;

  metadata?: Record<string, unknown>;
  tenantId: string;
  createdAt: string;
}

export interface CreatePositionSnapshotInput {
  userId: string;
  walletId: string;
  chain: string;

  protocol: string;
  market?: string;
  positionType: PositionType;

  assetAddress: string;
  assetSymbol: string;
  assetDecimals: number;

  amountRaw: string;
  amountDisplay: string;
  amountUsd?: string;
  priceUsd?: string;

  accruedRaw?: string;
  accruedDisplay?: string;
  apy?: string;
  healthFactor?: string;

  snapshotBlock?: number | bigint;
  snapshotTimestamp: string;
  source: PositionSource;

  metadata?: Record<string, unknown>;
  tenantId: string;
}

// ----------------------------------------------------------------------------
// Notification
// ----------------------------------------------------------------------------

export interface Notification {
  id: string;
  userId: string;
  transactionId?: string;

  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;

  priority: NotificationPriority;
  actionUrl?: string;
  actionLabel?: string;

  isRead: boolean;
  isDismissed: boolean;

  expiresAt?: string;
  tenantId: string;
  createdAt: string;
  readAt?: string;
}

export interface CreateNotificationInput {
  userId: string;
  transactionId?: string;

  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;

  priority?: NotificationPriority;
  actionUrl?: string;
  actionLabel?: string;

  expiresAt?: string;
  tenantId: string;
}

export interface UpdateNotificationInput {
  isRead?: boolean;
  isDismissed?: boolean;
  readAt?: string;
}

// ----------------------------------------------------------------------------
// API Response Types
// ----------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[];
  page: {
    take: number;
    skip: number;
    nextCursor?: Record<string, unknown>;
  };
}

export interface GatewayError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}
