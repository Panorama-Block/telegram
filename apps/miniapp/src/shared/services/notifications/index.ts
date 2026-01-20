/**
 * Notification Service Module
 *
 * This module provides a modular notification system that currently uses
 * localStorage but can be easily switched to a queue-based system.
 *
 * ## Architecture
 *
 * The system is built with the Strategy pattern:
 * - INotificationService: Interface contract
 * - BaseNotificationService: Common functionality
 * - LocalStorageNotificationService: Current implementation
 *
 * ## Future Queue Integration
 *
 * To integrate with a message queue (RabbitMQ, Redis, etc.):
 *
 * 1. Create a new implementation:
 *    ```ts
 *    class RedisNotificationService extends BaseNotificationService {
 *      // Implement with Redis pub/sub
 *    }
 *    ```
 *
 * 2. Update the factory:
 *    ```ts
 *    export function createNotificationService(
 *      type: 'localStorage' | 'redis' | 'rabbitmq'
 *    ) {
 *      switch (type) {
 *        case 'redis': return new RedisNotificationService(config);
 *        case 'rabbitmq': return new RabbitMQNotificationService(config);
 *        default: return new LocalStorageNotificationService(config);
 *      }
 *    }
 *    ```
 *
 * ## Usage
 *
 * ```tsx
 * import { useNotifications, useSwapNotifications } from '@/shared/hooks/useNotifications';
 *
 * // In a component
 * const { notifications, addNotification } = useNotifications();
 *
 * // For swap-specific notifications
 * const { notifySwapSuccess, notifySwapFailed } = useSwapNotifications();
 * ```
 */

import type { INotificationService } from './NotificationService';
import { LocalStorageNotificationService } from './LocalStorageNotificationService';
import type { NotificationServiceConfig } from './types';

// Re-export types
export * from './types';
export type { INotificationService } from './NotificationService';
export { BaseNotificationService } from './NotificationService';
export { LocalStorageNotificationService } from './LocalStorageNotificationService';

/**
 * Notification service backend type
 * Add new types here when implementing new backends
 */
export type NotificationBackend = 'localStorage' | 'memory';
// Future: | 'redis' | 'rabbitmq' | 'websocket'

/**
 * Configuration for creating notification services
 */
export interface CreateNotificationServiceOptions extends NotificationServiceConfig {
  backend?: NotificationBackend;
}

/**
 * Factory function to create notification service instances
 *
 * @param options Configuration options
 * @returns Notification service instance
 *
 * @example
 * ```ts
 * // Default localStorage backend
 * const service = createNotificationService();
 *
 * // With custom config
 * const service = createNotificationService({
 *   backend: 'localStorage',
 *   maxNotifications: 200,
 * });
 *
 * // Future: queue backend
 * const service = createNotificationService({
 *   backend: 'redis',
 *   connectionUrl: 'redis://localhost:6379',
 * });
 * ```
 */
export function createNotificationService(
  options: CreateNotificationServiceOptions = {}
): INotificationService {
  const { backend = 'localStorage', ...config } = options;

  switch (backend) {
    case 'localStorage':
    case 'memory': // memory falls back to localStorage for now
    default:
      return new LocalStorageNotificationService(config);

    // Future implementations:
    // case 'redis':
    //   return new RedisNotificationService(config);
    // case 'rabbitmq':
    //   return new RabbitMQNotificationService(config);
    // case 'websocket':
    //   return new WebSocketNotificationService(config);
  }
}

// Singleton instance for app-wide use
let globalNotificationService: INotificationService | null = null;

/**
 * Get or create the global notification service instance
 *
 * This provides a singleton pattern for the notification service,
 * ensuring all components share the same instance.
 *
 * @param options Optional configuration (only used on first call)
 * @returns Global notification service instance
 */
export function getNotificationService(
  options?: CreateNotificationServiceOptions
): INotificationService {
  if (!globalNotificationService) {
    globalNotificationService = createNotificationService(options);
  }
  return globalNotificationService;
}

/**
 * Reset the global notification service
 *
 * Useful for testing or when switching backends at runtime.
 * After calling this, the next getNotificationService() call
 * will create a new instance.
 */
export function resetNotificationService(): void {
  if (globalNotificationService) {
    globalNotificationService.dispose();
    globalNotificationService = null;
  }
}

/**
 * Helper to format relative time for notifications
 *
 * @param timestamp Unix timestamp in milliseconds
 * @returns Human-readable relative time string
 */
export function formatNotificationTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

  return new Date(timestamp).toLocaleDateString();
}
