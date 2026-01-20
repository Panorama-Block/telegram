/**
 * LocalStorage-based Notification Service
 *
 * This implementation stores notifications in localStorage.
 * It can be easily replaced with a queue-based implementation
 * (Redis, RabbitMQ, etc.) by implementing the same interface.
 */

import { BaseNotificationService } from './NotificationService';
import type {
  NotificationData,
  CreateNotificationInput,
  NotificationFilter,
  NotificationServiceConfig,
} from './types';

export class LocalStorageNotificationService extends BaseNotificationService {
  private storageKey: string;
  private notifications: NotificationData[] = [];
  private initialized = false;
  private storageListener: ((event: StorageEvent) => void) | null = null;

  constructor(config: NotificationServiceConfig = {}) {
    super(config);
    this.storageKey = `${this.config.storageKeyPrefix}_data`;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load existing notifications from localStorage
    this.loadFromStorage();

    // Listen for changes from other tabs/windows
    this.storageListener = (event: StorageEvent) => {
      if (event.key === this.storageKey) {
        this.loadFromStorage();
        this.notify({ type: 'bulk_update', notifications: this.notifications });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.storageListener);
    }

    this.initialized = true;
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.notifications = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[LocalStorageNotificationService] Failed to load:', error);
      this.notifications = [];
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      // Trim to max notifications
      if (this.notifications.length > this.config.maxNotifications) {
        this.notifications = this.notifications.slice(-this.config.maxNotifications);
      }

      localStorage.setItem(this.storageKey, JSON.stringify(this.notifications));
    } catch (error) {
      console.error('[LocalStorageNotificationService] Failed to save:', error);
    }
  }

  async create(input: CreateNotificationInput): Promise<NotificationData> {
    const notification: NotificationData = {
      id: this.generateId(),
      type: input.type,
      category: input.category,
      title: input.title,
      message: input.message,
      timestamp: Date.now(),
      read: false,
      metadata: input.metadata,
      autoDismissMs: input.autoDismissMs ?? this.config.defaultAutoDismissMs,
    };

    this.notifications.push(notification);
    this.saveToStorage();

    this.notify({ type: 'added', notification });

    // Handle auto-dismiss
    if (notification.autoDismissMs && notification.autoDismissMs > 0) {
      setTimeout(() => {
        this.remove(notification.id);
      }, notification.autoDismissMs);
    }

    return notification;
  }

  async getById(id: string): Promise<NotificationData | null> {
    return this.notifications.find((n) => n.id === id) || null;
  }

  async getAll(filter?: NotificationFilter): Promise<NotificationData[]> {
    let result = [...this.notifications];

    if (filter) {
      if (filter.type !== undefined) {
        result = result.filter((n) => n.type === filter.type);
      }
      if (filter.category !== undefined) {
        result = result.filter((n) => n.category === filter.category);
      }
      if (filter.read !== undefined) {
        result = result.filter((n) => n.read === filter.read);
      }
      if (filter.fromTimestamp !== undefined) {
        result = result.filter((n) => n.timestamp >= filter.fromTimestamp!);
      }
      if (filter.toTimestamp !== undefined) {
        result = result.filter((n) => n.timestamp <= filter.toTimestamp!);
      }
    }

    // Sort by timestamp descending (newest first)
    return result.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getUnreadCount(): Promise<number> {
    return this.notifications.filter((n) => !n.read).length;
  }

  async markAsRead(id: string): Promise<void> {
    const notification = this.notifications.find((n) => n.id === id);
    if (notification && !notification.read) {
      notification.read = true;
      this.saveToStorage();
      this.notify({ type: 'updated', notification });
    }
  }

  async markAllAsRead(): Promise<void> {
    let changed = false;
    this.notifications.forEach((n) => {
      if (!n.read) {
        n.read = true;
        changed = true;
      }
    });

    if (changed) {
      this.saveToStorage();
      this.notify({ type: 'bulk_update', notifications: this.notifications });
    }
  }

  async remove(id: string): Promise<void> {
    const index = this.notifications.findIndex((n) => n.id === id);
    if (index !== -1) {
      this.notifications.splice(index, 1);
      this.saveToStorage();
      this.notify({ type: 'removed', notificationId: id });
    }
  }

  async clearAll(): Promise<void> {
    this.notifications = [];
    this.saveToStorage();
    this.notify({ type: 'cleared' });
  }

  dispose(): void {
    if (this.storageListener && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.storageListener);
    }
    super.dispose();
  }
}
