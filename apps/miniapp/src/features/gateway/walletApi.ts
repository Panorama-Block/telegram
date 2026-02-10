// ============================================================================
// WALLET API
// API para gerenciar carteiras do usuário
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
// Helper para determinar tipo de wallet baseado na chain
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
   * Lista todas as wallets do usuário
   */
  async list(userId: string, params?: Omit<QueryParams, 'where'>): Promise<PaginatedResponse<Wallet>> {
    return gatewayApi.list<Wallet>(ENTITY, {
      ...params,
      where: { userId, isActive: true },
      orderBy: params?.orderBy || { createdAt: 'desc' },
    });
  },

  /**
   * Busca wallet por ID
   */
  async get(id: string): Promise<Wallet> {
    return gatewayApi.get<Wallet>(ENTITY, id);
  },

  /**
   * Busca wallet por chain e address
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
   * Cria nova wallet
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
   * Cria wallet se não existir, retorna existente se já tiver
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
   * Atualiza wallet
   */
  async update(id: string, data: UpdateWalletInput): Promise<Wallet> {
    return gatewayApi.update<Wallet>(ENTITY, id, data);
  },

  /**
   * Desativa wallet (soft delete)
   */
  async deactivate(id: string): Promise<Wallet> {
    return gatewayApi.update<Wallet>(ENTITY, id, { isActive: false });
  },

  /**
   * Define wallet como primária
   */
  async setPrimary(userId: string, walletId: string): Promise<void> {
    // Primeiro, remove isPrimary de todas as wallets do usuário
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
   * Busca wallet primária do usuário
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
