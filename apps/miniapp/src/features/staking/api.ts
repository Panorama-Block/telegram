'use client';

import { useMemo } from 'react';
import { useActiveAccount, useSwitchActiveWalletChain } from 'thirdweb/react';
import { defineChain } from 'thirdweb';
import {
  sendAccountTransactionNonEvidence,
} from '@/features/execution/nonEvidenceTransactionExecutor';
import { parseAmountToWei } from '@/features/swap/utils';
import { safeExecuteTransactionV2 } from '@/shared/utils/transactionUtilsV2';
import { fetchWithAuth } from '@/shared/lib/fetchWithAuth';
import type { TransactionData } from '@/shared/types/transaction';

type SwitchChainFn = (chain: ReturnType<typeof defineChain>) => Promise<void>;

export interface StakingToken {
  symbol: string;
  address: string;
  icon?: string;
  decimals: number;
  stakingAPY: number | null;
  apySource?: string | null;
  apyUpdatedAt?: string | null;
  apyStale?: boolean;
  totalStaked: string | null; // wei string
  minimumStake: string;
  lockPeriod: number; // in days
  isActive: boolean;
}

export interface StakingPosition {
  id: string;
  userAddress: string;
  stakedAmount: string;
  stETHBalance: string;
  wstETHBalance: string;
  apy: number | null;
  timestamp: string;
  status: 'active' | 'inactive';
}

export interface StakingTransaction {
  id: string;
  userAddress: string;
  type: 'stake' | 'unstake' | 'unstake_approval' | 'claim_rewards' | 'withdrawal_claim';
  amount: string;
  token: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  transactionData?: TransactionData;
  // For multi-step transactions (like unstake which requires approval first)
  requiresFollowUp?: boolean;
  followUpAction?: 'unstake';
}

export interface WithdrawalRequest {
  requestId: string;
  amountOfStETHWei: string;
  amountOfSharesWei: string;
  owner: string;
  timestamp: number;
  isFinalized: boolean;
  isClaimed: boolean;
}

export interface PortfolioAsset {
  chainId: number;
  tokenSymbol: string;
  tokenAddress: string;
  balanceWei: string;
  updatedAt: string;
}

export interface PortfolioMetricDaily {
  chainId: number;
  date: string; // YYYY-MM-DD
  stethBalanceWei: string;
  wstethBalanceWei: string;
  totalStakedWei: string;
  apyBps: number | null;
  updatedAt: string;
}

export interface PortfolioResponse {
  userAddress: string;
  assets: PortfolioAsset[];
  dailyMetrics: PortfolioMetricDaily[];
}

export interface ProtocolInfo {
  totalStaked: string; // wei string
  currentAPY: number | null;
  lastUpdate: string;
}

type LidoApySource = 'backend' | 'lido-stats' | 'lido-apr-last' | 'cache' | 'none';

type LidoProtocolData = {
  apy: number | null;
  totalStakedWei: string | null;
  updatedAt: string | null;
  source: LidoApySource;
  stale: boolean;
};

export interface StakingResponse {
  success: boolean;
  data: StakingTransaction;
}

export interface PositionResponse {
  success: boolean;
  data: StakingPosition;
}

export interface CacheStatus {
  hasCache: boolean;
  cacheAge: number;
  isExpired: boolean;
}

export interface TransactionExecutionStatus {
  transactionHash: string;
  confirmed: boolean;
}

const inFlightStakingExecutionByKey = new Map<string, Promise<TransactionExecutionStatus>>();

function normalizeExecutionHex(value: unknown): string {
  if (typeof value === 'bigint') return `0x${value.toString(16)}`;
  if (typeof value === 'number') return `0x${BigInt(Math.trunc(value)).toString(16)}`;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '0x0';
    if (trimmed.startsWith('0x')) return trimmed.toLowerCase();
    try {
      return `0x${BigInt(trimmed).toString(16)}`;
    } catch {
      return trimmed.toLowerCase();
    }
  }
  return '0x0';
}

