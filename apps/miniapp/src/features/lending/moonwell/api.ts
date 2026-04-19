'use client';

/**
 * Moonwell (Base) Lending API Client
 *
 * Standalone client for Moonwell Finance on Base (chainId 8453).
 * Mirrors the shape of LendingApiClient so that MoonwellLending.tsx can
 * consume it with minimal changes relative to the Benqi component.
 *
 * Routing:
 *   GET  /api/lending/moonwell/markets                    → markets list
 *   GET  /api/lending/moonwell/account/:addr/positions    → user positions
 *   POST /api/lending/moonwell/validateAndSupply          → prepare supply
 *   POST /api/lending/moonwell/validateAndWithdraw        → prepare redeem
 *   POST /api/lending/moonwell/validateAndBorrow          → prepare borrow
 *   POST /api/lending/moonwell/validateAndRepay           → prepare repay
 *
 * The lending-service proxy (panorama-block-backend) exposes these at /moonwell/*
 * and the Next.js /api/lending/:path* rewrite forwards them to the service.
 */

import { useMemo } from 'react';
import { useActiveAccount, useActiveWallet, useActiveWalletChain, useSwitchActiveWalletChain } from 'thirdweb/react';
import { defineChain } from 'thirdweb';
import { safeExecuteTransactionV2 } from '@/shared/utils/transactionUtilsV2';
import { parseAmountToWei } from '@/features/swap/utils';
import type { LendingToken, LendingAccountPositionsResponse } from '@/features/lending/types';
import { TOKEN_ICONS } from '@/features/lending/config';

// ─── Constants ────────────────────────────────────────────────────────────────

const MOONWELL_CHAIN_ID = 8453;
const BASE_EXPLORER    = 'https://basescan.org/tx/';

/**
 * Moonwell Base uses per-second interest rates (timestamp-based accrual).
 * Seconds per year = 365.25 * 24 * 3600 = 31_557_600.
 * APY ≈ (ratePerSecond / 1e18) * secondsPerYear * 100  (linear approximation).
 */
const BASE_SECONDS_PER_YEAR = 31_557_600;

/** Cache TTL: 5 minutes */
const CACHE_DURATION_MS = 5 * 60 * 1000;

// ─── Module-level token cache (shared across all hook instances) ──────────────

type TokensCache = {
  tokens: LendingToken[] | null;
  fetchedAt: number;
  inFlight: Promise<LendingToken[]> | null;
};

const tokensCache: TokensCache = { tokens: null, fetchedAt: 0, inFlight: null };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rateToApy(ratePerSecond: string | number): number {
  const rate = typeof ratePerSecond === 'string' ? parseFloat(ratePerSecond) : ratePerSecond;
  if (!rate || !Number.isFinite(rate)) return 0;
  // Linear approximation: (ratePerSecond / 1e18) * secondsPerYear * 100
  return (rate / 1e18) * BASE_SECONDS_PER_YEAR * 100;
}

function resolveTokenIcon(symbol: string | undefined | null): string | undefined {
  if (!symbol) return undefined;
  const s = symbol.trim();
  return TOKEN_ICONS[s] ?? TOKEN_ICONS[s.toUpperCase()] ?? undefined;
}

function normalizeHex(value: unknown): string {
  if (typeof value === 'bigint') return `0x${value.toString(16)}`;
  if (typeof value === 'number') return `0x${BigInt(Math.trunc(value)).toString(16)}`;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t || t === '0') return '0x0';
    return t.startsWith('0x') ? t : `0x${BigInt(t).toString(16)}`;
  }
  return '0x0';
}

function bundleFromLegacyResponse(data: Record<string, any>, actionKey: string) {
  // The lending-service returns { status, data: { approve?, supply/redeem/borrow/repay } }
  // Re-pack it as { bundle: { steps: [...] } } so MoonwellLending.tsx can use the bundle path.
  const steps: any[] = [];
  if (data?.approve) steps.push(data.approve);
  const actionTx = data?.[actionKey];
  if (actionTx) steps.push(actionTx);
  return { bundle: { steps, totalSteps: steps.length, summary: actionKey } };
}

