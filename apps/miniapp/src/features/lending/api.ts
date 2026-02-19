'use client';

import { useMemo } from 'react';
import { useActiveAccount, useActiveWallet, useActiveWalletChain, useSwitchActiveWalletChain } from 'thirdweb/react';
import { defineChain } from 'thirdweb';
import {
  LendingToken,
  LendingAccountPositionsResponse,
  ValidationResponse,
  CacheStatus
} from './types';
import { LENDING_CONFIG, API_ENDPOINTS, TOKEN_ICONS, VALIDATION_FEE, updateValidationFee } from './config';
import { parseAmountToWei } from '@/features/swap/utils';
import { safeExecuteTransactionV2 } from '@/shared/utils/transactionUtilsV2';
import { fetchWithAuth } from '@/shared/lib/fetchWithAuth';
import { getAuthWalletBinding } from '@/shared/lib/authWalletBinding';

type SwitchChainFn = (chain: ReturnType<typeof defineChain>) => Promise<void>;

type SharedTokensState = {
  tokens: LendingToken[] | null;
  fetchedAt: number;
  inFlight: Promise<LendingToken[]> | null;
  cooldownUntil: number;
};

const sharedTokensStateByBaseUrl = new Map<string, SharedTokensState>();

function getSharedTokensState(baseUrl: string): SharedTokensState {
  const existing = sharedTokensStateByBaseUrl.get(baseUrl);
  if (existing) return existing;
  const created: SharedTokensState = {
    tokens: null,
    fetchedAt: 0,
    inFlight: null,
    cooldownUntil: 0,
  };
  sharedTokensStateByBaseUrl.set(baseUrl, created);
  return created;
}

function extractRetryAfterSeconds(response: Response): number | null {
  const retryAfterHeader = response.headers.get('retry-after');
  if (!retryAfterHeader) return null;
  const asNumber = Number(retryAfterHeader);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return Math.round(asNumber);
  }
  const asDate = Date.parse(retryAfterHeader);
  if (Number.isFinite(asDate)) {
    const deltaMs = asDate - Date.now();
    if (deltaMs > 0) return Math.ceil(deltaMs / 1000);
  }
  return null;
}

function normalizeIconSymbol(symbol: string | undefined | null): string {
  if (!symbol) return '';
  const trimmed = symbol.trim();
  if (!trimmed) return '';
  if (trimmed === 'iAVAX') return 'AVAX';
  return trimmed.replace(/\.e$/i, '').replace(/\.b$/i, '');
}

function normalizeDisplaySymbol(symbol: string | undefined | null): string {
  if (!symbol) return 'UNKNOWN';
  return symbol.trim() === 'iAVAX' ? 'AVAX' : symbol.trim();
}

function resolveLendingTokenIcon(...symbols: Array<string | undefined | null>): string | undefined {
  for (const symbol of symbols) {
    if (!symbol) continue;
    if (TOKEN_ICONS[symbol]) return TOKEN_ICONS[symbol];
    const upper = symbol.toUpperCase();
    if (TOKEN_ICONS[upper]) return TOKEN_ICONS[upper];
    const normalized = normalizeIconSymbol(symbol);
    if (!normalized) continue;
    if (TOKEN_ICONS[normalized]) return TOKEN_ICONS[normalized];
    const normalizedUpper = normalized.toUpperCase();
    if (TOKEN_ICONS[normalizedUpper]) return TOKEN_ICONS[normalizedUpper];
  }
  return undefined;
}

class LendingApiClient {
  private baseUrl: string;
  private account: any;
  private activeWallet: any;
  private activeChainId: number | null;
  private switchChain: SwitchChainFn | null;
  private lendingDataCache: any = null;
  private lendingDataCacheTime: number = 0;
  private readonly CACHE_DURATION = LENDING_CONFIG.CACHE_DURATION;

