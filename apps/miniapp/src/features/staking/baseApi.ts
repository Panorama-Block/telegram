'use client';

import { useMemo } from 'react';
import { useActiveAccount } from 'thirdweb/react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BaseStakingPool {
  poolId: string;
  poolName: string;
  poolAddress: string;
  gaugeAddress: string;
  stable: boolean;
  rewardRatePerSecond: string;
  totalStaked: string;
  estimatedAPR: string;
}

export interface BaseProtocolInfo {
  protocol: string;
  chain: string;
  pools: BaseStakingPool[];
  updatedAt: string;
}

export interface BaseStakingPosition {
  poolId: string;
  poolName: string;
  poolAddress: string;
  gaugeAddress: string;
  tokenA: { symbol: string; address: string; decimals: number };
  tokenB: { symbol: string; address: string; decimals: number };
  stable: boolean;
  stakedBalance: string;
  earnedRewards: string;
  rewardToken: { symbol: string; address: string; decimals: number };
}

export interface BasePortfolioAsset {
  poolId: string;
  poolName: string;
  tokenA: { symbol: string; address: string; balance: string };
  tokenB: { symbol: string; address: string; balance: string };
  lpStaked: string;
  pendingRewards: string;
  rewardTokenSymbol: string;
}

export interface BasePortfolioResponse {
  userAddress: string;
  totalPositions: number;
  assets: BasePortfolioAsset[];
  walletBalances: Record<string, string>;
}

export interface BaseTxStep {
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  chainId?: number;
  description?: string;
}

export interface BaseTransactionBundle {
  steps: BaseTxStep[];
  totalSteps: number;
  poolId: string;
  poolName: string;
  action: 'enter' | 'exit' | 'claim';
}

/* ------------------------------------------------------------------ */
/*  API Client                                                         */
/* ------------------------------------------------------------------ */

// Use the Next.js rewrite proxy (/api/base-execution) for same-origin requests,
// avoiding CORS / helmet Cross-Origin-Resource-Policy issues.
// Falls back to direct URL if NEXT_PUBLIC_BASE_EXECUTION_API_URL is explicitly set.
const BASE_API_URL = process.env.NEXT_PUBLIC_BASE_EXECUTION_API_URL || '/api/base-execution';

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export class BaseStakingApiClient {
  private userAddress: string | null;
  private protocolInfoCache: { data: BaseProtocolInfo; ts: number } | null = null;

  constructor(userAddress: string | null) {
    this.userAddress = userAddress;
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${BASE_API_URL}${path}`;
    console.log(`[baseApi] fetch ${init?.method ?? 'GET'} ${url}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        ...init,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error(`[baseApi] HTTP ${res.status} for ${path}:`, body);
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as T;
      console.log(`[baseApi] ${path} =>`, JSON.stringify(data).slice(0, 200));
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async getProtocolInfo(): Promise<BaseProtocolInfo> {
    const now = Date.now();
    if (this.protocolInfoCache && now - this.protocolInfoCache.ts < CACHE_TTL) {
      return this.protocolInfoCache.data;
    }
    const data = await this.fetchJson<BaseProtocolInfo>('/staking/protocol-info');
    this.protocolInfoCache = { data, ts: now };
    return data;
  }

  async getPools(): Promise<BaseStakingPool[]> {
    const data = await this.fetchJson<{ pools: BaseStakingPool[] }>('/staking/pools');
    return data.pools ?? [];
  }

  async getPositions(): Promise<BaseStakingPosition[]> {
    if (!this.userAddress) {
      console.warn('[baseApi] getPositions skipped — no userAddress');
      return [];
    }
    const data = await this.fetchJson<{ positions: BaseStakingPosition[] }>(
      `/staking/position/${this.userAddress}`,
    );
    return data.positions ?? [];
  }

  async getPortfolio(): Promise<BasePortfolioResponse | null> {
    if (!this.userAddress) {
      console.warn('[baseApi] getPortfolio skipped — no userAddress');
      return null;
    }
    return this.fetchJson<BasePortfolioResponse>(
      `/staking/portfolio/${this.userAddress}`,
    );
  }

  async getAverageAPR(): Promise<number | null> {
    try {
      const info = await this.getProtocolInfo();
      const aprs = info.pools
        .map((p) => parseFloat(p.estimatedAPR))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (aprs.length === 0) return null;
      return aprs.reduce((a, b) => a + b, 0) / aprs.length;
    } catch {
      return null;
    }
  }

  async prepareEnter(params: {
    poolId: string;
    amountA: string;
    amountB: string;
    slippageBps?: number;
  }): Promise<BaseTransactionBundle> {
    if (!this.userAddress) throw new Error('Wallet not connected');
    const res = await this.fetchJson<{ bundle: { steps: BaseTxStep[]; totalSteps: number; summary?: string }; metadata?: Record<string, unknown> }>('/staking/prepare-enter', {
      method: 'POST',
      body: JSON.stringify({
        userAddress: this.userAddress,
        poolId: params.poolId,
        amountA: params.amountA,
        amountB: params.amountB,
        slippageBps: params.slippageBps ?? 50,
      }),
    });
    return {
      steps: res.bundle.steps,
      totalSteps: res.bundle.totalSteps,
      poolId: params.poolId,
      poolName: (res.metadata as Record<string, unknown>)?.poolName as string ?? params.poolId,
      action: 'enter',
    };
  }

  async prepareExit(poolId: string): Promise<BaseTransactionBundle> {
    if (!this.userAddress) throw new Error('Wallet not connected');
    const res = await this.fetchJson<{ bundle: { steps: BaseTxStep[]; totalSteps: number; summary?: string }; metadata?: Record<string, unknown> }>('/staking/prepare-exit', {
      method: 'POST',
      body: JSON.stringify({
        userAddress: this.userAddress,
        poolId,
      }),
    });
    return {
      steps: res.bundle.steps,
      totalSteps: res.bundle.totalSteps,
      poolId,
      poolName: (res.metadata as Record<string, unknown>)?.poolName as string ?? poolId,
      action: 'exit',
    };
  }

  async prepareClaim(poolId: string): Promise<BaseTransactionBundle> {
    if (!this.userAddress) throw new Error('Wallet not connected');
    const res = await this.fetchJson<{ bundle: { steps: BaseTxStep[]; totalSteps: number }; metadata?: Record<string, unknown> }>('/staking/prepare-claim', {
      method: 'POST',
      body: JSON.stringify({
        userAddress: this.userAddress,
        poolId,
      }),
    });
    return {
      steps: res.bundle.steps,
      totalSteps: res.bundle.totalSteps,
      poolId,
      poolName: (res.metadata as Record<string, unknown>)?.poolName as string ?? poolId,
      action: 'claim',
    };
  }
}

/* ------------------------------------------------------------------ */
/*  React Hook                                                         */
/* ------------------------------------------------------------------ */

export const useBaseStakingApi = () => {
  const account = useActiveAccount();
  const addr = account?.address ?? null;
  return useMemo(() => new BaseStakingApiClient(addr), [addr]);
};
