// ============================================================================
// GATEWAY HOOKS
// React hooks para usar as APIs do gateway
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { walletApi, getWalletTypeFromChain, getChainFromChainId } from './walletApi';
import { transactionApi } from './transactionApi';
import { notificationApi } from './notificationApi';
import { isGatewayUnavailableError } from './api';
import type {
  Wallet,
  Transaction,
  Notification,
  CreateTransactionInput,
  TransactionAction,
  TxHash,
} from './types';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const DEFAULT_TENANT_ID = 'panorama';
const GATEWAY_UNAVAILABLE_COOLDOWN_MS = 2 * 60 * 1000;

function getTenantId(): string {
  if (typeof window === 'undefined') return DEFAULT_TENANT_ID;
  return localStorage.getItem('tenantId') || DEFAULT_TENANT_ID;
}

// ----------------------------------------------------------------------------
// useWallet - Gerencia wallet do usuário
// ----------------------------------------------------------------------------

interface UseWalletOptions {
  userId: string;
  autoRegister?: boolean;
}

interface UseWalletResult {
  wallets: Wallet[];
  currentWallet: Wallet | null;
  loading: boolean;
  error: Error | null;
  registerWallet: (chain: string, address: string, name?: string) => Promise<Wallet>;
  refreshWallets: () => Promise<void>;
}

export function useWallet({ userId, autoRegister = true }: UseWalletOptions): UseWalletResult {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [currentWallet, setCurrentWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshWallets = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const result = await walletApi.list(userId);
      setWallets(result.data);

      // Define wallet primária ou primeira como atual
      const primary = result.data.find((w) => w.isPrimary) || result.data[0];
      setCurrentWallet(primary || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load wallets'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const registerWallet = useCallback(
    async (chain: string, address: string, name?: string): Promise<Wallet> => {
      const { wallet, created } = await walletApi.findOrCreate({
        userId,
        chain,
        address,
        walletType: getWalletTypeFromChain(chain),
        name,
        isPrimary: wallets.length === 0, // Primeira wallet é primária
        tenantId: getTenantId(),
      });

      if (created) {
        await refreshWallets();
      }

      return wallet;
    },
    [userId, wallets.length, refreshWallets]
  );

  useEffect(() => {
    if (userId) {
      refreshWallets();
    }
  }, [userId, refreshWallets]);

  return {
    wallets,
    currentWallet,
    loading,
    error,
    registerWallet,
    refreshWallets,
  };
}

// ----------------------------------------------------------------------------
// useTransactionHistory - Histórico de transações
// ----------------------------------------------------------------------------

interface UseTransactionHistoryOptions {
  userId: string;
  action?: TransactionAction;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseTransactionHistoryResult {
  transactions: Transaction[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export function useTransactionHistory({
  userId,
  action,
  limit = 20,
  autoRefresh = false,
  refreshInterval = 30000,
}: UseTransactionHistoryOptions): UseTransactionHistoryResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const unavailableUntilRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!userId) return;
    if (unavailableUntilRef.current > Date.now()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await transactionApi.list(userId, {
        action,
        take: limit,
        skip: 0,
      });
      setTransactions(result.data);
      setSkip(result.data.length);
      setHasMore(result.data.length >= limit);
      setError(null);
      unavailableUntilRef.current = 0;
    } catch (err) {
      if (isGatewayUnavailableError(err)) {
        unavailableUntilRef.current = Date.now() + GATEWAY_UNAVAILABLE_COOLDOWN_MS;
        setTransactions([]);
        setSkip(0);
        setHasMore(false);
        setError(null);
        return;
      }
      setError(err instanceof Error ? err : new Error('Failed to load transactions'));
    } finally {
      setLoading(false);
    }
  }, [userId, action, limit]);

  const loadMore = useCallback(async () => {
    if (!userId || !hasMore || loading) return;
    if (unavailableUntilRef.current > Date.now()) return;

    try {
      setLoading(true);
      const result = await transactionApi.list(userId, {
        action,
        take: limit,
        skip,
      });
      setTransactions((prev) => [...prev, ...result.data]);
      setSkip((prev) => prev + result.data.length);
      setHasMore(result.data.length >= limit);
      unavailableUntilRef.current = 0;
    } catch (err) {
      if (isGatewayUnavailableError(err)) {
        unavailableUntilRef.current = Date.now() + GATEWAY_UNAVAILABLE_COOLDOWN_MS;
        setHasMore(false);
        setError(null);
        return;
      }
      setError(err instanceof Error ? err : new Error('Failed to load more transactions'));
    } finally {
      setLoading(false);
    }
  }, [userId, action, limit, skip, hasMore, loading]);

  useEffect(() => {
    if (userId) {
      refresh();
    }
  }, [userId, refresh]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh || !userId) return;

    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, userId, refresh]);

  return {
    transactions,
    loading,
    error,
    refresh,
    loadMore,
    hasMore,
  };
}