  constructor(account: any, activeWallet?: any, activeChainId?: number | null, switchChain?: SwitchChainFn) {
    this.activeWallet = activeWallet ?? null;
    this.activeChainId = activeChainId ?? null;
    this.switchChain = switchChain ?? null;
    // Use env var for direct access (SSR/tests), otherwise use Next.js rewrite proxy
    // to avoid CORS issues. Proxy is configured in next.config.ts.
    const direct = process.env.VITE_LENDING_API_BASE || process.env.NEXT_PUBLIC_LENDING_API_URL;
    const isBrowser = typeof window !== 'undefined';

    if (!isBrowser && direct && direct.length > 0) {
      this.baseUrl = direct.replace(/\/+$/, '');
    } else {
      this.baseUrl = '/api/lending';
    }

    this.account = account;
  }

  private getActiveWalletId(): string {
    const raw =
      this.activeWallet?.id ||
      this.activeWallet?.walletId ||
      this.account?.walletId ||
      this.account?.wallet?.id;
    return typeof raw === 'string' ? raw.toLowerCase() : '';
  }

  private formatWalletName(walletId: string | null | undefined): string {
    const id = (walletId || '').toLowerCase();
    if (!id) return 'connected wallet';
    if (id.includes('metamask')) return 'MetaMask';
    if (id.includes('phantom')) return 'Phantom';
    if (id.includes('coinbase')) return 'Coinbase Wallet';
    if (id.includes('inapp')) return 'in-app wallet';
    return walletId as string;
  }

  private assertWalletCompatibility(): void {
    if (!this.account?.sendTransaction || typeof this.account.sendTransaction !== 'function') {
      throw new Error('Connected wallet does not support EVM transactions. Reconnect using MetaMask or the in-app EVM wallet.');
    }

    const currentWalletId = this.getActiveWalletId();
    const { walletId: authWalletId, address: authWalletAddress } = getAuthWalletBinding();

    if (authWalletId && currentWalletId && authWalletId !== currentWalletId) {
      throw new Error(
        `You authenticated with ${this.formatWalletName(authWalletId)}, but the current wallet is ${this.formatWalletName(currentWalletId)}. Reconnect using ${this.formatWalletName(authWalletId)}.`
      );
    }

    if (authWalletId && !currentWalletId) {
      throw new Error(
        `Could not identify the active wallet. Reconnect using ${this.formatWalletName(authWalletId)} (the wallet used in login).`
      );
    }

    const accountAddress = typeof this.account?.address === 'string' ? this.account.address.toLowerCase() : null;
    if (authWalletAddress && accountAddress && authWalletAddress !== accountAddress) {
      throw new Error('Connected wallet address does not match the wallet used at login. Reconnect with the authenticated wallet.');
    }
  }

