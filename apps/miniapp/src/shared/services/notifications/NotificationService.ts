/**
 * Abstract Notification Service Interface
 *
 * This interface defines the contract for notification services.
 * Implement this interface to create new notification backends:
 * - LocalStorageNotificationService (current)
 * - RedisNotificationService (future)
 * - RabbitMQNotificationService (future)
 * - WebSocketNotificationService (future)
 */

import type {
  NotificationData,
  CreateNotificationInput,
  NotificationFilter,
  NotificationServiceConfig,
  NotificationSubscriber,
} from './types';

export interface INotificationService {
  /**
   * Initialize the notification service
   */
  initialize(): Promise<void>;

  /**
   * Create a new notification
   * @returns The created notification with generated ID and timestamp
   */
  create(input: CreateNotificationInput): Promise<NotificationData>;

  /**
   * Get a notification by ID
   */
  getById(id: string): Promise<NotificationData | null>;

  /**
   * Get all notifications, optionally filtered
   */
  getAll(filter?: NotificationFilter): Promise<NotificationData[]>;

  /**
   * Get unread notifications count
   */
  getUnreadCount(): Promise<number>;

  /**
   * Mark a notification as read
   */
  markAsRead(id: string): Promise<void>;

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): Promise<void>;

  /**
   * Remove a notification by ID
   */
  remove(id: string): Promise<void>;

  /**
   * Clear all notifications
   */
  clearAll(): Promise<void>;

  /**
   * Subscribe to notification events
   * @returns Unsubscribe function
   */
  subscribe(subscriber: NotificationSubscriber): () => void;

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void;
}

/**
 * Base class with common functionality for notification services
 */
export abstract class BaseNotificationService implements INotificationService {
  protected config: Required<NotificationServiceConfig>;
  protected subscribers: Set<NotificationSubscriber> = new Set();

  constructor(config: NotificationServiceConfig = {}) {
    this.config = {
      maxNotifications: config.maxNotifications ?? 100,
      defaultAutoDismissMs: config.defaultAutoDismissMs ?? 0,
      storageKeyPrefix: config.storageKeyPrefix ?? 'panorama_notifications',
    };
  }

  abstract initialize(): Promise<void>;
  abstract create(input: CreateNotificationInput): Promise<NotificationData>;
  abstract getById(id: string): Promise<NotificationData | null>;
  abstract getAll(filter?: NotificationFilter): Promise<NotificationData[]>;
  abstract getUnreadCount(): Promise<number>;
  abstract markAsRead(id: string): Promise<void>;
  abstract markAllAsRead(): Promise<void>;
  abstract remove(id: string): Promise<void>;
  abstract clearAll(): Promise<void>;

  subscribe(subscriber: NotificationSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  protected notify(event: Parameters<NotificationSubscriber>[0]): void {
    this.subscribers.forEach((subscriber) => {
      try {
        subscriber(event);
      } catch (error) {
        console.error('[NotificationService] Subscriber error:', error);
      }
    });
  }

  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  dispose(): void {
    this.subscribers.clear();
  }
}