// ─── MoonwellLendingApiClient ─────────────────────────────────────────────────

export interface MoonwellTransactionStatus {
  transactionHash: string;
  confirmed: boolean;
}

class MoonwellLendingApiClient {
  private readonly baseUrl: string;
  private readonly account: any;
  private readonly activeWallet: any;
  private readonly activeChainId: number | null;
  private readonly switchChain: ((chain: ReturnType<typeof defineChain>) => Promise<void>) | null;

  constructor(
    account: any,
    activeWallet?: any,
    activeChainId?: number | null,
    switchChain?: ((chain: ReturnType<typeof defineChain>) => Promise<void>) | null,
  ) {
    this.account      = account ?? null;
    this.activeWallet = activeWallet ?? null;
    this.activeChainId = activeChainId ?? null;
    this.switchChain  = switchChain ?? null;

    const isBrowser = typeof window !== 'undefined';
    const isDev = process.env.NODE_ENV === 'development';
    const isLocalHost = isBrowser && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );

    // Same resolution logic as LendingApiClient
    if (!isBrowser) {
      const direct = process.env.VITE_LENDING_API_BASE || process.env.NEXT_PUBLIC_LENDING_API_URL;
      this.baseUrl = (direct || 'http://localhost:3007').replace(/\/+$/, '');
    } else if (isDev && isLocalHost) {
      this.baseUrl = 'http://localhost:3007';
    } else {
      this.baseUrl = '/api/lending';
    }
  }

  // ── Token cache helpers ────────────────────────────────────────────────────

  private resolveCurrentChainId(): number | null {
    const eth = typeof window !== 'undefined' ? (window as any)?.ethereum : null;
    const hex = typeof eth?.chainId === 'string' ? eth.chainId : null;
    if (hex && /^0x[0-9a-fA-F]+$/.test(hex)) {
      const n = parseInt(hex, 16);
      if (Number.isFinite(n)) return n;
    }
    return this.activeChainId ?? null;
  }

  private async ensureBaseChain(): Promise<void> {
    const current = this.resolveCurrentChainId();
    if (current === MOONWELL_CHAIN_ID) return;

    if (!this.switchChain) {
      throw new Error('Wrong network. Switch to Base (chainId 8453) in your wallet and try again.');
    }

    try {
      await this.switchChain(defineChain(MOONWELL_CHAIN_ID));
      // Wait up to 1.6s for the chain to sync
      for (let i = 0; i < 8; i++) {
        if (this.resolveCurrentChainId() === MOONWELL_CHAIN_ID) return;
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      const code = Number(e?.code);
      // 4902 = chain not added — try wallet_addEthereumChain
      if (code === 4902 || /4902|unrecognized chain|unknown chain/i.test(msg)) {
        const eth = (window as any)?.ethereum;
        if (eth?.request) {
          try {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2105',
                chainName: 'Base',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org'],
              }],
            });
            await this.switchChain(defineChain(MOONWELL_CHAIN_ID));
            return;
          } catch {}
        }
      }
      if (code === 4001 || /user rejected|denied/i.test(msg)) {
        throw new Error('Network switch rejected. Please switch to Base and try again.');
      }
      throw new Error('Could not switch to Base. Switch network in your wallet and try again.');
    }
  }

  private connectedAddress(): string {
    const addr = this.account?.address;
    if (!addr) throw new Error('Please connect your wallet to use Lending.');
    return addr;
  }

  private async readError(res: Response): Promise<string> {
    const text = await res.text().catch(() => '');
    try {
      const j = JSON.parse(text);
      const msg = j?.data?.error || j?.error || j?.message;
      if (typeof msg === 'string' && msg.trim()) return msg.trim().slice(0, 220);
    } catch {}
    return text.slice(0, 220) || `HTTP ${res.status}`;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async getTokens(): Promise<LendingToken[]> {
    const now = Date.now();
    // Only use cache if it has actual data (empty array = previous failed fetch, don't cache)
    if (tokensCache.tokens && tokensCache.tokens.length > 0 && now - tokensCache.fetchedAt < CACHE_DURATION_MS) {
      return tokensCache.tokens;
    }
    if (tokensCache.inFlight) return tokensCache.inFlight;

    const run = (async (): Promise<LendingToken[]> => {
      const res = await fetch(`${this.baseUrl}/moonwell/markets`);
      if (!res.ok) throw new Error(`Moonwell markets: HTTP ${res.status}`);
      const data = await res.json();
      const raw: any[] = data?.markets ?? (Array.isArray(data) ? data : []);

      const tokens: LendingToken[] = raw
        .filter((m) => m?.mTokenAddress)
        .map((m) => ({
          symbol:           m.underlyingSymbol ?? 'UNKNOWN',
          address:          m.underlyingAddress ?? '0x0000000000000000000000000000000000000000',
          // Normalize mToken → qToken for compatibility with Lending component internals
          qTokenAddress:    m.mTokenAddress,
          qTokenSymbol:     m.mTokenSymbol ?? `m${m.underlyingSymbol ?? ''}`,
          icon:             resolveTokenIcon(m.underlyingSymbol) ?? resolveTokenIcon(m.mTokenSymbol),
          decimals:         Number(m.underlyingDecimals ?? 18),
          supplyAPY:        rateToApy(m.supplyRatePerTimestamp ?? m.supplyRatePerBlock ?? 0),
          borrowAPY:        rateToApy(m.borrowRatePerTimestamp ?? m.borrowRatePerBlock ?? 0),
          totalSupply:      '0',
          totalBorrowed:    '0',
          availableLiquidity: '0',
          collateralFactor: 0,
          isCollateral:     true,
        }));

      tokensCache.tokens   = tokens;
      tokensCache.fetchedAt = Date.now();
      return tokens;
    })().finally(() => { tokensCache.inFlight = null; });

    tokensCache.inFlight = run;
    return run;
  }

  async getUserPosition(): Promise<LendingAccountPositionsResponse | null> {
    const address = this.connectedAddress();

    const res = await fetch(`${this.baseUrl}/moonwell/account/${address}/positions`);
    if (!res.ok) {
      const msg = await this.readError(res);
      throw new Error(`Moonwell positions: ${msg}`);
    }
    const json = await res.json();
    const inner = json?.data ?? json;
    if (!inner) return null;

    // Normalize mToken* fields → qToken* for compatibility with Lending.tsx position lookup
    const positions = (inner.positions ?? []).map((p: any) => ({
      ...p,
      qTokenAddress:    p.mTokenAddress   ?? p.qTokenAddress   ?? '',
      qTokenSymbol:     p.mTokenSymbol    ?? p.qTokenSymbol    ?? '',
      qTokenDecimals:   p.mTokenDecimals  ?? p.qTokenDecimals  ?? 8,
      qTokenBalanceWei: p.mTokenBalanceWei ?? p.mTokenBalance  ?? p.qTokenBalanceWei ?? '0',
    }));

    return {
      accountAddress: inner.accountAddress ?? address,
      liquidity: inner.liquidity ?? {
        accountAddress: address, liquidity: '0', shortfall: '0', isHealthy: true,
      },
      positions,
      updatedAt: inner.updatedAt ?? Date.now(),
      warnings: inner.warnings,
    };
  }

  /** No validation fee for Moonwell — return default. */
  async fetchValidationInfo(): Promise<{ taxRate: number }> {
    return { taxRate: 0 };
  }

  async prepareSupply(mTokenAddress: string, amount: string, decimals = 18): Promise<any> {
    const userAddress = this.connectedAddress();
    const amountWei = parseAmountToWei(amount, decimals).toString();

    const res = await fetch(`${this.baseUrl}/moonwell/validateAndSupply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: userAddress, amount: amountWei, mTokenAddress }),
    });
    if (!res.ok) throw new Error(`Supply failed (${res.status}): ${await this.readError(res)}`);
    const json = await res.json();
    return bundleFromLegacyResponse(json?.data, 'supply');
  }

  async prepareWithdraw(
    mTokenAddress: string,
    amount: string,
    decimals = 18,
    mTokenAmountOverride?: string,
  ): Promise<any> {
    const userAddress = this.connectedAddress();
    // mTokenAmountOverride is the raw mToken amount (8 decimals) — use it when provided,
    // otherwise send the underlying wei and let the backend figure it out.
    const amountToSend = mTokenAmountOverride ?? parseAmountToWei(amount, decimals).toString();

    const res = await fetch(`${this.baseUrl}/moonwell/validateAndWithdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: userAddress, amount: amountToSend, mTokenAddress }),
    });
    if (!res.ok) throw new Error(`Withdraw failed (${res.status}): ${await this.readError(res)}`);
    const json = await res.json();
    return bundleFromLegacyResponse(json?.data, 'redeem');
  }

  async prepareBorrow(mTokenAddress: string, amount: string, decimals = 18): Promise<any> {
    const userAddress = this.connectedAddress();
    const amountWei = parseAmountToWei(amount, decimals).toString();

    const res = await fetch(`${this.baseUrl}/moonwell/validateAndBorrow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: userAddress, amount: amountWei, mTokenAddress }),
    });
    if (!res.ok) throw new Error(`Borrow failed (${res.status}): ${await this.readError(res)}`);
    const json = await res.json();
    return bundleFromLegacyResponse(json?.data, 'borrow');
  }

  async prepareRepay(mTokenAddress: string, amount: string, decimals = 18): Promise<any> {
    const userAddress = this.connectedAddress();
    const amountWei = parseAmountToWei(amount, decimals).toString();

    const res = await fetch(`${this.baseUrl}/moonwell/validateAndRepay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: userAddress, amount: amountWei, mTokenAddress }),
    });
    if (!res.ok) throw new Error(`Repay failed (${res.status}): ${await this.readError(res)}`);
    const json = await res.json();
    return bundleFromLegacyResponse(json?.data, 'repay');
  }

  /**
   * Step 1 of the permit flow.
   * Returns the EIP-712 typed data to sign + the pre-encoded execute calldata.
   * permitMessage is null when the token does not support EIP-2612 — caller should
   * fall back to the standard two-step approve flow via prepareSupply().
   */
  async prepareSupplyWithPermit(mTokenAddress: string, amount: string, decimals = 18): Promise<{
    permitMessage: any | null;
    executeCalldata: string;
    permitTarget: string;
    executorAddress: string;
    /** Predicted adapter proxy — passed through to finalizeSupplyPermit for the transferFrom step. */
    adapterProxy: string;
    /** Token amount in wei — passed through to finalizeSupplyPermit. */
    amount: string;
    chainId: number;
    metadata: any;
  } | null> {
    const userAddress = this.connectedAddress();
    const amountWei = parseAmountToWei(amount, decimals).toString();

    const res = await fetch(`${this.baseUrl}/moonwell/prepareSupplyWithPermit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: userAddress, amount: amountWei, mTokenAddress }),
    });
    if (!res.ok) return null; // graceful fallback to approve flow
    const json = await res.json();
    return json?.data ?? null;
  }

  /**
   * Signs an EIP-712 permit message.
   * Strategy (in order):
   *   1. Thirdweb account.signTypedData — works in Telegram Mini App and all Thirdweb wallets.
   *   2. window.ethereum eth_signTypedData_v4 — fallback for injected MetaMask in browser.
   * Returns null if both fail (caller falls back to the two-step approve flow).
   */
  async signPermitMessage(permitMessage: any): Promise<string | null> {
    const isValidSig = (s: unknown): s is string =>
      typeof s === 'string' && /^0x[a-fA-F0-9]{130}$/.test(s);

    // EIP-712 domain contains chainId:8453. MetaMask rejects signTypedData if the wallet
    // is on a different chain (e.g. Avalanche 43114). Switch to Base before signing.
    try {
      await this.ensureBaseChain();
      console.log('[signPermitMessage] Chain confirmed: Base (8453)');
    } catch (err) {
      console.error('[signPermitMessage] Failed to switch to Base before signing:', err instanceof Error ? err.message : String(err));
      // If chain switch fails, signing will also fail — return null to fall through to approve flow.
      return null;
    }

    const accountAddr = this.account?.address ?? 'none';
    const hasSignTypedData = this.account && typeof (this.account as any).signTypedData === 'function';
    const eth = typeof window !== 'undefined' ? (window as Window & { ethereum?: any }).ethereum : null;
    const ethProviders: any[] = Array.isArray(eth?.providers) ? eth.providers : (eth ? [eth] : []);

    console.log('[signPermitMessage] ▶ START', {
      accountAddress: accountAddr,
      hasSignTypedData,
      windowEthereumPresent: !!eth,
      ethProvidersCount: ethProviders.length,
      permitToken: permitMessage?.domain?.verifyingContract,
      permitSpender: permitMessage?.message?.spender,
      permitNonce: permitMessage?.message?.nonce,
      permitValue: permitMessage?.message?.value,
      permitDeadline: permitMessage?.message?.deadline,
      valueType: typeof permitMessage?.message?.value,
      nonceType: typeof permitMessage?.message?.nonce,
    });

    // Thirdweb v5 uses viem internally which requires BigInt for uint256 fields.
    // The permitMessage arrives from JSON (all numbers serialized as strings), so
    // we must convert uint256 fields before calling signTypedData — otherwise viem
    // throws a silent TypeError and signing silently falls through to null.
    let typedDataForSigning: any;
    try {
      typedDataForSigning = {
        ...permitMessage,
        message: {
          ...permitMessage.message,
          value:    BigInt(permitMessage.message.value    ?? '0'),
          nonce:    BigInt(permitMessage.message.nonce    ?? '0'),
          deadline: BigInt(permitMessage.message.deadline ?? '0'),
        },
      };
      console.log('[signPermitMessage] BigInt conversion OK', {
        value: typedDataForSigning.message.value.toString(),
        nonce: typedDataForSigning.message.nonce.toString(),
        deadline: typedDataForSigning.message.deadline.toString(),
      });
    } catch (err) {
      console.error('[signPermitMessage] BigInt conversion failed:', err);
      return null;
    }

    // Strategy 1: Thirdweb account.signTypedData (primary — works in Telegram Mini App).
    // Thirdweb's Account type exposes signTypedData({ domain, types, primaryType, message }).
    if (hasSignTypedData) {
      console.log('[signPermitMessage] Strategy 1: account.signTypedData...');
      try {
        const sig = await (this.account as any).signTypedData(typedDataForSigning);
        console.log('[signPermitMessage] signTypedData raw result:', {
          type: typeof sig,
          length: typeof sig === 'string' ? sig.length : 'N/A',
          prefix: typeof sig === 'string' ? sig.slice(0, 20) : String(sig).slice(0, 20),
          valid: isValidSig(sig),
        });
        if (isValidSig(sig)) {
          console.log('[signPermitMessage] ✓ Strategy 1 succeeded');
          return sig;
        }
        console.warn('[signPermitMessage] Strategy 1: signature format invalid (not 65 bytes). Got length:', typeof sig === 'string' ? sig.length : typeof sig);
      } catch (err) {
        console.error('[signPermitMessage] Strategy 1 threw:', err instanceof Error ? err.message : String(err), err);
      }
    } else {
      console.warn('[signPermitMessage] Strategy 1 skipped: account.signTypedData not available', {
        accountExists: !!this.account,
        accountKeys: this.account ? Object.keys(this.account as any).slice(0, 10) : [],
      });
    }

    // Strategy 2: window.ethereum eth_signTypedData_v4 (MetaMask injected provider in browser).
    const provider = ethProviders.find((p: any) => {
      const selected = typeof p?.selectedAddress === 'string' ? p.selectedAddress.toLowerCase() : null;
      return selected === accountAddr.toLowerCase();
    }) ?? ethProviders[0] ?? null;

    console.log('[signPermitMessage] Strategy 2: window.ethereum', {
      providersAvailable: ethProviders.length,
      selectedProvider: provider?.isMetaMask ? 'MetaMask' : provider?.isCoinbaseWallet ? 'Coinbase' : provider ? 'unknown' : 'none',
    });

    if (!provider || typeof provider.request !== 'function') {
      console.warn('[signPermitMessage] ✗ Strategy 2 skipped: no injected provider (normal in Telegram Mini App)');
      return null;
    }

    try {
      const userAddress = this.connectedAddress();
      console.log('[signPermitMessage] Strategy 2: calling eth_signTypedData_v4 for', userAddress);
      const sig = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [userAddress, JSON.stringify(permitMessage)],
      });
      console.log('[signPermitMessage] eth_signTypedData_v4 raw result:', {
        type: typeof sig,
        length: typeof sig === 'string' ? sig.length : 'N/A',
        valid: isValidSig(sig),
      });
      if (isValidSig(sig)) {
        console.log('[signPermitMessage] ✓ Strategy 2 succeeded');
        return sig;
      }
      console.warn('[signPermitMessage] Strategy 2: signature format invalid');
      return null;
    } catch (err) {
      console.error('[signPermitMessage] Strategy 2 threw:', err instanceof Error ? err.message : String(err), err);
      return null;
    }
  }

  /**
   * Step 2 of the permit flow.
   * Sends the signed permit to the backend, which returns a single Multicall3 transaction
   * that atomically executes [permit, transferFrom, execute] — no separate approve needed.
   */
  async finalizeSupplyPermit(
    permitContext: {
      permitMessage: any;
      executeCalldata: string;
      executorAddress: string;
      adapterProxy: string;
      amount: string;
    },
    signature: string,
  ): Promise<any> {
    const userAddress = this.connectedAddress();

    const res = await fetch(`${this.baseUrl}/moonwell/finalizeSupplyPermit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address:         userAddress,
        permitMessage:   permitContext.permitMessage,
        signature,
        executeCalldata: permitContext.executeCalldata,
        executorAddress: permitContext.executorAddress,
        adapterProxy:    permitContext.adapterProxy,
        amount:          permitContext.amount,
      }),
    });
    if (!res.ok) throw new Error(`Finalize permit failed (${res.status}): ${await this.readError(res)}`);
    const json = await res.json();
    const bundle = json?.data?.bundle;
    if (!bundle?.steps?.length) throw new Error('No transaction bundle returned from permit finalization.');
    return { bundle };
  }

  async prepareRepayWithPermit(mTokenAddress: string, amount: string, decimals = 18): Promise<{
    permitMessage: any | null;
    executeCalldata: string;
    permitTarget: string;
    executorAddress: string;
    adapterProxy: string;
    amount: string;
    chainId: number;
    metadata: any;
  } | null> {
    const userAddress = this.connectedAddress();
    const amountWei = parseAmountToWei(amount, decimals).toString();

    const res = await fetch(`${this.baseUrl}/moonwell/prepareRepayWithPermit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: userAddress, amount: amountWei, mTokenAddress }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  }

  async finalizeRepayPermit(
    permitContext: {
      permitMessage: any;
      executeCalldata: string;
      executorAddress: string;
      adapterProxy: string;
      amount: string;
    },
    signature: string,
  ): Promise<any> {
    const userAddress = this.connectedAddress();

    const res = await fetch(`${this.baseUrl}/moonwell/finalizeRepayPermit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address:         userAddress,
        permitMessage:   permitContext.permitMessage,
        signature,
        executeCalldata: permitContext.executeCalldata,
        executorAddress: permitContext.executorAddress,
        adapterProxy:    permitContext.adapterProxy,
        amount:          permitContext.amount,
      }),
    });
    if (!res.ok) throw new Error(`Finalize repay permit failed (${res.status}): ${await this.readError(res)}`);
    const json = await res.json();
    const bundle = json?.data?.bundle;
    if (!bundle?.steps?.length) throw new Error('No transaction bundle returned from repay permit finalization.');
    return { bundle };
  }

  async prepareRecoverEth(): Promise<any> {
    const userAddress = this.connectedAddress();
    const res = await fetch(`${this.baseUrl}/moonwell/recoverEth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: userAddress }),
    });
    if (!res.ok) throw new Error(`Recover ETH failed (${res.status}): ${await this.readError(res)}`);
    const json = await res.json();
    // Response is { status, data: { bundle, metadata } } — extract steps directly
    return json?.data?.bundle ?? null;
  }

  async executeTransaction(txData: any): Promise<string> {
    const result = await this.executeTransactionWithStatus(txData);
    return result.transactionHash;
  }

  async executeTransactionWithStatus(txData: any): Promise<MoonwellTransactionStatus> {
    if (!this.account) {
      throw new Error('Please connect your wallet to execute transactions.');
    }
    if (!this.account.sendTransaction || typeof this.account.sendTransaction !== 'function') {
      throw new Error('Connected wallet does not support EVM transactions.');
    }

    const toHex = (v: string | number | bigint | undefined): string | undefined => {
      if (v === undefined || v === null || v === '') return undefined;
      if (typeof v === 'bigint') return `0x${v.toString(16)}`;
      if (typeof v === 'number') return `0x${BigInt(Math.trunc(v)).toString(16)}`;
      const t = String(v).trim();
      if (!t) return undefined;
      return t.startsWith('0x') ? t : `0x${BigInt(t).toString(16)}`;
    };

    const targetChainId = Number(txData.chainId || MOONWELL_CHAIN_ID);
    await this.ensureBaseChain();

    const payload: Record<string, any> = {
      to:      txData.to,
      data:    txData.data,
      value:   toHex(txData.value) ?? '0x0',
      chainId: targetChainId,
    };
    const gasHex = toHex(txData.gasLimit || txData.gas);
    if (gasHex) payload.gas = gasHex;

    const result = await safeExecuteTransactionV2(async () => {
      // Prefer injected provider (MetaMask) over account.sendTransaction
      const eth = (window as any)?.ethereum;
      const providers: any[] = Array.isArray(eth?.providers) ? eth.providers : (eth ? [eth] : []);
      const provider = providers.find((p: any) => {
        const selected = typeof p?.selectedAddress === 'string' ? p.selectedAddress.toLowerCase() : null;
        return selected === this.account.address?.toLowerCase();
      }) ?? providers[0] ?? null;

      const extractHash = (v: unknown): string | null => {
        if (typeof v === 'string' && /^0x[a-fA-F0-9]{64}$/.test(v)) return v;
        if (v && typeof v === 'object') {
          const obj = v as any;
          for (const key of ['transactionHash', 'hash', 'txHash']) {
            if (typeof obj[key] === 'string' && /^0x[a-fA-F0-9]{64}$/.test(obj[key])) return obj[key];
          }
        }
        return null;
      };

      if (provider && typeof provider.request === 'function') {
        const providerPayload: Record<string, any> = {
          from: this.account.address,
          to: payload.to,
          data: payload.data,
          value: payload.value ?? '0x0',
        };
        if (payload.gas) providerPayload.gas = payload.gas;

        const raw = await provider.request({ method: 'eth_sendTransaction', params: [providerPayload] });
        const hash = extractHash(raw);
        if (hash) return { transactionHash: hash };
        throw new Error('Wallet did not return a transaction hash.');
      }

      const raw = await this.account.sendTransaction(payload);
      const hash = extractHash(raw);
      if (hash) return { transactionHash: hash };
      throw new Error('Wallet did not return a transaction hash.');
    });

    if (!result.success || !result.transactionHash) {
      throw new Error(result.error || 'Transaction failed');
    }

    return { transactionHash: result.transactionHash, confirmed: false };
  }

  /** Returns base block explorer URL for a tx hash. */
  getExplorerTxUrl(txHash: string): string {
    return `${BASE_EXPLORER}${txHash}`;
  }

  /** Not implemented for Moonwell — returns empty array. */
  async getTransactionHistory(_limit?: number): Promise<any[]> {
    return [];
  }

  clearLendingDataCache(): void {
    tokensCache.tokens   = null;
    tokensCache.fetchedAt = 0;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useMoonwellLendingApi = () => {
  const account      = useActiveAccount();
  const activeWallet = useActiveWallet();
  const activeChain  = useActiveWalletChain();
  const switchChain  = useSwitchActiveWalletChain();

  return useMemo(
    () => new MoonwellLendingApiClient(account, activeWallet, activeChain?.id ?? null, switchChain),
    [account, activeWallet, activeChain?.id, switchChain],
  );
};

export { MOONWELL_CHAIN_ID };
export default MoonwellLendingApiClient;