function buildStakingExecutionKey(input: {
  chainId: number;
  to: string;
  data: string;
  value: unknown;
}): string {
  return [
    input.chainId,
    input.to.toLowerCase(),
    input.data.toLowerCase(),
    normalizeExecutionHex(input.value),
  ].join('|');
}

class StakingApiClient {
  private baseUrl: string;
  private account: any;
  private switchChain: SwitchChainFn | null;

  // Cache for Lido protocol data to prevent over-fetching and UI flicker.
  private lidoDataCache: LidoProtocolData | null = null;
  private lidoDataCacheTime: number = 0;
  private readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
  private readonly NULL_APY_CACHE_DURATION = 15 * 1000; // retry quickly when APY is missing
  private readonly STALE_AFTER_MS = 15 * 60 * 1000; // 15 minutes

  constructor(account: any, switchChain?: SwitchChainFn) {
    this.switchChain = switchChain || null;

    // Use env var for direct access (SSR/tests), otherwise use Next.js rewrite proxy.
    const direct = process.env.NEXT_PUBLIC_STAKING_API_URL || process.env.VITE_STAKING_API_URL;
    const isBrowser = typeof window !== 'undefined';

    if (!isBrowser && direct && direct.length > 0) {
      this.baseUrl = direct.replace(/\/+$/, '');
    } else {
      this.baseUrl = '/api/staking';
    }

    this.account = account;
  }

  private toWei(amount: string, decimals: number = 18): string {
    return parseAmountToWei(amount, decimals).toString();
  }

  private getAddressFromToken(): string | null {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      if (!token) return null;

      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      return payload.sub || payload.address || null;
    } catch (error) {
      console.error('[STAKING] Error parsing JWT:', error);
      return null;
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Get JWT from auth-service (centralized authentication)
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    return headers;
  }

  private async generateSignature(message: string): Promise<string> {
    // Check if we have a JWT token first (centralized auth)
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    // If we have a JWT token, use placeholder signature (backend validates JWT via auth-service)
    if (authToken) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }

    // Only try to sign with account if we don't have JWT (pure wallet users)
    if (this.account) {
      try {
        const signature = await this.account.signMessage({ message });
        return signature;
      } catch (error) {
        console.error('[STAKING] Error signing message:', error);
        throw new Error('Failed to sign message');
      }
    }

