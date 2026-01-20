'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getNotificationService } from '../services/notifications';
import type { INotificationService } from '../services/notifications/NotificationService';
import type {
  NotificationData,
  CreateNotificationInput,
  NotificationFilter,
  NotificationCategory,
} from '../services/notifications/types';

/**
 * Hook to interact with the notification service
 *
 * @example
 * ```tsx
 * const { notifications, unreadCount, addNotification, markAsRead } = useNotifications();
 *
 * // Add a transaction notification
 * addNotification({
 *   type: 'success',
 *   category: 'swap',
 *   title: 'Swap Completed',
 *   message: 'Successfully swapped 1 ETH for 1800 USDC',
 *   metadata: { hash: '0x...', chainId: 1 }
 * });
 * ```
 */
export function useNotifications(filter?: NotificationFilter) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const serviceRef = useRef<INotificationService | null>(null);

  // Load notifications and subscribe to changes
  useEffect(() => {
    // Only initialize on client side
    if (typeof window === 'undefined') return;

    // Lazy initialize service
    if (!serviceRef.current) {
      serviceRef.current = getNotificationService();
    }

    const service = serviceRef.current;
    let mounted = true;

    const loadNotifications = async () => {
      try {
        const [all, count] = await Promise.all([
          service.getAll(filter),
          service.getUnreadCount(),
        ]);

        if (mounted) {
          setNotifications(all);
          setUnreadCount(count);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[useNotifications] Failed to load:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Initialize service and load
    service.initialize().then(loadNotifications);

    // Subscribe to changes
    const unsubscribe = service.subscribe(async () => {
      // Reload on any change
      await loadNotifications();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [filter]);

  const getService = useCallback(() => {
    if (!serviceRef.current && typeof window !== 'undefined') {
      serviceRef.current = getNotificationService();
    }
    return serviceRef.current;
  }, []);

  const addNotification = useCallback(
    async (input: CreateNotificationInput): Promise<NotificationData> => {
      const service = getService();
      if (!service) {
        throw new Error('Notification service not available');
      }
      const notification = await service.create(input);
      return notification;
    },
    [getService]
  );

  const markAsRead = useCallback(async (id: string) => {
    const service = getService();
    if (service) {
      await service.markAsRead(id);
    }
  }, [getService]);

  const markAllAsRead = useCallback(async () => {
    const service = getService();
    if (service) {
      await service.markAllAsRead();
    }
  }, [getService]);

  const removeNotification = useCallback(async (id: string) => {
    const service = getService();
    if (service) {
      await service.remove(id);
    }
  }, [getService]);

  const clearAll = useCallback(async () => {
    const service = getService();
    if (service) {
      await service.clearAll();
    }
  }, [getService]);

  return {
    notifications,
    unreadCount,
    isLoading,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  };
}

/**
 * Specialized hook for transaction notifications
 *
 * Provides helper methods for common transaction states
 */
export function useTransactionNotifications() {
  const { addNotification, ...rest } = useNotifications({ category: 'transaction' });

  const notifyTransactionPending = useCallback(
    (params: {
      title?: string;
      fromToken: string;
      toToken: string;
      fromAmount: string;
      hash?: string;
      chainId?: number;
    }) => {
      return addNotification({
        type: 'pending',
        category: 'transaction',
        title: params.title || 'Transaction Pending',
        message: `Swapping ${params.fromAmount} ${params.fromToken} to ${params.toToken}...`,
        metadata: {
          hash: params.hash,
          chainId: params.chainId,
          fromToken: params.fromToken,
          toToken: params.toToken,
          fromAmount: params.fromAmount,
        },
      });
    },
    [addNotification]
  );

  const notifyTransactionSuccess = useCallback(
    (params: {
      title?: string;
      fromToken: string;
      toToken: string;
      fromAmount: string;
      toAmount: string;
      hash: string;
      chainId: number;
      explorerUrl?: string;
    }) => {
      return addNotification({
        type: 'success',
        category: 'transaction',
        title: params.title || 'Transaction Successful',
        message: `Swapped ${params.fromAmount} ${params.fromToken} for ${params.toAmount} ${params.toToken}`,
        metadata: {
          hash: params.hash,
          chainId: params.chainId,
          fromToken: params.fromToken,
          toToken: params.toToken,
          fromAmount: params.fromAmount,
          toAmount: params.toAmount,
          explorerUrl: params.explorerUrl,
        },
      });
    },
    [addNotification]
  );

  const notifyTransactionFailed = useCallback(
    (params: {
      title?: string;
      message?: string;
      fromToken?: string;
      toToken?: string;
      fromAmount?: string;
      hash?: string;
      chainId?: number;
    }) => {
      return addNotification({
        type: 'error',
        category: 'transaction',
        title: params.title || 'Transaction Failed',
        message:
          params.message ||
          `Failed to swap ${params.fromAmount || ''} ${params.fromToken || 'tokens'}`,
        metadata: {
          hash: params.hash,
          chainId: params.chainId,
          fromToken: params.fromToken,
          toToken: params.toToken,
          fromAmount: params.fromAmount,
        },
      });
    },
    [addNotification]
  );

  return {
    ...rest,
    addNotification,
    notifyTransactionPending,
    notifyTransactionSuccess,
    notifyTransactionFailed,
  };
}

/**
 * Hook for swap-specific notifications
 */
export function useSwapNotifications() {
  const { addNotification, ...rest } = useNotifications({ category: 'swap' });

  const notifySwapQuoting = useCallback(
    (fromToken: string, toToken: string) => {
      return addNotification({
        type: 'info',
        category: 'swap',
        title: 'Getting Quote',
        message: `Finding best rate for ${fromToken} to ${toToken}...`,
        autoDismissMs: 5000,
      });
    },
    [addNotification]
  );

  const notifySwapPreparing = useCallback(
    (fromToken: string, toToken: string, amount: string) => {
      return addNotification({
        type: 'pending',
        category: 'swap',
        title: 'Preparing Swap',
        message: `Preparing to swap ${amount} ${fromToken} for ${toToken}...`,
      });
    },
    [addNotification]
  );

  const notifySwapExecuting = useCallback(
    (fromToken: string, toToken: string, hash?: string, chainId?: number) => {
      return addNotification({
        type: 'pending',
        category: 'swap',
        title: 'Executing Swap',
        message: `Transaction submitted. Waiting for confirmation...`,
        metadata: { hash, chainId, fromToken, toToken },
      });
    },
    [addNotification]
  );

  const notifySwapSuccess = useCallback(
    (params: {
      fromToken: string;
      toToken: string;
      fromAmount: string;
      toAmount: string;
      hash: string;
      chainId: number;
      explorerUrl?: string;
      provider?: string;
    }) => {
      return addNotification({
        type: 'success',
        category: 'swap',
        title: 'Swap Successful',
        message: `Swapped ${params.fromAmount} ${params.fromToken} for ${params.toAmount} ${params.toToken}`,
        metadata: {
          hash: params.hash,
          chainId: params.chainId,
          fromToken: params.fromToken,
          toToken: params.toToken,
          fromAmount: params.fromAmount,
          toAmount: params.toAmount,
          explorerUrl: params.explorerUrl,
          provider: params.provider,
        },
      });
    },
    [addNotification]
  );

  const notifySwapFailed = useCallback(
    (params: {
      message: string;
      fromToken?: string;
      toToken?: string;
      fromAmount?: string;
    }) => {
      return addNotification({
        type: 'error',
        category: 'swap',
        title: 'Swap Failed',
        message: params.message,
        metadata: {
          fromToken: params.fromToken,
          toToken: params.toToken,
          fromAmount: params.fromAmount,
        },
      });
    },
    [addNotification]
  );

  return {
    ...rest,
    addNotification,
    notifySwapQuoting,
    notifySwapPreparing,
    notifySwapExecuting,
    notifySwapSuccess,
    notifySwapFailed,
  };
}