  private parseHexChainId(chainHex: unknown): number | null {
    if (typeof chainHex !== 'string') return null;
    if (!/^0x[0-9a-fA-F]+$/.test(chainHex)) return null;
    const parsed = Number.parseInt(chainHex, 16);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private resolveCurrentChainId(): number | null {
    const ethereum = typeof window !== 'undefined' ? (window as any)?.ethereum : null;
    const chainHex = typeof ethereum?.chainId === 'string' ? ethereum.chainId : null;
    const providerChainId = this.parseHexChainId(chainHex);
    if (providerChainId != null) return providerChainId;

    if (Number.isFinite(this.activeChainId)) {
      return Number(this.activeChainId);
    }

    return null;
  }

  private toWei(amount: string, decimals: number = 18): string {
    // Never use float math for base-unit conversion (precision loss + overflows).
    // Reuse the same BigInt decimal parser used by Swap/Staking.
    return parseAmountToWei(amount, decimals).toString();
  }

  private formatMessage(action: string, amount: string, tokenAddress?: string): string {
    const timestamp = Date.now();
    if (tokenAddress) {
      return `${action} ${amount} of token ${tokenAddress}\nTimestamp: ${timestamp}`;
    } else {
      return `${action}\nTimestamp: ${timestamp}`;
    }
  }

  private getAddressFromToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return null;

      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      return payload.sub || payload.address || null;
    } catch (error) {
      console.error('Error parsing JWT:', error);
      return null;
    }
  }

  private getConnectedWalletAddress(): string {
    const connectedAddress = this.account?.address;
    if (!connectedAddress) {
      throw new Error('Please connect your wallet in the app to use Lending.');
    }

    const tokenAddress = this.getAddressFromToken();
    if (tokenAddress && tokenAddress.toLowerCase() !== connectedAddress.toLowerCase()) {
      throw new Error('Connected wallet does not match your authenticated app wallet. Reconnect the correct wallet.');
    }

    return connectedAddress;
  }

  private async generateSignature(message: string): Promise<string> {
    // Check if we have a JWT token first
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    // If we have a JWT token, use placeholder signature (backend will validate JWT)
    if (authToken) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }

    // Only try to sign with account if we don't have JWT (pure MetaMask users)
    if (this.account) {
      try {
        const signature = await this.account.signMessage({ message });
        return signature;
      } catch (error) {
        console.error('[LENDING] Error signing message:', error);
        throw new Error('Failed to sign message');
      }
    }

    throw new Error('No authentication method available. Please authenticate first.');
  }

  private async getAuthData(message: string) {
    const signature = await this.generateSignature(message);
    const userAddress = this.getConnectedWalletAddress();

    return {
      address: userAddress,
      signature,
      message,
      timestamp: Date.now(),
      walletType: this.account ? 'smart_wallet' : 'jwt',
      chainId: 43114,
      isSmartWallet: !!this.account
    };
  }

  private async readBackendErrorMessage(response: Response): Promise<string> {
    const raw = await response.text().catch(() => '');
    if (!raw) return `HTTP error! status: ${response.status}`;
    try {
      const parsed = JSON.parse(raw);
      const message =
        parsed?.data?.error ||
        parsed?.error ||
        parsed?.message ||
        parsed?.data?.details;
      if (typeof message === 'string' && message.trim().length > 0) {
        const compact = message.replace(/\s+/g, ' ').trim();
        if (/too many requests|rate.?limit|-32005|429|BAD_DATA/i.test(compact)) {
          return 'RPC provider is rate-limited right now. Please try again in a few seconds.';
        }
        if (/invalid value for Contract target|argument=\"target\"|value=null/i.test(compact)) {
          return 'One or more lending markets are temporarily unavailable. Please refresh and try again.';
        }
        return compact.length > 220 ? `${compact.slice(0, 220)}...` : compact;
      }
    } catch {}
    return raw.length > 240 ? `${raw.slice(0, 240)}...` : raw;
  }

  private formatPrepareError(action: string, status: number, backendMessage: string): string {
    if (/VALIDATION_CONTRACT_ADDRESS/i.test(backendMessage)) {
      return `${action} is unavailable right now because the validation contract is not configured on the server.`;
    }
    if (status === 429) {
      return `${action} is temporarily rate-limited. Please try again in a few seconds.`;
    }
    return `${action} failed (${status}): ${backendMessage}`;
  }

  private getChainName(chainId: number): string {
    if (chainId === 43114) return 'Avalanche C-Chain';
    if (chainId === 1) return 'Ethereum Mainnet';
    return `chainId ${chainId}`;
  }

  private getAddChainParams(chainId: number): Record<string, unknown> | null {
    if (chainId === 43114) {
      return {
        chainId: '0xa86a',
        chainName: 'Avalanche C-Chain',
        nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
        rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
        blockExplorerUrls: ['https://snowtrace.io'],
      };
    }
    if (chainId === 1) {
      return {
        chainId: '0x1',
        chainName: 'Ethereum Mainnet',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://ethereum.publicnode.com'],
        blockExplorerUrls: ['https://etherscan.io'],
      };
    }
    return null;
  }

  private async tryAddChain(targetChainId: number): Promise<void> {
    const ethereum = typeof window !== 'undefined' ? (window as any)?.ethereum : null;
    if (!ethereum?.request) return;

    const addParams = this.getAddChainParams(targetChainId);
    if (!addParams) return;

    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [addParams],
    });
  }

  private async ensureWalletOnChain(targetChainId: number): Promise<void> {
    const currentChainId = this.resolveCurrentChainId();
    if (currentChainId === targetChainId) return;

    if (!this.switchChain) {
      throw new Error(
        `Wrong network (chainId ${currentChainId ?? 'unknown'}). Switch to ${this.getChainName(targetChainId)} (chainId ${targetChainId}) in your wallet and try again.`
      );
    }

    const waitForChainSync = async (): Promise<number | null> => {
      for (let i = 0; i < 8; i++) {
        const chainId = this.resolveCurrentChainId();
        if (chainId === targetChainId) return chainId;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return this.resolveCurrentChainId();
    };

    const switchFailedMessage = `Could not switch to ${this.getChainName(targetChainId)} automatically. Switch network in your wallet and try again.`;

    try {
      await this.switchChain(defineChain(targetChainId));
      const afterSwitchChainId = await waitForChainSync();
      if (afterSwitchChainId === targetChainId) return;
      throw new Error(
        `Wrong network (chainId ${afterSwitchChainId ?? 'unknown'}). Switch to ${this.getChainName(targetChainId)} (chainId ${targetChainId}) in your wallet and try again.`
      );
    } catch (error: any) {
      const message = String(error?.message || error || '');
      const code = Number(error?.code);

      if (code === 4001 || /user rejected|denied|rejected/i.test(message)) {
        throw new Error(`Network switch rejected. Please switch to ${this.getChainName(targetChainId)} and try again.`);
      }

      const chainNotAdded = code === 4902 || /4902|unrecognized chain|unknown chain|not added/i.test(message);
      if (chainNotAdded) {
        try {
          await this.tryAddChain(targetChainId);
          await this.switchChain(defineChain(targetChainId));
          const afterAddAndSwitchChainId = await waitForChainSync();
          if (afterAddAndSwitchChainId === targetChainId) return;
        } catch (addError: any) {
          const addMessage = String(addError?.message || addError || '');
          if (Number(addError?.code) === 4001 || /user rejected|denied|rejected/i.test(addMessage)) {
            throw new Error(`Network switch rejected. Please switch to ${this.getChainName(targetChainId)} and try again.`);
          }
        }
      }

      throw new Error(switchFailedMessage);
    }
  }

  async getTokens(): Promise<LendingToken[]> {
    const now = Date.now();
    const shared = getSharedTokensState(this.baseUrl);
    if (shared.tokens && (now - shared.fetchedAt) < this.CACHE_DURATION) {
      this.lendingDataCache = shared.tokens;
      this.lendingDataCacheTime = shared.fetchedAt;
      return shared.tokens;
    }

    if (shared.inFlight) {
      return shared.inFlight;
    }

    if (shared.cooldownUntil > now) {
      if (shared.tokens) return shared.tokens;
      const waitSeconds = Math.max(1, Math.ceil((shared.cooldownUntil - now) / 1000));
      throw new Error(`Failed to load lending markets. Rate limited by service. Try again in ${waitSeconds}s. URL: ${this.baseUrl}${API_ENDPOINTS.TOKENS}`);
    }

    const requestUrl = `${this.baseUrl}${API_ENDPOINTS.TOKENS}`;

    const run = (async (): Promise<LendingToken[]> => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        const controller = new AbortController();
        const timeoutMs = Math.max(5_000, LENDING_CONFIG.REQUEST_TIMEOUT ?? 10_000);
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(requestUrl, { signal: controller.signal });

        if (!response.ok) {
          const err = new Error(`HTTP error! status: ${response.status}`);
          (err as any).status = response.status;
          (err as any).retryAfterSeconds = extractRetryAfterSeconds(response);
          throw err;
        }

        const data = await response.json();

        let marketsArray: any[] | null = null;
        if (Array.isArray(data)) {
          marketsArray = data;
        } else if (data?.data?.markets && Array.isArray(data.data.markets)) {
          marketsArray = data.data.markets;
        } else if (data?.markets && Array.isArray(data.markets)) {
          marketsArray = data.markets;
        } else if (data?.data && Array.isArray(data.data)) {
          marketsArray = data.data;
        }

        if (!marketsArray) {
          throw new Error('Invalid API response: expected markets array');
        }

        const tokens: LendingToken[] = marketsArray.map((market: any) => {
          const supplyApyBps = Number(market?.supplyApyBps ?? 0);
          const borrowApyBps = Number(market?.borrowApyBps ?? 0);
          const collateralFactorBps = market?.collateralFactorBps != null ? Number(market.collateralFactorBps) : null;
          const underlyingSymbol = normalizeDisplaySymbol(market?.underlyingSymbol || market?.symbol || 'UNKNOWN');

          return {
            symbol: underlyingSymbol,
            address: market?.underlyingAddress || market?.address || '0x0000000000000000000000000000000000000000',
            qTokenAddress: market?.qTokenAddress || market?.qToken || market?.marketAddress || '',
            qTokenSymbol: market?.qTokenSymbol || market?.qToken?.symbol || '',
            icon: resolveLendingTokenIcon(underlyingSymbol, market?.symbol, market?.qTokenSymbol),
            decimals: Number(market?.underlyingDecimals ?? market?.decimals ?? 18),
            supplyAPY: Number.isFinite(supplyApyBps) ? supplyApyBps / 100 : 0,
            borrowAPY: Number.isFinite(borrowApyBps) ? borrowApyBps / 100 : 0,
            totalSupply: '0',
            totalBorrowed: '0',
            availableLiquidity: '0',
            collateralFactor: collateralFactorBps != null && Number.isFinite(collateralFactorBps)
              ? collateralFactorBps / 10000
              : 0,
            isCollateral: true,
          };
        }).filter((token) => !!token.qTokenAddress);

        const fetchedAt = Date.now();
        shared.tokens = tokens;
        shared.fetchedAt = fetchedAt;
        shared.cooldownUntil = 0;
        this.lendingDataCache = tokens;
        this.lendingDataCacheTime = fetchedAt;
        return tokens;
      } catch (error) {
        const maybeError = error as any;
        const status = typeof maybeError?.status === 'number' ? maybeError.status : undefined;
        const isAbort =
          error instanceof DOMException
            ? error.name === 'AbortError'
            : typeof maybeError?.name === 'string' && maybeError.name === 'AbortError';

        if (status === 429) {
          const retryAfterSeconds = Number.isFinite(maybeError?.retryAfterSeconds) && maybeError.retryAfterSeconds > 0
            ? Number(maybeError.retryAfterSeconds)
            : 30;
          shared.cooldownUntil = Date.now() + (retryAfterSeconds * 1000);
        }

        console.error('[LENDING] Error fetching lending markets:', {
          url: requestUrl,
          status,
          error,
          aborted: isAbort,
        });

        if (shared.tokens) return shared.tokens;
        if (this.lendingDataCache) return this.lendingDataCache;

        if (status === 429) {
          const retryAfterSeconds = Number.isFinite(maybeError?.retryAfterSeconds) && maybeError.retryAfterSeconds > 0
            ? Number(maybeError.retryAfterSeconds)
            : null;
          const retryHint = retryAfterSeconds ? ` Try again in ~${retryAfterSeconds}s.` : '';
          throw new Error(`Failed to load lending markets. Service rate-limited the request (429).${retryHint} URL: ${requestUrl}`);
        }
        if (isAbort) {
          throw new Error(`Failed to load lending markets (timeout). URL: ${requestUrl}`);
        }
        throw new Error(`Failed to load lending markets. ${error instanceof Error ? error.message : ''} URL: ${requestUrl}`);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    })();

    shared.inFlight = run.finally(() => {
      shared.inFlight = null;
    });
    return shared.inFlight;
  }

  /**
   * Fetch current tax rate from the validation contract and update VALIDATION_FEE.
   * Call this once on mount to ensure the displayed fee matches the on-chain value.
   */
  async fetchValidationInfo(): Promise<{ taxRate: number }> {
    try {
      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.VALIDATION_INFO}`);
      if (!response.ok) {
        console.warn('[LENDING] Failed to fetch validation info, using defaults');
        return { taxRate: VALIDATION_FEE.PERCENTAGE };
      }
      const data = await response.json();
      const taxRate = parseInt(data?.data?.taxRate ?? data?.taxRate ?? '10', 10);
      updateValidationFee(taxRate);
      return { taxRate };
    } catch (error) {
      console.warn('[LENDING] Error fetching validation info:', error);
      return { taxRate: VALIDATION_FEE.PERCENTAGE };
    }
  }

  async getUserPosition(): Promise<LendingAccountPositionsResponse | null> {
    if (!this.account?.address) return null;

    const userAddress = this.getConnectedWalletAddress();
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      throw new Error('Authentication required to fetch lending positions. Please login again.');
    }
    const headers: Record<string, string> = {};
    headers['Authorization'] = `Bearer ${authToken}`;

    const response = await fetchWithAuth(`${this.baseUrl}${API_ENDPOINTS.POSITION}/${userAddress}/positions`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const backendMessage = await this.readBackendErrorMessage(response);
      if (response.status === 429 || /rate-limited|rate limited/i.test(backendMessage)) {
        throw new Error('Lending RPC is busy right now. Try again in a few seconds.');
      }
      throw new Error(`HTTP error! status: ${response.status}. ${backendMessage}`);
    }

    const data = await response.json();
    return data?.data || null;
  }

  async calculateTax(amount: string, decimals: number = 18): Promise<ValidationResponse> {
    try {
      const amountInWei = this.toWei(amount, decimals);
      const message = this.formatMessage('Calculate tax for amount', amountInWei);
      const authData = await this.getAuthData(message);

      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetchWithAuth(`${this.baseUrl}${API_ENDPOINTS.CALCULATE_TAX}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...authData,
          amount: amountInWei
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Error calculating tax:', error);
      throw new Error('Failed to calculate tax');
    }
  }

  async prepareSupply(tokenAddress: string, amount: string, decimals: number = 18): Promise<any> {
    try {
      const amountInWei = this.toWei(amount, decimals);
      const message = this.formatMessage('Validate and supply', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);

      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetchWithAuth(`${this.baseUrl}${API_ENDPOINTS.PREPARE_SUPPLY}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        const backendMessage = await this.readBackendErrorMessage(response);
        console.error('[LENDING] Error preparing supply:', response.status, backendMessage);
        throw new Error(this.formatPrepareError('Supply', response.status, backendMessage));
      }

      return await response.json();
    } catch (error) {
      console.error('[LENDING] Error preparing supply:', error);
      throw new Error('Failed to prepare supply transaction: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async prepareWithdraw(tokenAddress: string, amount: string, decimals: number = 18): Promise<any> {
    try {
      const amountInWei = this.toWei(amount, decimals);
      const message = this.formatMessage('Withdraw', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);

      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetchWithAuth(`${this.baseUrl}${API_ENDPOINTS.PREPARE_WITHDRAW}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        const backendMessage = await this.readBackendErrorMessage(response);
        console.error('[LENDING] Error preparing withdraw:', response.status, backendMessage);
        throw new Error(this.formatPrepareError('Withdraw', response.status, backendMessage));
      }

      return await response.json();
    } catch (error) {
      console.error('[LENDING] Error preparing withdraw:', error);
      throw new Error('Failed to prepare withdraw transaction');
    }
  }

  async prepareBorrow(tokenAddress: string, amount: string, decimals: number = 18): Promise<any> {
    try {
      const amountInWei = this.toWei(amount, decimals);
      const message = this.formatMessage('Validate and borrow', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);

      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetchWithAuth(`${this.baseUrl}${API_ENDPOINTS.PREPARE_BORROW}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        const backendMessage = await this.readBackendErrorMessage(response);
        console.error('[LENDING] Error preparing borrow:', response.status, backendMessage);
        throw new Error(this.formatPrepareError('Borrow', response.status, backendMessage));
      }

      return await response.json();
    } catch (error) {
      console.error('[LENDING] Error preparing borrow:', error);
      throw new Error('Failed to prepare borrow transaction');
    }
  }

  async prepareRepay(tokenAddress: string, amount: string, decimals: number = 18): Promise<any> {
    try {
      const amountInWei = this.toWei(amount, decimals);
      const message = this.formatMessage('Repay', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);

      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetchWithAuth(`${this.baseUrl}${API_ENDPOINTS.PREPARE_REPAY}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        const backendMessage = await this.readBackendErrorMessage(response);
        console.error('[LENDING] Error preparing repay:', response.status, backendMessage);
        throw new Error(this.formatPrepareError('Repay', response.status, backendMessage));
      }

      return await response.json();
    } catch (error) {
      console.error('[LENDING] Error preparing repay:', error);
      throw new Error('Failed to prepare repay transaction');
    }
  }

  async executeTransaction(txData: any): Promise<string> {
    try {
      if (!this.account) {
        throw new Error('Please connect your wallet to execute blockchain transactions.');
      }
      this.assertWalletCompatibility();

      const toAddress = txData.to;
      const value = txData.value;
      const data = txData.data;
      const gas = txData.gasLimit || txData.gas;
      const gasPrice = txData.gasPrice;
      const chainId = txData.chainId;

      if (!toAddress || !data) {
        throw new Error(`Invalid transaction data: missing to address or data`);
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
        throw new Error(`Invalid to address: ${toAddress}`);
      }

      const targetChainId = Number(chainId || LENDING_CONFIG.DEFAULT_CHAIN_ID);
      if (!Number.isFinite(targetChainId) || targetChainId <= 0) {
        throw new Error(`Invalid chain ID for lending transaction: ${chainId}`);
      }

      await this.ensureWalletOnChain(targetChainId);

      const toHex = (input?: string | number | bigint) => {
        if (input === undefined || input === null || input === '') return undefined;
        if (typeof input === 'bigint') return `0x${input.toString(16)}`;
        if (typeof input === 'number') return `0x${BigInt(Math.trunc(input)).toString(16)}`;
        if (typeof input === 'string') {
          const trimmed = input.trim();
          if (!trimmed) return undefined;
          if (trimmed.startsWith('0x')) return trimmed;
          return `0x${BigInt(trimmed).toString(16)}`;
        }
        return undefined;
      };

      const formattedTxData: Record<string, any> = {
        to: toAddress,
        data: data,
        value: toHex(value) ?? '0x0',
      };

      const gasHex = toHex(gas);
      if (gasHex) {
        formattedTxData.gas = gasHex;
      }

      const gasPriceHex = toHex(gasPrice);
      if (gasPriceHex && gasPriceHex !== '0x0') {
        formattedTxData.gasPrice = gasPriceHex;
      }

      formattedTxData.chainId = targetChainId;

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
          candidate?.result?.transactionHash,
          candidate?.txHash,
        ];
        for (const s of maybeStrings) {
          if (typeof s === 'string' && /^0x[a-fA-F0-9]{64}$/.test(s)) return s;
        }
        return null;
      };

      const result = await safeExecuteTransactionV2(async () => {
        const sent = await this.account.sendTransaction(formattedTxData);
        const hash = extractTxHash(sent);
        if (!hash) {
          console.error('❌ No transaction hash in response:', sent);
          throw new Error('No transaction hash received from wallet.');
        }
        return { transactionHash: hash };
      });

      if (!result.success || !result.transactionHash) {
        throw new Error(result.error || 'Transaction failed');
      }

      return result.transactionHash;
    } catch (error) {
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
            anyErr?.reason ||
            anyErr?.data?.message ||
            anyErr?.response?.data?.message;
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
          } catch {}
          return String(anyErr);
        }
        return 'Unknown error';
      };

      const msg = describeUnknown(error);
      console.error('[LENDING] Transaction failed:', { message: msg, raw: error });
      throw new Error(`Transaction failed: ${msg}`);
    }
  }

  async getSupplyQuote(tokenAddress: string, amount: string, decimals: number = 18): Promise<any> {
    try {
      const amountInWei = this.toWei(amount, decimals);
      const message = this.formatMessage('Get validation and supply quote for', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);

      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetchWithAuth(`${this.baseUrl}${API_ENDPOINTS.SUPPLY_QUOTE}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[LENDING] Error getting supply quote:', error);
      throw new Error('Failed to get supply quote');
    }
  }

  async getBorrowQuote(tokenAddress: string, amount: string, decimals: number = 18): Promise<any> {
    try {
      const amountInWei = this.toWei(amount, decimals);
      const message = this.formatMessage('Get validation and borrow quote for', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);

      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetchWithAuth(`${this.baseUrl}${API_ENDPOINTS.BORROW_QUOTE}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[LENDING] Error getting borrow quote:', error);
      throw new Error('Failed to get borrow quote');
    }
  }

  clearLendingDataCache(): void {
    this.lendingDataCache = null;
    this.lendingDataCacheTime = 0;
    const shared = getSharedTokensState(this.baseUrl);
    shared.tokens = null;
    shared.fetchedAt = 0;
    shared.cooldownUntil = 0;
  }

  getCacheStatus(): CacheStatus {
    const now = Date.now();
    const cacheAge = this.lendingDataCacheTime ? now - this.lendingDataCacheTime : 0;
    const isExpired = cacheAge > this.CACHE_DURATION;
    
    return {
      hasCache: !!this.lendingDataCache,
      cacheAge,
      isExpired
    };
  }

  private calculateAPY(rate: number): number {
    return rate * 100;
  }

  /**
   * Fetch lending transaction history for the connected wallet.
   */
  async getTransactionHistory(limit = 50): Promise<any[]> {
    const address = this.getConnectedWalletAddress();
    try {
      const response = await fetchWithAuth(
        `${this.baseUrl}${API_ENDPOINTS.HISTORY}/${address}/history?limit=${limit}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      );
      if (!response.ok) return [];
      const data = await response.json();
      return data?.data?.transactions || [];
    } catch {
      return [];
    }
  }

  /**
   * Fetch daily position snapshots for portfolio tracking.
   */
  async getPositionSnapshots(days = 30): Promise<any[]> {
    const address = this.getConnectedWalletAddress();
    try {
      const response = await fetchWithAuth(
        `${this.baseUrl}${API_ENDPOINTS.SNAPSHOTS}/${address}/snapshots?days=${days}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      );
      if (!response.ok) return [];
      const data = await response.json();
      return data?.data?.snapshots || [];
    } catch {
      return [];
    }
  }
}

export const useLendingApi = () => {
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  return useMemo(
    () => new LendingApiClient(account, activeWallet, activeChain?.id ?? null, switchChain),
    [account, activeWallet, activeChain?.id, switchChain]
  );
};

export default LendingApiClient;
