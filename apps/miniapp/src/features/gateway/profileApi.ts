// ============================================================================
// PROFILE API
// CRUD operations for user profiles via Database Gateway
// ============================================================================

import { gatewayApi, type QueryParams } from './api';

const ENTITY = 'user-profiles';

export type InvestorType = 'conservative' | 'moderate' | 'aggressive' | 'degen';

export interface UserProfile {
  id: string;
  walletAddress: string;
  nickname?: string;
  investorType?: InvestorType;
  goals: string[];
  preferredChains: string[];
  riskTolerance?: number;
  metadata?: Record<string, unknown>;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProfileInput {
  walletAddress: string;
  nickname?: string;
  investorType?: InvestorType;
  goals?: string[];
  preferredChains?: string[];
  riskTolerance?: number;
  metadata?: Record<string, unknown>;
  tenantId: string;
}

export interface UpdateProfileInput {
  nickname?: string;
  investorType?: InvestorType;
  goals?: string[];
  preferredChains?: string[];
  riskTolerance?: number;
  metadata?: Record<string, unknown>;
}

export const profileApi = {
  async getByWallet(walletAddress: string): Promise<UserProfile | null> {
    const params: QueryParams = {
      where: { walletAddress: walletAddress.toLowerCase() },
      take: 1,
    };
    const result = await gatewayApi.list<UserProfile>(ENTITY, params);
    return result.data[0] ?? null;
  },

  async create(input: CreateProfileInput): Promise<UserProfile> {
    return gatewayApi.create<UserProfile>(ENTITY, {
      ...input,
      walletAddress: input.walletAddress.toLowerCase(),
    });
  },

  async update(id: string, input: UpdateProfileInput): Promise<UserProfile> {
    return gatewayApi.update<UserProfile>(ENTITY, id, input);
  },

  /** Get or create profile — upsert pattern */
  async getOrCreate(walletAddress: string, tenantId: string): Promise<UserProfile> {
    const existing = await this.getByWallet(walletAddress);
    if (existing) return existing;
    return this.create({
      walletAddress,
      tenantId,
      goals: [],
      preferredChains: [],
    });
  },
};