    throw new Error('No authentication method available. Please authenticate first.');
  }

  private async getAuthData(message: string) {
    const signature = await this.generateSignature(message);
    const userAddress = this.account?.address || this.getAddressFromToken() || '';

    if (!userAddress) {
      throw new Error('User address not found. Please connect wallet or authenticate.');
    }

    return {
      address: userAddress,
      signature,
      message,
      timestamp: Date.now(),
      walletType: this.account ? 'smart_wallet' : 'jwt',
      chainId: 1, // Ethereum mainnet
      isSmartWallet: !!this.account
    };
  }

  async getTokens(): Promise<StakingToken[]> {
    // Token list is static (Lido contracts on Ethereum Mainnet); protocol fields come from backend/Lido API.
    const lidoData = await this.fetchLidoProtocolData();

    return [
      {
        symbol: 'ETH',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
        stakingAPY: lidoData.apy,
        apySource: lidoData.source,
        apyUpdatedAt: lidoData.updatedAt,
        apyStale: lidoData.stale,
        totalStaked: lidoData.totalStakedWei,
        minimumStake: '1000000000000000000', // 1 ETH in wei
        lockPeriod: 0,
        isActive: true,
      },
      {
        symbol: 'stETH',
        address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        decimals: 18,
        stakingAPY: lidoData.apy,
        apySource: lidoData.source,
        apyUpdatedAt: lidoData.updatedAt,
        apyStale: lidoData.stale,
        totalStaked: lidoData.totalStakedWei,
        minimumStake: '1000000000000000', // 0.001 ETH in wei
        lockPeriod: 0,
        isActive: true,
      },
      {
        symbol: 'wstETH',
        address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
        decimals: 18,
        stakingAPY: lidoData.apy,
        apySource: lidoData.source,
        apyUpdatedAt: lidoData.updatedAt,
        apyStale: lidoData.stale,
        totalStaked: lidoData.totalStakedWei,
        minimumStake: '1000000000000000', // 0.001 ETH in wei
        lockPeriod: 0,
        isActive: true,
      }
    ];
  }

  private async fetchLidoProtocolData(): Promise<LidoProtocolData> {
    const now = Date.now();
    const previousCache = this.lidoDataCache;
    const cacheAge = this.lidoDataCacheTime ? now - this.lidoDataCacheTime : Number.POSITIVE_INFINITY;
    const previousHasApy = previousCache?.apy != null;
    const cacheWindow = previousHasApy ? this.CACHE_DURATION : this.NULL_APY_CACHE_DURATION;
    if (previousCache && cacheAge < cacheWindow) {
      return {
        ...previousCache,
        stale: cacheAge > this.STALE_AFTER_MS,
      };
    }

    const parseApy = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        if (value > 0 && value < 0.2) return value * 100; // decimal APR (0.0342) -> %
        if (value > 100 && value < 10_000) return value / 100; // bps-like payload (342) -> 3.42%
        return value <= 10_000 ? value : null;
      }
      if (typeof value === 'string') {
        const n = Number(value.replace('%', '').replace(',', '.').trim());
        if (!Number.isFinite(n)) return null;
        if (n > 0 && n < 0.2) return n * 100;
        if (n > 100 && n < 10_000) return n / 100;
        return n <= 10_000 ? n : null;
      }
      return null;
    };

    const parseTotalStakedWei = (value: unknown): string | null => {
      if (typeof value === 'string' && value.trim().length > 0) return value;
      if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
      return null;
    };

    const parseUpdatedAt = (value: unknown): string | null => {
      if (!value) return null;
      if (typeof value === 'string') {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        const ms = value < 1e12 ? value * 1000 : value;
        return new Date(ms).toISOString();
      }
      return null;
    };

    const normalizeProtocolPayload = (raw: any): Omit<LidoProtocolData, 'source' | 'stale'> => {
      const apyCandidate =
        raw?.currentAPY ??
        raw?.currentApy ??
        raw?.smaApr ??
        raw?.smaAPR ??
        raw?.smaAPY ??
        raw?.apy ??
        raw?.apr ??
        raw?.data?.currentAPY ??
        raw?.data?.currentApy ??
        raw?.data?.smaApr ??
        raw?.data?.smaAPR ??
        raw?.data?.smaAPY ??
        raw?.data?.apy ??
        raw?.data?.apr ??
        raw?.result?.currentAPY ??
        raw?.result?.currentApy ??
        raw?.result?.smaApr ??
        raw?.result?.smaAPR ??
        raw?.result?.smaAPY ??
        raw?.result?.apy ??
        raw?.result?.apr;

      const totalCandidate =
        raw?.totalStaked ??
        raw?.totalStakedWei ??
        raw?.totalPooledEther ??
        raw?.data?.totalStaked ??
        raw?.data?.totalStakedWei ??
        raw?.result?.totalStaked ??
        raw?.result?.totalStakedWei;

      const updatedAtCandidate =
        raw?.lastUpdate ??
        raw?.updatedAt ??
        raw?.timestamp ??
        raw?.timeUnix ??
        raw?.data?.lastUpdate ??
        raw?.data?.updatedAt ??
        raw?.data?.timestamp ??
        raw?.data?.timeUnix ??
        raw?.result?.lastUpdate ??
        raw?.result?.updatedAt ??
        raw?.result?.timestamp ??
        raw?.result?.timeUnix;

      return {
        apy: parseApy(apyCandidate),
        totalStakedWei: parseTotalStakedWei(totalCandidate),
        updatedAt: parseUpdatedAt(updatedAtCandidate),
      };
    };

    let backendTotalStakedWei: string | null = null;
    let backendUpdatedAt: string | null = null;

    // Prefer backend APY when available.
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const backendResp = await fetch(`${this.baseUrl}/api/lido/protocol/info`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (backendResp.ok) {
        const backendJson = await backendResp.json();
        const normalized = normalizeProtocolPayload(backendJson?.data ?? backendJson);
        backendTotalStakedWei = normalized.totalStakedWei ?? null;
        backendUpdatedAt = normalized.updatedAt ?? null;

        if (normalized.apy != null) {
          this.lidoDataCache = {
            ...normalized,
            updatedAt: normalized.updatedAt ?? null,
            source: 'backend',
            stale: false,
          };
          this.lidoDataCacheTime = now;
          return this.lidoDataCache;
        }
      }
    } catch (backendError) {
      console.warn('[STAKING] Backend protocol info unavailable, falling back to Lido API:', backendError);
    }

    const isBrowser = typeof window !== 'undefined';

    // Fallback: Lido public endpoints (APR only)
    // stake.lido.fi blocks browser CORS; use it only server-side.
    if (!isBrowser) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch('https://stake.lido.fi/api/stats', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const normalized = normalizeProtocolPayload(data);
          const result: LidoProtocolData = {
            apy: normalized.apy,
            totalStakedWei: normalized.totalStakedWei ?? backendTotalStakedWei,
            updatedAt: normalized.updatedAt ?? backendUpdatedAt,
            source: 'lido-stats',
            stale: false,
          };
          this.lidoDataCache = result;
          this.lidoDataCacheTime = now;
          return result;
        }
      } catch (error) {
        console.warn('[STAKING] Failed to fetch APR from stake.lido.fi:', error);
      }
    }

    const aprEndpoints = [
      'https://eth-api.lido.fi/v1/protocol/steth/apr/sma',
      'https://eth-api.lido.fi/v1/protocol/steth/apr/last',
      // Legacy fallback
      'https://api.lido.fi/v1/protocol/staking/apr/last',
    ];

    for (const endpoint of aprEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(endpoint, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const data = await response.json();
        const normalized = normalizeProtocolPayload(data);
        if (normalized.apy == null) continue;

        const result: LidoProtocolData = {
          apy: normalized.apy,
          totalStakedWei: normalized.totalStakedWei ?? backendTotalStakedWei,
          updatedAt: normalized.updatedAt ?? backendUpdatedAt,
          source: 'lido-apr-last',
          stale: false,
        };
        this.lidoDataCache = result;
        this.lidoDataCacheTime = now;
        return result;
      } catch (error) {
        console.warn(`[STAKING] Failed to fetch APR from ${endpoint}:`, error);
      }
    }

    if (previousCache) {
      const staleFallback: LidoProtocolData = {
        ...previousCache,
        stale: true,
        source: previousCache.source || 'cache',
      };
      this.lidoDataCache = staleFallback;
      this.lidoDataCacheTime = now;
      return staleFallback;
    }

    const empty: LidoProtocolData = {
      apy: null,
      totalStakedWei: backendTotalStakedWei,
      updatedAt: null,
      source: 'none',
      stale: true,
    };
    this.lidoDataCache = empty;
    this.lidoDataCacheTime = now;
    return empty;
  }

  async getUserPosition(): Promise<StakingPosition | null> {
    const userAddress = this.account?.address || this.getAddressFromToken();
    if (!userAddress) return null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Use centralized auth headers
      const headers = this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/api/lido/position/${userAddress}`, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('[STAKING] Error fetching position:', response.status);
        return null;
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error('[STAKING] Error fetching user position:', error);
      return null;
    }
  }

  async getHistory(limit = 50): Promise<StakingTransaction[]> {
    const userAddress = this.account?.address || this.getAddressFromToken();
    if (!userAddress) return [];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const headers = this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/lido/history/${userAddress}?limit=${limit}`, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      if (!response.ok) return [];

      const result = await response.json();
      return result.success ? (result.data as StakingTransaction[]) : [];
    } catch (error) {
      console.error('[STAKING] Error fetching history:', error);
      return [];
    }
  }

  async getPortfolio(days = 30): Promise<PortfolioResponse | null> {
    const userAddress = this.account?.address || this.getAddressFromToken();
    if (!userAddress) return null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const headers = this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/lido/portfolio/${userAddress}?days=${days}`, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      if (!response.ok) return null;

      const result = await response.json();
      return result.success ? (result.data as PortfolioResponse) : null;
    } catch (error) {
      console.error('[STAKING] Error fetching portfolio:', error);
      return null;
    }
  }

  async getWithdrawals(): Promise<WithdrawalRequest[]> {
    const userAddress = this.account?.address || this.getAddressFromToken();
    if (!userAddress) return [];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const headers = this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/lido/withdrawals/${userAddress}`, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      if (!response.ok) return [];

      const result = await response.json();
      return result.success ? (result.data as WithdrawalRequest[]) : [];
    } catch (error) {
      console.error('[STAKING] Error fetching withdrawals:', error);
      return [];
    }
  }

  async claimWithdrawals(requestIds: string[]): Promise<StakingTransaction> {
    const userAddress = this.account?.address || this.getAddressFromToken();
    if (!userAddress) {
      throw new Error('Please connect your wallet or authenticate first.');
    }
    if (!requestIds?.length) {
      throw new Error('No withdrawal requestIds provided');
    }

    try {
      const headers = this.getAuthHeaders();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${this.baseUrl}/api/lido/withdrawals/claim`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userAddress,
          requestIds,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let message = 'Unknown error';
        try {
          const json = await response.json();
          if (json && typeof json === 'object') {
            message =
              (json as any).error ||
              (json as any).message ||
              JSON.stringify(json);
          }
        } catch {
          const errorText = await response.text().catch(() => 'Unknown error');
          message = errorText || 'Unknown error';
        }
        if (/internal server error/i.test(message)) {
          message = 'Claim could not be prepared right now. Refresh withdrawal status and try again.';
        }
        throw new Error(`Claim failed: ${message}`);
      }

      const result = await response.json();
      if (result.success) return result.data as StakingTransaction;
      throw new Error(result.message || 'Claim failed');
    } catch (error) {
      console.error('[STAKING] Error claiming withdrawals:', error);
      throw error instanceof Error ? error : new Error('Claim failed');
    }
  }

  async submitTransactionHash(id: string, transactionHash: string): Promise<void> {
    const userAddress = this.account?.address || this.getAddressFromToken();
    if (!userAddress) return;

    try {
      const headers = this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/lido/transaction/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ id, userAddress, transactionHash }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.warn('[STAKING] Failed to submit tx hash:', response.status, errorText);
      }
    } catch (error) {
      console.warn('[STAKING] submitTransactionHash error:', error);
    }
  }

  async stake(amount: string): Promise<StakingTransaction> {
    const userAddress = this.account?.address || this.getAddressFromToken();
    if (!userAddress) {
      throw new Error('Please connect your wallet or authenticate first.');
    }

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Invalid amount. Please enter a positive number.');
    }

    try {
      const amountWei = this.toWei(amount);
      const message = `Stake ${amount} ETH\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);

      const headers = this.getAuthHeaders();

      console.log('[STAKING] Sending stake request:', {
        url: `${this.baseUrl}/api/lido/stake`,
        userAddress,
        amount: amountWei
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetchWithAuth(`${this.baseUrl}/api/lido/stake`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userAddress,
          amount: amountWei,
          authData
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('[STAKING] Stake response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[STAKING] Stake error:', response.status, errorText);

        if (response.status === 401) {
          throw new Error('Authentication expired. Please re-authenticate.');
        }

        throw new Error(`Staking failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('[STAKING] Stake response data:', result);

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.message || 'Staking failed');
      }
    } catch (error) {
      console.error('[STAKING] Error staking:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Staking request timeout. Please try again later.`);
        }
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error(`Cannot connect to staking service. Please check if the service is running.`);
        }
        throw error;
      }
      throw new Error('Failed to stake tokens: Unknown error');
    }
  }

  async unstake(amount: string): Promise<StakingTransaction> {
    const userAddress = this.account?.address || this.getAddressFromToken();
    if (!userAddress) {
      throw new Error('Please connect your wallet or authenticate first.');
    }

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Invalid amount. Please enter a positive number.');
    }

    try {
      const amountWei = this.toWei(amount);
      const message = `Unstake ${amount} stETH\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);

      const headers = this.getAuthHeaders();

      console.log('[STAKING] Sending unstake request:', {
        url: `${this.baseUrl}/api/lido/unstake`,
        userAddress,
        amount: amountWei
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetchWithAuth(`${this.baseUrl}/api/lido/unstake`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userAddress,
          amount: amountWei,
          authData
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('[STAKING] Unstake response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[STAKING] Unstake error:', response.status, errorText);

        if (response.status === 401) {
          throw new Error('Authentication expired. Please re-authenticate.');
        }

        throw new Error(`Unstaking failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('[STAKING] Unstake response data:', result);

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.message || 'Unstaking failed');
      }
    } catch (error) {
      console.error('[STAKING] Error unstaking:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Unstaking request timeout. Please try again later.`);
        }
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error(`Cannot connect to staking service. Please check if the service is running.`);
        }
        throw error;
      }
      throw new Error('Failed to unstake tokens: Unknown error');
    }
  }

  async executeTransaction(txData: any): Promise<string> {
    const result = await this.executeTransactionWithStatus(txData);
    return result.transactionHash;
  }

  async executeTransactionWithStatus(txData: any): Promise<TransactionExecutionStatus> {
    const describeUnknown = (err: unknown): string => {
      if (err instanceof Error) return err.message || 'Unknown error';
      if (typeof err === 'string') return err;
      if (err && typeof err === 'object') {
        const anyErr = err as any;
        const message =
          anyErr?.shortMessage ||
          anyErr?.message ||
          anyErr?.error?.message ||
          anyErr?.error ||
          anyErr?.reason;
        if (typeof message === 'string' && message.trim().length > 0) return message;
        try {
          const json = JSON.stringify(anyErr);
          if (json && json !== '{}' && json !== '[]') return json;
        } catch {}
        try {
          const props = Object.getOwnPropertyNames(anyErr);
          if (props.length) {
            const out: Record<string, unknown> = {};
            for (const p of props) out[p] = anyErr[p];
            return JSON.stringify(out);
          }
        } catch {
          return String(anyErr);
        }
      }
      return 'Unknown error';
    };

    const extractTxHash = (value: unknown): string | null => {
      if (!value) return null;
      if (typeof value === 'string') {
        return /^0x[a-fA-F0-9]{64}$/.test(value) ? value : null;
      }
      const candidate = value as any;
      const maybeStrings = [
        candidate?.transactionHash,
        candidate?.hash,
        candidate?.receipt?.transactionHash,
        candidate?.result,
        candidate?.result?.transactionHash,
        candidate?.response?.transactionHash,
        candidate?.response?.hash,
        candidate?.txHash,
      ];
      for (const s of maybeStrings) {
        if (typeof s === 'string' && /^0x[a-fA-F0-9]{64}$/.test(s)) return s;
      }
      return null;
    };

    const requestWithTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
      return await new Promise<T>((resolve, reject) => {
        const timeoutHandle = setTimeout(() => {
          reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s. Check your wallet and try again.`));
        }, timeoutMs);
        promise
          .then((value) => {
            clearTimeout(timeoutHandle);
            resolve(value);
          })
          .catch((error) => {
            clearTimeout(timeoutHandle);
            reject(error);
          });
      });
    };

    try {
      if (!this.account) {
        throw new Error('Wallet session not available. Please ensure your wallet is connected in the app.');
      }

      if (!this.account.sendTransaction) {
        throw new Error('Wallet does not support sendTransaction. Please reconnect your wallet.');
      }

      const jwtAddress = this.getAddressFromToken();
      if (jwtAddress && this.account.address && jwtAddress.toLowerCase() !== this.account.address.toLowerCase()) {
        throw new Error(`Connected wallet (${this.account.address}) does not match authenticated address (${jwtAddress}).`);
      }

      console.log('Raw transaction data received:', txData);

      // IMPORTANT: Lido staking is on Ethereum Mainnet (chainId 1)
      // The transaction data from backend should have chainId: 1
      const expectedChainId = txData.chainId || 1; // Default to Ethereum mainnet
      console.log('Expected chainId for transaction:', expectedChainId);

      if (expectedChainId !== 1) {
        throw new Error('This transaction must be executed on Ethereum Mainnet (chainId 1). Please switch network in the app and try again.');
      }

      // Extract transaction data
      const toAddress = txData.to;
      const value = txData.value;
      const data = txData.data;
      const gas = txData.gasLimit || txData.gas;

      console.log('Extracted transaction data:', {
        toAddress,
        value,
        data,
        gas
      });

      // Validate required fields
      if (!toAddress || !data) {
        throw new Error(`Invalid transaction data: missing to address (${toAddress}) or data (${data})`);
      }

      // Ensure to address is valid (42 characters starting with 0x)
      if (!toAddress || !/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
        throw new Error(`Invalid to address: ${toAddress}`);
      }
      
      // Ensure data is valid hex
      if (!data || !/^0x([a-fA-F0-9]{2})*$/.test(data)) {
        throw new Error(`Invalid data: ${data}`);
      }

      // Let thirdweb calculate gas price automatically (same as lending)
      // This allows the wallet/provider to use the most efficient gas price
      // and results in lower network fees

      // Format transaction data for thirdweb/MetaMask
      // Convert value to hex properly handling BigInt
      let valueHex = '0x0';
      if (value) {
        try {
          // Handle both string and number inputs, and both decimal and hex strings
          const valueStr = typeof value === 'string' ? value : value.toString();
          // If already hex, use it; otherwise convert from decimal
          if (valueStr.startsWith('0x')) {
            valueHex = valueStr;
          } else {
            // Convert decimal string to BigInt then to hex
            const bigIntValue = BigInt(valueStr);
            valueHex = `0x${bigIntValue.toString(16)}`;
          }
        } catch (error) {
          console.error('Error converting value to hex:', error);
          throw new Error(`Invalid value format: ${value}`);
        }
      }

      // Convert gas to hex properly (only if provided by backend)
      // Use 'gas' instead of 'gasLimit' for thirdweb compatibility (same as lending)
      // If not provided, let thirdweb estimate automatically for accurate fees
      let gasHex: string | undefined;
      if (gas) {
        try {
          const gasStr = typeof gas === 'string' ? gas : gas.toString();
          if (gasStr.startsWith('0x')) {
            gasHex = gasStr;
          } else {
            // Use BigInt for gas to handle large values
            const bigIntGas = BigInt(gasStr);
            gasHex = `0x${bigIntGas.toString(16)}`;
          }
          console.log('Using gas from backend:', gasHex);
        } catch (error) {
          console.error('Error converting gas to hex:', error);
          // If conversion fails, let thirdweb estimate
        }
      } else {
        console.log('No gas provided, letting thirdweb estimate automatically');
      }

      const formattedTxData: any = {
        to: toAddress,
        value: valueHex,
        data: data,
        // IMPORTANT: Specify chainId to ensure transaction goes to correct network
        // Lido staking is on Ethereum mainnet (chainId 1)
        chainId: 1
      };

      // Only set gas if we have it from backend (same format as lending)
      // Otherwise let thirdweb estimate automatically for accurate fees
      if (gasHex) {
        formattedTxData.gas = gasHex;
      }

      // Don't set gasPrice - let thirdweb calculate it automatically (same as lending)
      // This results in optimal fees as the wallet/provider can optimize based on current network conditions

      console.log('Formatted transaction data for thirdweb:', formattedTxData);
      console.log('Transaction will be sent to Ethereum mainnet (chainId: 1)');

      // Validate final transaction data
      if (!formattedTxData.to || !formattedTxData.data) {
        throw new Error('Invalid transaction data after formatting');
      }

      console.log('Sending transaction to thirdweb...');
      console.log('Account address:', this.account.address);
      console.log('Account type:', typeof this.account);

      const txKey = buildStakingExecutionKey({
        chainId: 1,
        to: formattedTxData.to,
        data: formattedTxData.data,
        value: formattedTxData.value,
      });

      const existingExecution = inFlightStakingExecutionByKey.get(txKey);
      if (existingExecution) {
        return await existingExecution;
      }
      const executionPromise = (async (): Promise<TransactionExecutionStatus> => {
        if (!this.switchChain) {
          throw new Error(
            'Wallet network switching is unavailable. Please reconnect your wallet.'
          );
        }

        try {
          await this.switchChain(defineChain(expectedChainId));
        } catch (switchError) {
          throw new Error(
            `Unable to switch selected wallet to Ethereum Mainnet: ${describeUnknown(switchError)}`
          );
        }

        const executionAttempt = safeExecuteTransactionV2(() =>
          sendAccountTransactionNonEvidence({
            chainId: expectedChainId,
            account: this.account,
            transaction: formattedTxData,
          })
        );

        const result = await requestWithTimeout(
          executionAttempt,
          70_000,
          'Wallet confirmation',
        );

        if (!result.success || !result.transactionHash) {
          throw new Error(result.error || 'Transaction failed');
        }

        console.log('✅ Transaction hash received:', result.transactionHash);
        return { transactionHash: result.transactionHash, confirmed: false };
      })();

      inFlightStakingExecutionByKey.set(txKey, executionPromise);
      try {
        return await executionPromise;
      } finally {
        if (inFlightStakingExecutionByKey.get(txKey) === executionPromise) {
          inFlightStakingExecutionByKey.delete(txKey);
        }
      }
    } catch (error) {
      const msg = describeUnknown(error);
      const code = (error as any)?.code ?? (error as any)?.error?.code;

      if (Number(code) === 4001 || /user rejected|user denied|rejected/i.test(msg)) {
        throw new Error('Transaction rejected in wallet.');
      }
      if (/likely to fail|couldn'?t be completed|canceled to save/i.test(msg)) {
        throw new Error('Wallet blocked this transaction because it is likely to fail. Review amount/method and try again.');
      }
      if (/insufficient funds|insufficient balance|gas/i.test(msg)) {
        throw new Error('Insufficient balance for gas or amount.');
      }
      if (/wrong network|chain|network/i.test(msg)) {
        throw new Error('Wrong network. Please switch to Ethereum Mainnet.');
      }
      console.error('Error executing transaction:', { message: msg, raw: error });
      throw new Error(`Transaction failed: ${msg}`);
    }
  }

  // Method to clear cache (useful for testing or manual refresh)
  clearLidoDataCache(): void {
    this.lidoDataCache = null;
    this.lidoDataCacheTime = 0;
    console.log('[STAKING] Lido data cache cleared');
  }

  // Method to get cache status (useful for debugging)
  getCacheStatus(): CacheStatus {
    const now = Date.now();
    const cacheAge = this.lidoDataCacheTime ? now - this.lidoDataCacheTime : 0;
    const isExpired = cacheAge > this.CACHE_DURATION;

    return {
      hasCache: !!this.lidoDataCache,
      cacheAge,
      isExpired
    };
  }
}

export const useStakingApi = () => {
  const account = useActiveAccount();
  const switchChain = useSwitchActiveWalletChain();
  return useMemo(() => new StakingApiClient(account, switchChain), [account, switchChain]);
};

export default StakingApiClient;
