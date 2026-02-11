// ============================================================================
// SWAP INTEGRATION
// Helper para integrar o histórico de transações com o fluxo de swap
// ============================================================================

import { gatewayApi } from './api';
import { walletApi, getChainFromChainId, getWalletTypeFromChain } from './walletApi';
import { transactionApi } from './transactionApi';
import { notificationApi } from './notificationApi';
import type {
  Transaction,
  CreateTransactionInput,
  TxHash,
  Wallet,
} from './types';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const DEFAULT_TENANT_ID = 'panorama';

function getTenantId(): string {
  if (typeof window === 'undefined') return DEFAULT_TENANT_ID;
  return localStorage.getItem('tenantId') || DEFAULT_TENANT_ID;
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AssetInfo {
  address: string;
  symbol: string;
  decimals: number;
}

export interface SwapParams {
  userId: string;
  walletAddress: string;
  chain: string;
  action?: 'swap' | 'bridge' | 'stake' | 'unstake';
  conversationId?: string;

  // From - simplified
  fromChainId: number;
  fromAsset: AssetInfo;
  fromAmount: string; // Display amount (e.g., "1.5")
  fromAmountUsd?: string;

  // To - simplified
  toChainId: number;
  toAsset: AssetInfo;
  toAmount?: string; // Estimated display amount
  toAmountUsd?: string;

  // Extra
  provider?: string;
  exchangeRate?: string;
  slippage?: string;
  fees?: {
    gasFee?: string;
    bridgeFee?: string;
    totalFeeUsd?: string;
  };
}

export interface SwapTracker {
  transactionId: string;
  walletId: string;
  addHash: (hash: string, chainId: number, type?: TxHash['type']) => void;
  addTxHash: (hash: string, chainId: number, type?: TxHash['type']) => Promise<void>;
  markSubmitted: () => Promise<void>;
  markPending: () => Promise<void>;
  markConfirmed: (toAmountDisplay?: string) => Promise<void>;
  markFailed: (errorCode?: string, errorMessage?: string) => Promise<void>;
  getTransaction: () => Promise<Transaction>;
}

// ----------------------------------------------------------------------------
// Main Integration Function
// ----------------------------------------------------------------------------

/**
 * Converts display amount to raw (wei) format
 */
function parseAmountToRaw(amount: string, decimals: number): string {
  try {
    const [whole, fraction = ''] = amount.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    return BigInt(whole + paddedFraction).toString();
  } catch {
    return '0';
  }
}

/**
 * Inicia o rastreamento de uma transação de swap
 * Deve ser chamado ANTES de executar o swap
 */
export async function startSwapTracking(params: SwapParams): Promise<SwapTracker> {
  const tenantId = getTenantId();
  const chain = params.chain || getChainFromChainId(params.fromChainId);

  // 1. Garante que o User existe (Wallet tem FK para User)
  try {
    await gatewayApi.list('users', {
      where: { userId: params.userId },
      take: 1,
    }).then(async (res) => {
      if (!res.data || res.data.length === 0) {
        await gatewayApi.create('users', {
          userId: params.userId,
          walletAddress: params.walletAddress,
          tenantId,
        });
      }
    });
  } catch (e) {
    // User may already exist, ignore duplicate errors
    console.warn('[swapTracking] User ensure error (may already exist):', e);
  }

  // 2. Garante que a wallet está registrada
  const { wallet } = await walletApi.findOrCreate({
    userId: params.userId,
    chain,
    address: params.walletAddress,
    walletType: getWalletTypeFromChain(chain),
    tenantId,
  });

  // 2. Determina se é swap ou bridge
  const isBridge = params.action === 'bridge' || params.fromChainId !== params.toChainId;
  const action = params.action || (isBridge ? 'bridge' : 'swap');

  // 3. Convert display amounts to raw
  const fromAmountRaw = parseAmountToRaw(params.fromAmount, params.fromAsset.decimals);
  const toAmountRaw = params.toAmount
    ? parseAmountToRaw(params.toAmount, params.toAsset.decimals)
    : undefined;

  // 4. Cria o registro da transação
  const txInput: CreateTransactionInput = {
    userId: params.userId,
    walletId: wallet.id,
    conversationId: params.conversationId,
    action,
    protocol: params.provider,

    // From
    fromChainId: params.fromChainId,
    fromAssetAddress: params.fromAsset.address,
    fromAssetSymbol: params.fromAsset.symbol,
    fromAssetDecimals: params.fromAsset.decimals,
    fromAmountRaw,
    fromAmountDisplay: params.fromAmount,
    fromAmountUsd: params.fromAmountUsd,

    // To
    toChainId: params.toChainId,
    toAssetAddress: params.toAsset.address,
    toAssetSymbol: params.toAsset.symbol,
    toAssetDecimals: params.toAsset.decimals,
    toAmountRaw,
    toAmountDisplay: params.toAmount,
    toAmountUsd: params.toAmountUsd,

    // Extra
    exchangeRate: params.exchangeRate,
    slippage: params.slippage,
    gasFee: params.fees?.gasFee,
    bridgeFee: params.fees?.bridgeFee,
    totalFeeUsd: params.fees?.totalFeeUsd,

    // Status inicial
    status: 'created',
    txHashes: [],
    tenantId,
  };

  const transaction = await transactionApi.create(txInput);

  // Store hashes locally for sync addHash
  const pendingHashes: Array<{ hash: string; chainId: number; type: TxHash['type'] }> = [];

  // 5. Retorna o tracker
  return {
    transactionId: transaction.id,
    walletId: wallet.id,

    // Synchronous version - queues hash for later
    addHash(hash: string, chainId: number, type?: TxHash['type']) {
      pendingHashes.push({
        hash,
        chainId,
        type: type || (isBridge ? 'bridge' : 'swap'),
      });
    },

    // Async version - sends immediately
    async addTxHash(hash: string, chainId: number, type?: TxHash['type']) {
      await transactionApi.addTxHash(transaction.id, {
        hash,
        chainId,
        type: type || (isBridge ? 'bridge' : 'swap'),
        status: 'pending',
      });
    },

    async markSubmitted() {
      await transactionApi.markSubmitted(transaction.id);
    },

    async markPending() {
      await transactionApi.markPending(transaction.id);
    },

    async markConfirmed(toAmountDisplay?: string) {
      // First, flush pending hashes
      for (const h of pendingHashes) {
        try {
          await transactionApi.addTxHash(transaction.id, {
            hash: h.hash,
            chainId: h.chainId,
            type: h.type,
            status: 'success',
          });
        } catch {
          // Ignore hash errors
        }
      }

      // Convert display amount to raw if provided
      const confirmData = toAmountDisplay
        ? { toAmountRaw: parseAmountToRaw(toAmountDisplay, params.toAsset.decimals) }
        : undefined;

      await transactionApi.markConfirmed(transaction.id, confirmData);

      // Cria notificação de sucesso
      try {
        await notificationApi.notifyTxConfirmed(
          params.userId,
          transaction.id,
          {
            action: isBridge ? 'Bridge' : 'Swap',
            fromSymbol: params.fromAsset.symbol,
            toSymbol: params.toAsset.symbol,
            amount: params.fromAmount,
          },
          tenantId
        );
      } catch {
        // Ignora erro de notificação
      }
    },

    async markFailed(errorCode?: string, errorMessage?: string) {
      await transactionApi.markFailed(
        transaction.id,
        errorCode || 'TRANSACTION_FAILED',
        errorMessage
      );

      // Cria notificação de falha
      try {
        await notificationApi.notifyTxFailed(
          params.userId,
          transaction.id,
          {
            action: isBridge ? 'Bridge' : 'Swap',
            errorMessage,
          },
          tenantId
        );
      } catch {
        // Ignora erro de notificação
      }
    },

    async getTransaction() {
      return transactionApi.get(transaction.id);
    },
  };
}

// ----------------------------------------------------------------------------
// Convenience Functions
// ----------------------------------------------------------------------------

/**
 * Busca o histórico de swaps do usuário
 */
export async function getSwapHistory(userId: string, limit = 20): Promise<Transaction[]> {
  return transactionApi.getSwapHistory(userId, limit);
}

/**
 * Busca o histórico de bridges do usuário
 */
export async function getBridgeHistory(userId: string, limit = 20): Promise<Transaction[]> {
  return transactionApi.getBridgeHistory(userId, limit);
}

/**
 * Busca todas as transações pendentes do usuário
 */
export async function getPendingTransactions(userId: string): Promise<Transaction[]> {
  return transactionApi.getPending(userId);
}

/**
 * Registra wallet se ainda não existir
 */
export async function ensureWalletRegistered(
  userId: string,
  chainId: number,
  address: string
): Promise<Wallet> {
  const chain = getChainFromChainId(chainId);
  const { wallet } = await walletApi.findOrCreate({
    userId,
    chain,
    address,
    walletType: getWalletTypeFromChain(chain),
    tenantId: getTenantId(),
  });
  return wallet;
}
