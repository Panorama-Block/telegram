// ============================================================================
// TRANSACTION API
// API for transaction history management (swap, bridge, stake, etc.)
// ============================================================================

import { gatewayApi, type QueryParams } from './api';
import type {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  PaginatedResponse,
  TransactionAction,
  TransactionStatus,
  TxHash,
} from './types';

const ENTITY = 'transactions';

// ----------------------------------------------------------------------------
// API Methods
// ----------------------------------------------------------------------------

export const transactionApi = {
  /**
   * List user transactions
   */
  async list(
    userId: string,
    params?: Omit<QueryParams, 'where'> & {
      action?: TransactionAction;
      status?: TransactionStatus;
      walletId?: string;
    }
  ): Promise<PaginatedResponse<Transaction>> {
    const normalizedUserId = userId.toLowerCase();
    const where: Record<string, unknown> = { userId: normalizedUserId };

    if (params?.action) where.action = params.action;
    if (params?.status) where.status = params.status;
    if (params?.walletId) where.walletId = params.walletId;

    return gatewayApi.list<Transaction>(ENTITY, {
      where,
      orderBy: params?.orderBy || { createdAt: 'desc' },
      take: params?.take || 50,
      skip: params?.skip,
    });
  },

  /**
   * Get transaction by ID
   */
  async get(id: string): Promise<Transaction> {
    return gatewayApi.get<Transaction>(ENTITY, id);
  },

  /**
   * Create a new transaction
   */
  async create(data: CreateTransactionInput): Promise<Transaction> {
    return gatewayApi.create<Transaction>(ENTITY, {
      ...data,
      txHashes: data.txHashes || [],
      status: data.status || 'created',
    });
  },

  /**
   * Update transaction
   */
  async update(id: string, data: UpdateTransactionInput): Promise<Transaction> {
    return gatewayApi.update<Transaction>(ENTITY, id, data);
  },

  /**
   * Add transaction hash
   */
  async addTxHash(id: string, txHash: TxHash): Promise<Transaction> {
    const tx = await this.get(id);
    const existingHashes = tx.txHashes || [];

    // Check if it already exists
    const exists = existingHashes.some((h) => h.hash === txHash.hash);
    if (exists) {
      // Update status of existing hash
      const updatedHashes = existingHashes.map((h) =>
        h.hash === txHash.hash ? { ...h, ...txHash } : h
      );
      return this.update(id, { txHashes: updatedHashes });
    }

    return this.update(id, {
      txHashes: [...existingHashes, txHash],
    });
  },

  /**
   * Mark transaction as submitted
   */
  async markSubmitted(id: string): Promise<Transaction> {
    return this.update(id, { status: 'submitted' });
  },

  /**
   * Mark transaction as pending
   */
  async markPending(id: string): Promise<Transaction> {
    return this.update(id, { status: 'pending' });
  },

  /**
   * Mark transaction as confirmed
   */
  async markConfirmed(
    id: string,
    data?: {
      toAmountRaw?: string;
      toAmountDisplay?: string;
      toAmountUsd?: string;
      gasFee?: string;
    }
  ): Promise<Transaction> {
    return this.update(id, {
      ...data,
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
    });
  },

  /**
   * Mark transaction as failed
   */
  async markFailed(id: string, errorCode?: string, errorMessage?: string): Promise<Transaction> {
    return this.update(id, {
      status: 'failed',
      errorCode,
      errorMessage,
    });
  },

  /**
   * Find transactions by bridge ID
   */
  async findByBridgeId(bridgeId: string): Promise<Transaction | null> {
    const result = await gatewayApi.list<Transaction>(ENTITY, {
      where: { bridgeId },
      take: 1,
    });
    return result.data[0] || null;
  },

  /**
   * Get user pending transactions
   */
  async getPending(userId: string): Promise<Transaction[]> {
    const result = await this.list(userId, {
      status: 'pending',
      take: 100,
    });
    return result.data;
  },

  /**
   * Get user swap history
   */
  async getSwapHistory(userId: string, limit = 20): Promise<Transaction[]> {
    const result = await this.list(userId, {
      action: 'swap',
      take: limit,
    });
    return result.data;
  },

  /**
   * Get user bridge history
   */
  async getBridgeHistory(userId: string, limit = 20): Promise<Transaction[]> {
    const result = await this.list(userId, {
      action: 'bridge',
      take: limit,
    });
    return result.data;
  },
};

export default transactionApi;
