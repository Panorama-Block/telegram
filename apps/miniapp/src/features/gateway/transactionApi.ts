// ============================================================================
// TRANSACTION API
// API para gerenciar histórico de transações (swap, bridge, stake, etc.)
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
   * Lista transações do usuário
   */
  async list(
    userId: string,
    params?: Omit<QueryParams, 'where'> & {
      action?: TransactionAction;
      status?: TransactionStatus;
      walletId?: string;
    }
  ): Promise<PaginatedResponse<Transaction>> {
    const where: Record<string, unknown> = { userId };

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
   * Busca transação por ID
   */
  async get(id: string): Promise<Transaction> {
    return gatewayApi.get<Transaction>(ENTITY, id);
  },

  /**
   * Cria nova transação
   */
  async create(data: CreateTransactionInput): Promise<Transaction> {
    return gatewayApi.create<Transaction>(ENTITY, {
      ...data,
      txHashes: data.txHashes || [],
      status: data.status || 'created',
    });
  },

  /**
   * Atualiza transação
   */
  async update(id: string, data: UpdateTransactionInput): Promise<Transaction> {
    return gatewayApi.update<Transaction>(ENTITY, id, data);
  },

  /**
   * Adiciona hash de transação
   */
  async addTxHash(id: string, txHash: TxHash): Promise<Transaction> {
    const tx = await this.get(id);
    const existingHashes = tx.txHashes || [];

    // Verifica se já existe
    const exists = existingHashes.some((h) => h.hash === txHash.hash);
    if (exists) {
      // Atualiza status do hash existente
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
   * Marca transação como submetida
   */
  async markSubmitted(id: string): Promise<Transaction> {
    return this.update(id, { status: 'submitted' });
  },

  /**
   * Marca transação como pendente
   */
  async markPending(id: string): Promise<Transaction> {
    return this.update(id, { status: 'pending' });
  },

  /**
   * Marca transação como confirmada
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
   * Marca transação como falha
   */
  async markFailed(id: string, errorCode?: string, errorMessage?: string): Promise<Transaction> {
    return this.update(id, {
      status: 'failed',
      errorCode,
      errorMessage,
    });
  },

  /**
   * Busca transações por bridge ID
   */
  async findByBridgeId(bridgeId: string): Promise<Transaction | null> {
    const result = await gatewayApi.list<Transaction>(ENTITY, {
      where: { bridgeId },
      take: 1,
    });
    return result.data[0] || null;
  },

  /**
   * Busca transações pendentes do usuário
   */
  async getPending(userId: string): Promise<Transaction[]> {
    const result = await this.list(userId, {
      status: 'pending',
      take: 100,
    });
    return result.data;
  },

  /**
   * Busca histórico de swaps do usuário
   */
  async getSwapHistory(userId: string, limit = 20): Promise<Transaction[]> {
    const result = await this.list(userId, {
      action: 'swap',
      take: limit,
    });
    return result.data;
  },

  /**
   * Busca histórico de bridges do usuário
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
