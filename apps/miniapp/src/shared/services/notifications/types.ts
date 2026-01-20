/**
 * Notification System Types
 *
 * This file defines the core types for the notification system.
 * The system is designed to be modular, allowing easy migration
 * from localStorage to a queue system (RabbitMQ, Redis, etc.)
 */

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'pending';

export type NotificationCategory =
  | 'transaction'
  | 'swap'
  | 'staking'
  | 'lending'
  | 'dca'
  | 'wallet'
  | 'system';

export interface TransactionMetadata {
  hash?: string;
  chainId?: number;
  fromToken?: string;
  toToken?: string;
  fromAmount?: string;
  toAmount?: string;
  explorerUrl?: string;
  provider?: string;
}

export interface NotificationData {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  metadata?: TransactionMetadata;
  /** Auto-dismiss after this many ms (0 = never) */
  autoDismissMs?: number;
}

export interface CreateNotificationInput {
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  metadata?: TransactionMetadata;
  autoDismissMs?: number;
}

export interface NotificationFilter {
  type?: NotificationType;
  category?: NotificationCategory;
  read?: boolean;
  fromTimestamp?: number;
  toTimestamp?: number;
}

export interface NotificationServiceConfig {
  /** Maximum notifications to store */
  maxNotifications?: number;
  /** Default auto-dismiss time in ms (0 = never) */
  defaultAutoDismissMs?: number;
  /** Storage key prefix */
  storageKeyPrefix?: string;
}

/**
 * Notification event types for subscribers
 */
export type NotificationEvent =
  | { type: 'added'; notification: NotificationData }
  | { type: 'updated'; notification: NotificationData }
  | { type: 'removed'; notificationId: string }
  | { type: 'cleared' }
  | { type: 'bulk_update'; notifications: NotificationData[] };

export type NotificationSubscriber = (event: NotificationEvent) => void;
