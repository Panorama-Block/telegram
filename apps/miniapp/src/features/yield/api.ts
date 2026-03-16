'use client';

import { useMemo } from 'react';
import { useActiveAccount, useActiveWallet, useSwitchActiveWalletChain } from 'thirdweb/react';
import { defineChain } from 'thirdweb';
import { safeExecuteTransactionV2 } from '@/shared/utils/transactionUtilsV2';
import { fetchWithAuth } from '@/shared/lib/fetchWithAuth';
import { BASE_CHAIN_ID, API_ENDPOINTS } from './config';
import type {
  YieldPool,
  PoolProtocolInfo,
  UserPosition,
  Portfolio,
  YieldPrepareResponse,
  PreparedTransaction,
  TransactionExecutionStatus,
} from './types';

type SwitchChainFn = (chain: ReturnType<typeof defineChain>) => Promise<void>;

// ── Deduplication for in-flight tx execution ──

const inFlightByKey = new Map<string, Promise<TransactionExecutionStatus>>();

function normalizeHex(value: unknown): string {
  if (typeof value === 'bigint') return `0x${value.toString(16)}`;
  if (typeof value === 'number') return `0x${BigInt(Math.trunc(value)).toString(16)}`;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '0x0';
    if (trimmed.startsWith('0x')) return trimmed.toLowerCase();
    try { return `0x${BigInt(trimmed).toString(16)}`; } catch { return trimmed.toLowerCase(); }
  }
  return '0x0';
}

function buildExecutionKey(tx: { chainId: number; to: string; data: string; value: unknown }): string {
  return [tx.chainId, tx.to.toLowerCase(), tx.data.toLowerCase(), normalizeHex(tx.value)].join('|');
}

function requestWithTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
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
}

// ── API Client ──

class YieldApiClient {
  private baseUrl: string;
  private account: any;
  private activeWallet: any;
  private switchChain: SwitchChainFn | null;

  constructor(account: any, switchChain?: SwitchChainFn, activeWallet?: any) {
    this.switchChain = switchChain || null;
    this.account = account;
    this.activeWallet = activeWallet;

    const direct = process.env.NEXT_PUBLIC_YIELD_API_URL || process.env.VITE_YIELD_API_URL;

    if (direct && direct.length > 0) {
      this.baseUrl = direct.replace(/\/+$/, '');
    } else {
      // Always use the Next.js rewrite proxy to avoid CORS issues.
      this.baseUrl = '/api/yield';
    }
  }