// ----------------------------------------------------------------------------
// useTransactionTracker - Rastreia uma transação em andamento
// ----------------------------------------------------------------------------

interface UseTransactionTrackerResult {
  transactionId: string | null;
  transaction: Transaction | null;
  status: Transaction['status'] | null;
  loading: boolean;
  error: Error | null;
  startTransaction: (data: Omit<CreateTransactionInput, 'tenantId'>) => Promise<string>;
  addTxHash: (hash: string, chainId: number, type?: TxHash['type']) => Promise<void>;
  updateStatus: (status: Transaction['status']) => Promise<void>;
  markConfirmed: (data?: { toAmountRaw?: string; gasFee?: string }) => Promise<void>;
  markFailed: (errorMessage?: string) => Promise<void>;
  reset: () => void;
}

export function useTransactionTracker(): UseTransactionTrackerResult {
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const startTransaction = useCallback(
    async (data: Omit<CreateTransactionInput, 'tenantId'>): Promise<string> => {
      try {
        setLoading(true);
        setError(null);

        const tx = await transactionApi.create({
          ...data,
          tenantId: getTenantId(),
        });

        setTransactionId(tx.id);
        setTransaction(tx);
        return tx.id;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create transaction');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const addTxHash = useCallback(
    async (hash: string, chainId: number, type?: TxHash['type']) => {
      if (!transactionId) return;

      try {
        setLoading(true);
        const updated = await transactionApi.addTxHash(transactionId, {
          hash,
          chainId,
          type,
          status: 'pending',
        });
        setTransaction(updated);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to add tx hash'));
      } finally {
        setLoading(false);
      }
    },
    [transactionId]
  );

  const updateStatus = useCallback(
    async (status: Transaction['status']) => {
      if (!transactionId) return;

      try {
        setLoading(true);
        const updated = await transactionApi.update(transactionId, { status });
        setTransaction(updated);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to update status'));
      } finally {
        setLoading(false);
      }
    },
    [transactionId]
  );

  const markConfirmed = useCallback(
    async (data?: { toAmountRaw?: string; gasFee?: string }) => {
      if (!transactionId) return;

      try {
        setLoading(true);
        const updated = await transactionApi.markConfirmed(transactionId, data);
        setTransaction(updated);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to mark confirmed'));
      } finally {
        setLoading(false);
      }
    },
    [transactionId]
  );

  const markFailed = useCallback(
    async (errorMessage?: string) => {
      if (!transactionId) return;

      try {
        setLoading(true);
        const updated = await transactionApi.markFailed(
          transactionId,
          'TRANSACTION_FAILED',
          errorMessage
        );
        setTransaction(updated);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to mark failed'));
      } finally {
        setLoading(false);
      }
    },
    [transactionId]
  );

  const reset = useCallback(() => {
    setTransactionId(null);
    setTransaction(null);
    setError(null);
  }, []);

  return {
    transactionId,
    transaction,
    status: transaction?.status || null,
    loading,
    error,
    startTransaction,
    addTxHash,
    updateStatus,
    markConfirmed,
    markFailed,
    reset,
  };
}

// ----------------------------------------------------------------------------
// useNotifications - Notificações do usuário
// ----------------------------------------------------------------------------

interface UseNotificationsOptions {
  userId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
}

export function useNotifications({
  userId,
  autoRefresh = true,
  refreshInterval = 30000,
}: UseNotificationsOptions): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const unavailableUntilRef = useRef(0);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const refresh = useCallback(async () => {
    if (!userId) return;
    if (unavailableUntilRef.current > Date.now()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await notificationApi.list(userId, { take: 50 });
      setNotifications(result.data);
      setError(null);
      unavailableUntilRef.current = 0;
    } catch (err) {
      if (isGatewayUnavailableError(err)) {
        unavailableUntilRef.current = Date.now() + GATEWAY_UNAVAILABLE_COOLDOWN_MS;
        setError(null);
        return;
      }
      setError(err instanceof Error ? err : new Error('Failed to load notifications'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const markRead = useCallback(async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to mark notification as read'));
    }
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;

    try {
      await notificationApi.markAllRead(userId);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to mark all as read'));
    }
  }, [userId]);

  const dismiss = useCallback(async (id: string) => {
    try {
      await notificationApi.dismiss(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to dismiss notification'));
    }
  }, []);

  useEffect(() => {
    if (userId) {
      refresh();
    }
  }, [userId, refresh]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh || !userId) return;

    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, userId, refresh]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
    dismiss,
  };
}
