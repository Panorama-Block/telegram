'use client';

import { useMemo } from 'react';
import { useActiveAccount, useActiveWallet, useSwitchActiveWalletChain } from 'thirdweb/react';
import { defineChain } from 'thirdweb';
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
  private activeWallet: any;
  private switchChain: SwitchChainFn | null;

  // Cache for Lido protocol data to prevent infinite loops
  private lidoDataCache: any = null;
  private lidoDataCacheTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(account: any, switchChain?: SwitchChainFn, activeWallet?: any) {
    this.activeWallet = activeWallet ?? null;
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

  private getPreferredInjectedProviderId(): string {
    const raw =
      this.activeWallet?.id ||
      this.activeWallet?.walletId ||
      this.account?.walletId ||
      this.account?.wallet?.id ||
      '';
    return typeof raw === 'string' ? raw.toLowerCase() : '';
  }

  private providerMatchesPreferredWallet(provider: any, preferredWalletId: string): boolean {
    if (!preferredWalletId) return false;
    if (preferredWalletId.includes('metamask')) return !!provider?.isMetaMask;
    if (preferredWalletId.includes('phantom')) return !!provider?.isPhantom;
    if (preferredWalletId.includes('coinbase')) return !!provider?.isCoinbaseWallet;
    if (preferredWalletId.includes('rabby')) return !!provider?.isRabby;
    return false;
  }

  private async resolveInjectedProvider(address?: string): Promise<any | null> {
    const ethereum = typeof window !== 'undefined' ? (window as any)?.ethereum : null;
    if (!ethereum) return null;

    const candidates = Array.isArray(ethereum?.providers) && ethereum.providers.length > 0
      ? ethereum.providers
      : [ethereum];

    const normalizedAddress = typeof address === 'string' ? address.toLowerCase() : '';
    const preferredWalletId = this.getPreferredInjectedProviderId();

    if (normalizedAddress) {
      const selectedAddressMatch = candidates.find((provider: any) => {
        const selected = typeof provider?.selectedAddress === 'string' ? provider.selectedAddress.toLowerCase() : null;
        return selected === normalizedAddress;
      });
      if (selectedAddressMatch) return selectedAddressMatch;
    }

    if (normalizedAddress) {
      for (const provider of candidates) {
        if (typeof provider?.request !== 'function') continue;
        try {
          const accounts = await provider.request({ method: 'eth_accounts' });
          if (Array.isArray(accounts) && accounts.some((item) => typeof item === 'string' && item.toLowerCase() === normalizedAddress)) {
            return provider;
          }
        } catch {}
      }
    }

    const preferredProvider = candidates.find((provider: any) =>
      this.providerMatchesPreferredWallet(provider, preferredWalletId),
    );
    if (preferredProvider) return preferredProvider;

    return candidates[0] ?? null;
  }

  private isUnsupportedProviderRequest(error: unknown): boolean {
    const anyError = error as any;
    const code = Number(anyError?.code);
    const message = String(anyError?.message || anyError?.shortMessage || anyError || '').toLowerCase();
    return (
      code === -32601 ||
      message.includes('method not found') ||
      message.includes('unsupported method') ||
      message.includes('not implemented')
    );
  }

  private normalizeAddress(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null;
    return trimmed.toLowerCase();
  }

  private normalizeHexData(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed.startsWith('0x')) return null;
    if (!/^0x[0-9a-f]*$/.test(trimmed)) return null;
    return trimmed;
  }

  private async recoverRecentTxHashByPayload(params: {
    provider: any;
    expectedChainId: number;
    from: string;
    to?: string | null;
    data?: string | null;
    timeoutMs?: number;
    lookbackBlocks?: number;
  }): Promise<string | null> {
    const {
      provider,
      expectedChainId,
      from,
      to,
      data,
      timeoutMs = 25_000,
      lookbackBlocks = 12,
    } = params;

    if (!provider || typeof provider.request !== 'function') return null;
    const normalizedFrom = this.normalizeAddress(from);
    if (!normalizedFrom) return null;
    const normalizedTo = this.normalizeAddress(to);
    const normalizedData = this.normalizeHexData(data);

    if (!normalizedTo && !normalizedData) return null;

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      try {
        const chainHex = await provider.request({ method: 'eth_chainId' });
        const chainId =
          typeof chainHex === 'string' && /^0x[0-9a-fA-F]+$/.test(chainHex)
            ? Number.parseInt(chainHex, 16)
            : null;
        if (chainId != null && chainId !== expectedChainId) {
          return null;
        }

        const latestHex = await provider.request({ method: 'eth_blockNumber' });
        const latest =
          typeof latestHex === 'string' && /^0x[0-9a-fA-F]+$/.test(latestHex)
            ? Number.parseInt(latestHex, 16)
            : null;
        if (latest == null) break;

        for (let offset = 0; offset <= lookbackBlocks; offset++) {
          const blockNum = latest - offset;
          if (blockNum < 0) break;

          const blockHex = `0x${blockNum.toString(16)}`;
          const block = await provider.request({
            method: 'eth_getBlockByNumber',
            params: [blockHex, true],
          });

          const txs = Array.isArray((block as any)?.transactions) ? (block as any).transactions : [];
          for (const tx of txs) {
            const txFrom = this.normalizeAddress((tx as any)?.from);
            if (txFrom !== normalizedFrom) continue;

            if (normalizedTo) {
              const txTo = this.normalizeAddress((tx as any)?.to);
              if (txTo !== normalizedTo) continue;
            }

            if (normalizedData) {
              const txData = this.normalizeHexData((tx as any)?.input ?? (tx as any)?.data);
              if (txData !== normalizedData) continue;
            }

            const txHash = (tx as any)?.hash;
            if (typeof txHash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(txHash)) {
              return txHash;
            }
          }
        }
      } catch {
        // Ignore and retry.
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    return null;
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
        totalStaked: lidoData.totalStakedWei,
        minimumStake: '1000000000000000', // 0.001 ETH in wei
        lockPeriod: 0,
        isActive: true,
      }
    ];
  }

  private async fetchLidoProtocolData(): Promise<{ apy: number | null; totalStakedWei: string | null }> {
    // Check if we have valid cached data
    const now = Date.now();
    if (this.lidoDataCache && (now - this.lidoDataCacheTime) < this.CACHE_DURATION) {
      return this.lidoDataCache;
    }

    const parseApy = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };

    // Prefer our backend when available (already normalized)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const backendResp = await fetch(`${this.baseUrl}/api/lido/protocol/info`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (backendResp.ok) {
        const backendJson = await backendResp.json();
        if (backendJson?.success && backendJson?.data) {
          const result = {
            apy: parseApy(backendJson.data.currentAPY),
            totalStakedWei: typeof backendJson.data.totalStaked === 'string' ? backendJson.data.totalStaked : null,
          };

          this.lidoDataCache = result;
          this.lidoDataCacheTime = now;
          return result;
        }
      }
    } catch (backendError) {
      console.warn('[STAKING] Backend protocol info unavailable, falling back to Lido API:', backendError);
    }

    // Fallback: Lido public endpoints (APR only)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('https://stake.lido.fi/api/stats', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const result = { apy: parseApy(data?.apr), totalStakedWei: null };
        this.lidoDataCache = result;
        this.lidoDataCacheTime = now;
        return result;
      }
    } catch (error) {
      console.warn('[STAKING] Failed to fetch APR from stake.lido.fi:', error);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch('https://api.lido.fi/v1/protocol/staking/apr/last', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const result = { apy: parseApy(data?.apr), totalStakedWei: null };
        this.lidoDataCache = result;
        this.lidoDataCacheTime = now;
        return result;
      }
    } catch (error) {
      console.warn('[STAKING] Failed to fetch APR from api.lido.fi:', error);
    }

    const empty = { apy: null, totalStakedWei: null };
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

      // Trust-first UX: never trigger chain switch popups automatically.
      // If we can detect the current chain and it's not Ethereum mainnet, fail fast with a clear message.
      const walletProvider = await this.resolveInjectedProvider(this.account?.address);
      const currentChainHex = typeof walletProvider?.chainId === 'string' ? walletProvider.chainId : null;
      const currentChainId =
        currentChainHex && /^0x[0-9a-fA-F]+$/.test(currentChainHex)
          ? Number.parseInt(currentChainHex, 16)
          : null;
      if (currentChainId != null && currentChainId !== expectedChainId) {
        throw new Error(`Wrong network (chainId ${currentChainId}). Switch to Ethereum Mainnet (chainId 1) and try again.`);
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
        const result = await safeExecuteTransactionV2(async () => {
          const selectedProvider = await this.resolveInjectedProvider(this.account?.address);
          const recoverHashFromWallet = async (options?: { timeoutMs?: number; lookbackBlocks?: number }) => {
            return await this.recoverRecentTxHashByPayload({
              provider: selectedProvider,
              expectedChainId: expectedChainId,
              from: this.account.address,
              to: formattedTxData.to,
              data: formattedTxData.data,
              timeoutMs: options?.timeoutMs,
              lookbackBlocks: options?.lookbackBlocks,
            });
          };
          const sleep = async (ms: number) => {
            await new Promise((resolve) => setTimeout(resolve, ms));
          };
          const raceBroadcastWithRecovery = async (
            send: () => Promise<unknown>,
          ): Promise<{ transactionHash: string }> => {
            let settled = false;
            const sendPromise = requestWithTimeout(
              Promise.resolve(send()),
              45_000,
              'Wallet transaction broadcast',
            )
              .then((value) => {
                settled = true;
                return value;
              })
              .catch((error) => {
                settled = true;
                throw error;
              });

            const recoveryPromise = (async () => {
              const startedAt = Date.now();
              while (!settled && Date.now() - startedAt < 55_000) {
                const recoveredHash = await recoverHashFromWallet({
                  timeoutMs: 2_500,
                  lookbackBlocks: 24,
                });
                if (recoveredHash) return recoveredHash;
                if (settled) break;
                await sleep(600);
              }
              return null;
            })();

            const raceResult = await Promise.race([
              sendPromise.then((value) => ({ type: 'send' as const, value })),
              (async () => {
                const recoveredHash = await recoveryPromise;
                if (!recoveredHash) {
                  return await new Promise<never>(() => {});
                }
                settled = true;
                return { type: 'recovered' as const, hash: recoveredHash };
              })(),
            ]);

            if (raceResult.type === 'recovered') {
              void sendPromise.catch(() => {});
              return { transactionHash: raceResult.hash };
            }

            const directHash = extractTxHash(raceResult.value);
            if (directHash) {
              return { transactionHash: directHash };
            }

            const recoveredAfterSend = await recoverHashFromWallet({
              timeoutMs: 8_000,
              lookbackBlocks: 24,
            });
            if (recoveredAfterSend) {
              return { transactionHash: recoveredAfterSend };
            }

            throw new Error('Wallet submitted transaction without a hash.');
          };
          const canUseInjectedProvider =
            !!selectedProvider &&
            typeof selectedProvider.request === 'function' &&
            typeof this.account?.address === 'string';

          if (canUseInjectedProvider) {
            const providerTxPayload: Record<string, unknown> = {
              from: this.account.address,
              to: formattedTxData.to,
              data: formattedTxData.data,
              value: formattedTxData.value ?? '0x0',
            };
            if (formattedTxData.gas) providerTxPayload.gas = formattedTxData.gas;
            if (formattedTxData.gasPrice) providerTxPayload.gasPrice = formattedTxData.gasPrice;

            try {
              return await raceBroadcastWithRecovery(() =>
                Promise.resolve(
                  selectedProvider.request({
                    method: 'eth_sendTransaction',
                    params: [providerTxPayload],
                  }),
                ),
              );
            } catch (providerError) {
              if (!this.isUnsupportedProviderRequest(providerError)) {
                const recoveredProviderHash = await recoverHashFromWallet();
                if (recoveredProviderHash) {
                  return { transactionHash: recoveredProviderHash };
                }
                throw providerError;
              }
              console.warn('[STAKING] Injected provider does not support eth_sendTransaction, falling back to account.sendTransaction.');
            }
          }

          try {
            return await raceBroadcastWithRecovery(() =>
              Promise.resolve(this.account.sendTransaction(formattedTxData)),
            );
          } catch (accountSendError) {
            const recoveredAccountHash = await recoverHashFromWallet();
            if (recoveredAccountHash) {
              return { transactionHash: recoveredAccountHash };
            }
            throw accountSendError;
          }
        });

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
  const activeWallet = useActiveWallet();
  const switchChain = useSwitchActiveWalletChain();
  return useMemo(() => new StakingApiClient(account, switchChain, activeWallet), [account, switchChain, activeWallet]);
};

export default StakingApiClient;