  private parseHexChainId(chainHex: unknown): number | null {
    if (typeof chainHex !== 'string') return null;
    if (!/^0x[0-9a-fA-F]+$/.test(chainHex)) return null;
    const parsed = Number.parseInt(chainHex, 16);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private getPreferredInjectedProviderId(): string {
    const id =
      this.activeWallet?.id ||
      this.activeWallet?.walletId ||
      this.account?.walletId ||
      this.account?.wallet?.id ||
      '';
    return typeof id === 'string' ? id.toLowerCase() : '';
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
        } catch {
          // ignore and continue searching
        }
      }
    }

    const preferredProvider = candidates.find((provider: any) =>
      this.providerMatchesPreferredWallet(provider, preferredWalletId),
    );
    if (preferredProvider) return preferredProvider;

    return candidates[0] ?? null;
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

  private extractTxHash(value: unknown): string | null {
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

    for (const str of maybeStrings) {
      if (typeof str === 'string' && /^0x[a-fA-F0-9]{64}$/.test(str)) return str;
    }
    return null;
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
        const chainId = this.parseHexChainId(chainHex);
        if (chainId != null && chainId !== expectedChainId) {
          return null;
        }

        const latestHex = await provider.request({ method: 'eth_blockNumber' });
        const latest = this.parseHexChainId(latestHex);
        if (latest == null) break;

        for (let offset = 0; offset <= lookbackBlocks; offset += 1) {
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
        // ignore and retry
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    return null;
  }

  private async fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetchWithAuth(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let details = body;
      try {
        const parsed = JSON.parse(body);
        details = parsed?.error?.message || parsed?.message || body;
      } catch {
        // keep raw body
      }
      throw new Error(`Yield API error ${res.status}: ${details || res.statusText || 'Request failed'}`);
    }
    return res.json();
  }

  // ── Data Fetching ──

  async getPools(): Promise<YieldPool[]> {
    const data = await this.fetchJson<{ pools: YieldPool[] }>(API_ENDPOINTS.POOLS);
    return data.pools;
  }

  async getProtocolInfo(): Promise<{ pools: PoolProtocolInfo[]; updatedAt: string }> {
    return this.fetchJson(API_ENDPOINTS.PROTOCOL_INFO);
  }

  async getPosition(userAddress: string): Promise<UserPosition[]> {
    const data = await this.fetchJson<{ positions: UserPosition[] }>(
      `${API_ENDPOINTS.POSITION}/${userAddress}`,
    );
    return data.positions;
  }

  async getPortfolio(userAddress: string): Promise<Portfolio> {
    return this.fetchJson<Portfolio>(`${API_ENDPOINTS.PORTFOLIO}/${userAddress}`);
  }

  // ── Transaction Preparation ──

  async prepareEnter(params: {
    userAddress: string;
    poolId: string;
    amountA: string;
    amountB: string;
    slippageBps?: number;
  }): Promise<YieldPrepareResponse> {
    return this.fetchJson<YieldPrepareResponse>(API_ENDPOINTS.PREPARE_ENTER, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async prepareExit(params: {
    userAddress: string;
    poolId: string;
    amount?: string;
  }): Promise<YieldPrepareResponse> {
    return this.fetchJson<YieldPrepareResponse>(API_ENDPOINTS.PREPARE_EXIT, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async prepareClaim(params: {
    userAddress: string;
    poolId: string;
  }): Promise<YieldPrepareResponse> {
    return this.fetchJson<YieldPrepareResponse>(API_ENDPOINTS.PREPARE_CLAIM, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // ── Transaction Tracking ──

  async submitTransaction(txHash: string, userAddress: string, action?: string): Promise<void> {
    await this.fetchJson(API_ENDPOINTS.TRANSACTION_SUBMIT, {
      method: 'POST',
      body: JSON.stringify({ txHash, userAddress, action }),
    });
  }

  async getTransactionStatus(txHash: string): Promise<{ status: string }> {
    return this.fetchJson(`${API_ENDPOINTS.TRANSACTION_STATUS}/${txHash}`);
  }

  // ── Transaction Execution ──

  async executeTransaction(tx: PreparedTransaction): Promise<TransactionExecutionStatus> {
    const key = buildExecutionKey(tx);
    const existing = inFlightByKey.get(key);
    if (existing) return existing;

    const promise = this._doExecute(tx);
    inFlightByKey.set(key, promise);
    try {
      return await promise;
    } finally {
      inFlightByKey.delete(key);
    }
  }

  private async _doExecute(tx: PreparedTransaction): Promise<TransactionExecutionStatus> {
    if (!this.account?.address) {
      throw new Error('Wallet not connected');
    }

    if (this.switchChain) {
      try {
        await this.switchChain(defineChain(tx.chainId || BASE_CHAIN_ID));
      } catch {
        // ignore if already on chain
      }
    }

    if (!this.account.sendTransaction) {
      throw new Error('Wallet does not support sendTransaction');
    }

    const targetChainId = Number(tx.chainId || BASE_CHAIN_ID);
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
      to: tx.to,
      data: tx.data,
      value: toHex(tx.value) ?? '0x0',
      chainId: targetChainId,
    };

    const executionAttempt = safeExecuteTransactionV2(async () => {
      const selectedProvider = await this.resolveInjectedProvider(this.account?.address);
      const recoverHashFromWallet = async (options?: { timeoutMs?: number; lookbackBlocks?: number }) => {
        return await this.recoverRecentTxHashByPayload({
          provider: selectedProvider,
          expectedChainId: targetChainId,
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
      ): Promise<{ transactionHash: string; source: 'wallet' | 'recovered' }> => {
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
          return { transactionHash: raceResult.hash, source: 'recovered' };
        }

        const directHash = this.extractTxHash(raceResult.value);
        if (directHash) {
          return { transactionHash: directHash, source: 'wallet' };
        }

        const recoveredAfterSend = await recoverHashFromWallet({
          timeoutMs: 8_000,
          lookbackBlocks: 24,
        });
        if (recoveredAfterSend) {
          return { transactionHash: recoveredAfterSend, source: 'recovered' };
        }

        throw new Error('Wallet submitted transaction without a hash.');
      };

      try {
        return await raceBroadcastWithRecovery(() =>
          Promise.resolve(this.account.sendTransaction(formattedTxData)),
        );
      } catch (accountSendError) {
        const recoveredAccountHash = await recoverHashFromWallet();
        if (recoveredAccountHash) {
          return { transactionHash: recoveredAccountHash, source: 'recovered' };
        }
        throw accountSendError;
      }
    });

    let result: Awaited<ReturnType<typeof safeExecuteTransactionV2>>;
    try {
      result = await requestWithTimeout(
        executionAttempt,
        70_000,
        'Wallet confirmation',
      );
    } catch (executionError) {
      const timeoutMessage = executionError instanceof Error ? executionError.message : 'Transaction timed out';
      const isTimeout = /timed out/i.test(timeoutMessage);
      if (!isTimeout) {
        throw executionError;
      }

      const recoveryProvider = await this.resolveInjectedProvider(this.account?.address);
      const recoveredHash = await this.recoverRecentTxHashByPayload({
        provider: recoveryProvider,
        expectedChainId: targetChainId,
        from: this.account.address,
        to: formattedTxData.to,
        data: formattedTxData.data,
        timeoutMs: 15_000,
        lookbackBlocks: 48,
      });
      if (recoveredHash) {
        console.warn('[YIELD] Wallet confirmation timed out, but tx hash was recovered:', recoveredHash);
        return { transactionHash: recoveredHash, confirmed: false, source: 'recovered' };
      }

      throw new Error(
        `${timeoutMessage}. If you already approved in wallet, check explorer and then press "Try again".`,
      );
    } finally {
      void executionAttempt.catch(() => {});
    }

    if (!result.success || !result.transactionHash) {
      throw new Error(result.error || 'Transaction failed');
    }

    return {
      transactionHash: result.transactionHash,
      confirmed: false,
      source: result.source,
    };
  }

  async executeTransactions(
    transactions: PreparedTransaction[],
    onStep?: (index: number, total: number, description: string) => void,
  ): Promise<TransactionExecutionStatus[]> {
    const results: TransactionExecutionStatus[] = [];
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      onStep?.(i, transactions.length, tx.description || `Step ${i + 1}`);
      const result = await this.executeTransaction(tx);
      results.push(result);
    }
    return results;
  }
}

// ── React Hook ──

export function useYieldApi() {
  const account = useActiveAccount();
  const switchChain = useSwitchActiveWalletChain();
  const activeWallet = useActiveWallet();

  return useMemo(
    () => new YieldApiClient(account, switchChain, activeWallet),
    [account, switchChain, activeWallet],
  );
}

export { YieldApiClient };
