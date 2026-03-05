// ============================================================================
// WALLET API
// API for user wallet management
// ============================================================================

import { gatewayApi, type QueryParams } from './api';
import type {
  Wallet,
  CreateWalletInput,
  UpdateWalletInput,
  PaginatedResponse,
  WalletType,
} from './types';

const ENTITY = 'wallets';

// ----------------------------------------------------------------------------
// Helper to determine wallet type from chain
// ----------------------------------------------------------------------------

export function getWalletTypeFromChain(chain: string): WalletType {
  const upperChain = chain.toUpperCase();
  if (upperChain === 'TON') return 'ton';
  return 'evm';
}

export function getChainFromChainId(chainId: number): string {
  const chainMap = new Map<number, string>([
    [1, 'ETHEREUM'],
    [10, 'OPTIMISM'],
    [56, 'BSC'],
    [137, 'POLYGON'],
    [8453, 'BASE'],
    [42161, 'ARBITRUM'],
    [43114, 'AVALANCHE'],
    [480, 'WORLDCHAIN'],
    [-239, 'TON'],
  ]);
  return chainMap.get(chainId) || `CHAIN_${chainId}`;
}

// ----------------------------------------------------------------------------
// API Methods
// ----------------------------------------------------------------------------

export const walletApi = {
  /**
   * List all user wallets
   */
  async list(userId: string, params?: Omit<QueryParams, 'where'>): Promise<PaginatedResponse<Wallet>> {
    return gatewayApi.list<Wallet>(ENTITY, {
      ...params,
      where: { userId, isActive: true },
      orderBy: params?.orderBy || { createdAt: 'desc' },
    });
  },

  /**
   * Get wallet by ID
   */
  async get(id: string): Promise<Wallet> {
    return gatewayApi.get<Wallet>(ENTITY, id);
  },

  /**
   * Find wallet by chain and address
   */
  async findByAddress(userId: string, chain: string, address: string): Promise<Wallet | null> {
    const normalizedAddress = address.toLowerCase();
    const result = await gatewayApi.list<Wallet>(ENTITY, {
      where: {
        userId,
        chain: chain.toUpperCase(),
        address: normalizedAddress,
      },
      take: 1,
    });
    return result.data[0] || null;
  },

  /**
   * Create new wallet
   */
  async create(data: CreateWalletInput): Promise<Wallet> {
    const normalized: CreateWalletInput = {
      ...data,
      chain: data.chain.toUpperCase(),
      address: data.address.toLowerCase(),
    };
    return gatewayApi.create<Wallet>(ENTITY, normalized);
  },

  /**
   * Create wallet if missing, otherwise return existing one
   */
  async findOrCreate(data: CreateWalletInput): Promise<{ wallet: Wallet; created: boolean }> {
    const existing = await this.findByAddress(data.userId, data.chain, data.address);
    if (existing) {
      return { wallet: existing, created: false };
    }
    const wallet = await this.create(data);
    return { wallet, created: true };
  },

  /**
   * Update wallet
   */
  async update(id: string, data: UpdateWalletInput): Promise<Wallet> {
    return gatewayApi.update<Wallet>(ENTITY, id, data);
  },

  /**
   * Deactivate wallet (soft delete)
   */
  async deactivate(id: string): Promise<Wallet> {
    return gatewayApi.update<Wallet>(ENTITY, id, { isActive: false });
  },

  /**
   * Set wallet as primary
   */
  async setPrimary(userId: string, walletId: string): Promise<void> {
    // First, remove isPrimary from all user wallets
    const wallets = await this.list(userId);

    const updatePromises = wallets.data.map((w) =>
      w.id === walletId
        ? gatewayApi.update<Wallet>(ENTITY, w.id, { isPrimary: true })
        : w.isPrimary
          ? gatewayApi.update<Wallet>(ENTITY, w.id, { isPrimary: false })
          : Promise.resolve(w)
    );

    await Promise.all(updatePromises);
  },

  /**
   * Get primary wallet for user
   */
  async getPrimary(userId: string): Promise<Wallet | null> {
    const result = await gatewayApi.list<Wallet>(ENTITY, {
      where: { userId, isPrimary: true, isActive: true },
      take: 1,
    });
    return result.data[0] || null;
  },
};

export default walletApi;
