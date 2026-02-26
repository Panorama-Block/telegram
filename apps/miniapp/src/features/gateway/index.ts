// ============================================================================
// GATEWAY MODULE
// Módulo para comunicação com o Database Gateway
// ============================================================================

// Types
export type {
  // Base types
  WalletType,
  PositionType,
  TransactionAction,
  TransactionStatus,
  TxHashType,
  NotificationType,
  NotificationPriority,
  PositionSource,

  // Wallet
  Wallet,
  CreateWalletInput,
  UpdateWalletInput,

  // Transaction
  TxHash,
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,

  // Position Snapshot
  PositionSnapshot,
  CreatePositionSnapshotInput,

  // Notification
  Notification,
  CreateNotificationInput,
  UpdateNotificationInput,

  // API
  PaginatedResponse,
  GatewayError,
} from './types';

// API Client
export { gatewayApi, GatewayApiError, isGatewayUnavailableError, type QueryParams } from './api';

// Wallet API
export {
  walletApi,
  getWalletTypeFromChain,
  getChainFromChainId,
} from './walletApi';

// Transaction API
export { transactionApi } from './transactionApi';

// Notification API
export { notificationApi } from './notificationApi';

// React Hooks
export {
  useWallet,
  useTransactionHistory,
  useTransactionTracker,
  useNotifications,
} from './hooks';

// Swap Integration
export {
  startSwapTracking,
  getSwapHistory,
  getBridgeHistory,
  getPendingTransactions,
  ensureWalletRegistered,
  type SwapParams,
  type SwapTracker,
} from './swapIntegration';
