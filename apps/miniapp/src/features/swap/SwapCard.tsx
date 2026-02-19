import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useActiveAccount, useSwitchActiveWalletChain } from 'thirdweb/react';
import {
  createThirdwebClient,
  defineChain,
  prepareTransaction,
  sendTransaction,
  type Address,
  type Hex,
} from 'thirdweb';
import { useLogout } from '../../shared/hooks/useLogout';
import { ConnectButton } from 'thirdweb/react';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { beginCell, toNano, Address as TonAddress } from '@ton/core';
import { useTonConnectUI, TonConnectButton } from '@tonconnect/ui-react';
import { getUserJettonWallet, toUSDT } from '../../lib/ton-helpers';
import { bridgeApi } from './bridgeApi';
import { TON_CHAIN_ID } from './tokens';

import { THIRDWEB_CLIENT_ID } from '../../shared/config/thirdweb';
import { safeExecuteTransactionV2, getCurrentNonce } from '../../shared/utils/transactionUtilsV2';

import { Button, Card, Input, Label, Select, ErrorStateCard } from '../../shared/ui';
import { SwapSuccessCard } from '../../components/ui/SwapSuccessCard';
import { TokenSelectionModal } from '../../components/TokenSelectionModal';
import { networks, type Network } from './tokens';
import {
  explorerTxUrl,
  formatAmountHuman,
  getTokenDecimals,
  isNative,
  normalizeToApi,
  parseAmountToWei,
} from './utils';
import { swapApi, SwapApiError } from './api';
import type { PreparedTx, QuoteRequest } from './types';

function ArrowUpDownIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 5L12 19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M16 9L12 5L8 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 15L12 19L16 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowDownIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 5V19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M16 15L12 19L8 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatForDebug(value: unknown): string {
  if (value === null || typeof value === 'undefined') return String(value);
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function resolveGenericErrorMessage(err: unknown, setShowFundWallet?: (show: boolean) => void): string {
  const message = (() => {
    if (!err) return 'Unknown error';
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  })();

  const lower = message.toLowerCase();
  if (lower.includes('insufficient funds') || lower.includes('have 0 want')) {
    if (setShowFundWallet) {
      setShowFundWallet(true);
    }
    return 'Insufficient balance to cover the transaction value and network fees.';
  }
  if (lower.includes('gas required exceeds allowance')) {
    if (setShowFundWallet) {
      setShowFundWallet(true);
    }
    return 'The transaction requires more gas than is currently available.';
  }
  if (lower.includes('user rejected') || lower.includes('user denied')) {
    return 'Signature rejected by the user.';
  }

  // viem/thirdweb sometimes cannot decode revert reason signatures
  if (lower.includes('abierrorsignaturenotfounderror') || lower.includes('encoded error signature')) {
    return 'Transaction reverted by the contract (no detailed reason provided).';
  }

  return message;
}

function resolveBridgeNetwork(networkName?: string): string {
  const mapping: Record<string, string> = {
    'TON': 'TON_MAINNET',
    'Ethereum': 'ETHEREUM_MAINNET',
    'Base': 'BASE_MAINNET',
    'Arbitrum': 'ARBITRUM_MAINNET',
    'Optimism': 'OPTIMISM_MAINNET',
    'Polygon': 'POLYGON_MAINNET',
    'Avalanche': 'AVALANCHE_MAINNET',
    'Binance Smart Chain': 'BSC_MAINNET',
    'World Chain': 'WORLDCHAIN_MAINNET',
  };
  return (networkName && mapping[networkName]) || 'ETHEREUM_MAINNET';
}

function resolveTokenSymbol(net: Network | undefined, tokenAddress: string): string | undefined {
  if (!net) return undefined;
  if (isNative(tokenAddress)) return net.nativeCurrency?.symbol;
  return net.tokens?.find((t) => t.address === tokenAddress)?.symbol;
}

const panelStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: 16,
  background: 'rgba(148, 163, 184, 0.08)',
  border: '1px solid rgba(148, 163, 184, 0.2)',
};

const selectGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
};

// Utility to extract the wallet address from the JWT
function getAddressFromToken(): string | null {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    return payload.sub || payload.address || null;
  } catch (error) {
    console.error('🔍 [JWT DEBUG] Error parsing JWT:', error);
    return null;
  }
}

type UiErrorState = {
  title: string;
  description: string;
  category: 'user-action' | 'temporary' | 'blocked' | 'unknown';
  primaryLabel: string;
  canRetry: boolean;
  traceId?: string;
  retryAfterSeconds?: number;
  retryAvailableAt?: number;
  secondaryAction?: {
    type: 'support' | 'docs';
    label: string;
    href?: string;
    onClick?: () => void;
  };
};

export function SwapCard() {
  const account = useActiveAccount();
  const switchChain = useSwitchActiveWalletChain();
  const clientId = THIRDWEB_CLIENT_ID || undefined;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);
  const wallets = useMemo(() => {
    if (typeof window === 'undefined') return [inAppWallet()];
    const WebApp = (window as any).Telegram?.WebApp;
    const isTelegram = !!WebApp;
    const isiOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const mode = isTelegram ? 'redirect' : 'popup';
    const redirectUrl = isTelegram ? `${window.location.origin}/miniapp/auth/callback` : undefined;

    if (isiOS) {
      return [
        inAppWallet({
          auth: {
            options: ['email', 'passkey', 'guest'],
            mode,
            redirectUrl,
          },
        }),
      ];
    }

    return [
      inAppWallet({
        auth: {
          options: ['google', 'telegram', 'email'],
          mode,
          redirectUrl,
        },
      }),
      createWallet('io.metamask', { preferDeepLink: true }),
    ];
  }, []);
  const supportedChains = useMemo(() => networks.map((n) => n.chainId), []);

  const addressFromToken = useMemo(() => getAddressFromToken(), []);
  const userAddress = localStorage.getItem('userAddress');
  const effectiveAddress = account?.address || addressFromToken || userAddress;

  const [tonConnectUI] = useTonConnectUI();
  const { logout } = useLogout();

  const defaultFromChain = 8453; // Base
  const defaultToChain = 8453;
  const [fromChainId, setFromChainId] = useState<number>(defaultFromChain);
  const [toChainId, setToChainId] = useState<number>(defaultToChain);

  const fromNet: Network | undefined = networks.find((n) => n.chainId === fromChainId);
  const toNet: Network | undefined = networks.find((n) => n.chainId === toChainId);

  const [fromToken, setFromToken] = useState<string>(
    () => fromNet?.tokens[0]?.address ?? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  );
  const [toToken, setToToken] = useState<string>(
    () => toNet?.tokens[0]?.address ?? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  );
  const [amount, setAmount] = useState<string>('');

  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<any | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [txHashes, setTxHashes] = useState<Array<{ hash: string; chainId: number }>>([]);
  const [errorState, setErrorState] = useState<UiErrorState | null>(null);
  const retryHandlerRef = useRef<(() => void) | null>(null);
  const [, setRetryRefreshTick] = useState(0);
  const [showFundWallet, setShowFundWallet] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    context: 'quote' | 'prepare';
    url?: string;
    payload?: unknown;
    status?: number;
    response?: unknown;
    causeMessage?: string;
  } | null>(null);
  const quoteRequestRef = useRef(0);
  const [toTokenDecimals, setToTokenDecimals] = useState<number>(18);
  const [isFromTokenModalOpen, setIsFromTokenModalOpen] = useState(false);
  const [isToTokenModalOpen, setIsToTokenModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!errorState?.retryAvailableAt) return;
    const diff = errorState.retryAvailableAt - Date.now();
    if (diff <= 0) return;
    const timer = window.setTimeout(() => {
      setRetryRefreshTick((tick) => tick + 1);
    }, diff + 25);
    return () => window.clearTimeout(timer);
  }, [errorState?.retryAvailableAt]);

  useEffect(() => {
    const next = networks.find((n) => n.chainId === fromChainId);
    const first = next?.tokens?.[0];
    if (first) setFromToken(first.address);
  }, [fromChainId]);

  useEffect(() => {
    const next = networks.find((n) => n.chainId === toChainId);
    const first = next?.tokens?.[0];
    if (first) setToToken(first.address);
  }, [toChainId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!toNet) {
        setToTokenDecimals(18);
        return;
      }

      if (isNative(toToken)) {
        setToTokenDecimals(toNet.nativeCurrency?.decimals ?? 18);
        return;
      }

      if (!client) {
        setToTokenDecimals(18);
        return;
      }

      try {
        const decimals = await getTokenDecimals({ client, chainId: toChainId, token: toToken });
        if (!cancelled) {
          setToTokenDecimals(decimals);
        }
      } catch {
        if (!cancelled) {
          setToTokenDecimals(18);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [client, toChainId, toNet, toToken]);

  // Helper function to get token display info
  const getTokenDisplay = (tokenAddress: string, net: Network | undefined) => {
    if (!net) return { symbol: 'Select', icon: undefined };
    const token = net.tokens.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
    return {
      symbol: token?.symbol || 'Select',
      icon: token?.icon,
      name: token?.name || ''
    };
  };

  const fromTokenDisplay = getTokenDisplay(fromToken, fromNet);
  const toTokenDisplay = getTokenDisplay(toToken, toNet);

  // Create token arrays in UiToken format for the modal
  const fromNetTokens = useMemo(() => {
    if (!fromNet) return [];
    return fromNet.tokens.map(t => ({
      ticker: t.symbol,
      name: t.name || t.symbol,
      network: fromNet.name,
      address: t.address,
      balance: "0.00",
      icon: t.icon
    }));
  }, [fromNet]);

  const toNetTokens = useMemo(() => {
    if (!toNet) return [];
    return toNet.tokens.map(t => ({
      ticker: t.symbol,
      name: t.name || t.symbol,
      network: toNet.name,
      address: t.address,
      balance: "0.00",
      icon: t.icon
    }));
  }, [toNet]);

  const canSubmit = useMemo(() => {
    return Boolean(fromChainId && toChainId && fromToken && toToken && amount && Number(amount) > 0);
  }, [fromChainId, toChainId, fromToken, toToken, amount]);

  useEffect(() => {
    const requestId = ++quoteRequestRef.current;

    if (!canSubmit) {
      setQuote(null);
      setQuoting(false);
      return undefined;
    }

    setQuote(null);
    setTxHashes([]);

    const timer = window.setTimeout(() => {
      void performQuote(requestId);
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [canSubmit, fromChainId, toChainId, fromToken, toToken, amount, effectiveAddress]);

  function clearErrorState() {
    setErrorState(null);
    retryHandlerRef.current = null;
  }

  function pushErrorState(state: UiErrorState, onRetry: () => void) {
    setErrorState(state);
    retryHandlerRef.current = onRetry;
  }

  function applyThrowableAsError(
    throwable: unknown,
    contextTitle: string,
    onRetry: () => void
  ) {
    if (throwable instanceof SwapApiError && throwable.userFacingError) {
      const data = throwable.userFacingError;

      if (data.code === 'INSUFFICIENT_BALANCE') {
        setShowFundWallet(true);
      }

      const disabledUntilRaw = data.actions?.primary?.disabledUntil;
      const disabledUntil = disabledUntilRaw ? Date.parse(disabledUntilRaw) : undefined;

      pushErrorState(
        {
          title: data.title,
          description: data.description,
          category: data.category as UiErrorState['category'],
          primaryLabel: data.actions?.primary?.label || 'Try again',
          canRetry: data.canRetry !== false,
          traceId: throwable.traceId || data.traceId,
          retryAfterSeconds: data.retryAfterSeconds,
          retryAvailableAt: Number.isFinite(disabledUntil) ? disabledUntil : undefined,
          secondaryAction: data.actions?.secondary,
        },
        onRetry
      );
      return;
    }

    const message = resolveGenericErrorMessage(throwable, setShowFundWallet);
    const isTokenExpired = message.toLowerCase().includes('token expired') || message.toLowerCase().includes('jwt');

    pushErrorState(
      {
        title: contextTitle,
        description: message,
        category: 'unknown',
        primaryLabel: 'Try again',
        canRetry: true,
        traceId: throwable instanceof SwapApiError ? throwable.traceId : undefined,
        secondaryAction: isTokenExpired ? {
          type: 'support',
          label: 'Disconnect Wallet',
          onClick: () => {
            logout();
            clearErrorState();
          }
        } : undefined
      },
      onRetry
    );
  }

  async function performQuote(requestId: number) {
    if (!canSubmit) return;
    clearErrorState();
    setDebugInfo(null);
    try {
      setQuoting(true);

      const userAddress = localStorage.getItem('userAddress');
      const smartAccountAddress = effectiveAddress || userAddress || '';

      if (fromChainId === TON_CHAIN_ID || toChainId === TON_CHAIN_ID) {
        const sourceNetwork = resolveBridgeNetwork(fromNet?.name);
        const destinationNetwork = resolveBridgeNetwork(toNet?.name);
        const sourceTokenSymbol = resolveTokenSymbol(fromNet, fromToken);
        const destinationTokenSymbol = resolveTokenSymbol(toNet, toToken);
        const res = await bridgeApi.quote(
          Number(amount),
          sourceNetwork,
          destinationNetwork,
          undefined,
          sourceTokenSymbol,
          destinationTokenSymbol
        );
        if (quoteRequestRef.current !== requestId) {
          return;
        }
        if (!res.success || !res.quote) throw new Error('Failed to get bridge quote');
        setQuote(res.quote);
      } else {
        const body = {
          fromChainId,
          toChainId,
          fromToken: normalizeToApi(fromToken),
          toToken: normalizeToApi(toToken),
          amount: amount.trim(),
          unit: 'token' as const,
          smartAccountAddress,
        } satisfies QuoteRequest;
        const res = await swapApi.quote(body);
        if (quoteRequestRef.current !== requestId) {
          return;
        }
        if (!res.success || !res.quote) throw new Error(res.message || 'Failed to get quote');
        // Use backend quote as-is. No client-side adjustment.
        setQuote(res.quote);
      }
    } catch (e: any) {
      if (quoteRequestRef.current !== requestId) {
        return;
      }
      if (e instanceof SwapApiError) {
        setDebugInfo({
          context: 'quote',
          url: e.url,
          payload: e.payload,
          status: e.status,
          response: e.responseBody,
          causeMessage: e.cause instanceof Error ? e.cause.message : undefined,
        });
      }
      applyThrowableAsError(
        e,
        'Unable to calculate quote',
        () => {
          const nextId = ++quoteRequestRef.current;
          void performQuote(nextId);
        }
      );
    } finally {
      if (quoteRequestRef.current === requestId) {
        setQuoting(false);
      }
    }
  }

  function flattenPrepared(prepared: any): PreparedTx[] {
    const out: PreparedTx[] = [];
    if (!prepared) return out;
    if (Array.isArray(prepared.transactions)) out.push(...prepared.transactions);
    if (Array.isArray(prepared.steps)) {
      for (const s of prepared.steps) {
        if (Array.isArray(s.transactions)) out.push(...s.transactions);
      }
    }
    return out;
  }

  async function handleTonSwap() {
    clearErrorState();
    setTxHashes([]);
    const userTonAddress = tonConnectUI.account?.address;

    if (!userTonAddress) {
      pushErrorState({
        title: 'TON Wallet not connected',
        description: 'Please connect your TON wallet to continue.',
        category: 'blocked',
        primaryLabel: 'Connect Wallet',
        canRetry: true
      }, handleTonSwap);
      return;
    }

    setDebugInfo(null);
    try {
      setPreparing(true);

      // 1. Create Swap on Backend
      // We pass the EVM address (effectiveAddress) as destination
      // And TON address as source
      const sourceNetwork = resolveBridgeNetwork(fromNet?.name);
      const destinationNetwork = resolveBridgeNetwork(toNet?.name);
      const sourceTokenSymbol = resolveTokenSymbol(fromNet, fromToken);
      const destinationTokenSymbol = resolveTokenSymbol(toNet, toToken);
      const bridgeTx = await bridgeApi.createTransaction(
        Number(amount),
        effectiveAddress || '', // EVM Address
        userTonAddress,
        sourceNetwork,
        destinationNetwork,
        undefined,
        sourceTokenSymbol,
        destinationTokenSymbol
      );

      const swapId = bridgeTx.id;
      const layerswapVault = bridgeTx.destination; // The vault address to send USDT to

      // 2. Get User's USDT Wallet
      const myUsdtWallet = await getUserJettonWallet(userTonAddress);

      console.log('DEBUG TON SWAP:', {
        userTonAddress,
        layerswapVault,
        myUsdtWallet: myUsdtWallet.toString(),
        swapId,
        amountUSDT: toUSDT(amount).toString()
      });

      // 3. Construct Payload
      const forwardPayload = beginCell()
        .storeUint(0, 32) // 0 = Text Comment
        .storeStringTail(swapId)
        .endCell();

      const body = beginCell()
        .storeUint(0xf8a7ea5, 32) // OpCode: Transfer
        .storeUint(0, 64)         // QueryID
        .storeCoins(toUSDT(amount)) // USDT Amount (6 decimals)
        .storeAddress(TonAddress.parse(layerswapVault))
        .storeAddress(TonAddress.parse(userTonAddress))
        .storeBit(0)
        .storeCoins(toNano('0.01')) // Forward Amount
        .storeBit(1)
        .storeRef(forwardPayload)
        .endCell();

      setPreparing(false);
      setExecuting(true);

      // 4. Send Transaction
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: myUsdtWallet.toString(),
            amount: toNano('0.1').toString(), // Gas (Increased to 0.1 for safety)
            payload: body.toBoc().toString('base64')
          }
        ]
      };

      const result = await tonConnectUI.sendTransaction(transaction);
      console.log('TON Transaction sent:', result);

      // We use a placeholder hash since TON Connect doesn't always return it easily
      setTxHashes([{ hash: 'pending', chainId: TON_CHAIN_ID }]);

    } catch (e: any) {
      applyThrowableAsError(e, 'TON Swap failed', handleTonSwap);
    } finally {
      setPreparing(false);
      setExecuting(false);
    }
  }

  async function onSwap() {
    clearErrorState();
    setTxHashes([]);
    if (!effectiveAddress) {
      pushErrorState(
        {
          title: 'Authentication required',
          description: 'Authentication required. Please ensure you are logged in.',
          category: 'blocked',
          primaryLabel: 'Try again',
          canRetry: true,
        },
        onSwap
      );
      return;
    }
    if (!clientId || !client) {
      pushErrorState(
        {
          title: 'Incomplete configuration',
          description: 'Missing THIRDWEB client configuration.',
          category: 'blocked',
          primaryLabel: 'Try again',
          canRetry: true,
        },
        onSwap
      );
      return;
    }
    setDebugInfo(null);
    try {
      setPreparing(true);
      if (toChainId === TON_CHAIN_ID) {
        const userTonAddress = tonConnectUI.account?.address;
        if (!userTonAddress) {
          pushErrorState({
            title: 'TON Wallet not connected',
            description: 'Please connect your TON wallet to continue.',
            category: 'blocked',
            primaryLabel: 'Connect Wallet',
            canRetry: true
          }, onSwap);
          return;
        }

        const sourceNetwork = resolveBridgeNetwork(fromNet?.name);
        const destinationNetwork = resolveBridgeNetwork(toNet?.name);
        const sourceTokenSymbol = resolveTokenSymbol(fromNet, fromToken);
        const destinationTokenSymbol = resolveTokenSymbol(toNet, toToken);

        const bridgeTx = await bridgeApi.createTransaction(
          Number(amount),
          userTonAddress,
          effectiveAddress || undefined,
          sourceNetwork,
          destinationNetwork,
          undefined,
          sourceTokenSymbol,
          destinationTokenSymbol
        );

        const txData = bridgeTx.transaction || bridgeTx;
        const depositAddress = txData.depositAddress || txData.destination || txData.vaultAddress;

        if (!depositAddress) {
          throw new Error('Bridge API did not return a Deposit Address');
        }

        const decimals = await getTokenDecimals({ client, chainId: fromChainId, token: fromToken });
        const wei = parseAmountToWei(amount, decimals);
        if (wei <= 0n) throw new Error('Invalid amount');

        let transaction;
        if (isNative(fromToken)) {
          transaction = prepareTransaction({
            to: depositAddress,
            chain: defineChain(fromChainId),
            client,
            value: wei,
          });
        } else {
          const { prepareContractCall, getContract } = await import('thirdweb');
          const contract = getContract({
            client,
            chain: defineChain(fromChainId),
            address: fromToken,
          });
          transaction = prepareContractCall({
            contract,
            method: 'function transfer(address to, uint256 value)',
            params: [depositAddress, BigInt(wei)],
          });
        }

        setPreparing(false);
        setExecuting(true);

        const result = await safeExecuteTransactionV2(async () => {
          return await sendTransaction({ account, transaction });
        });

        if (!result.success) {
          throw new Error(`Transaction failed: ${result.error}`);
        }

        if (!result.transactionHash) {
          throw new Error('Transaction failed: no transaction hash returned.');
        }

        setTxHashes([{ hash: result.transactionHash, chainId: fromChainId }]);
        return;
      }

      const decimals = await getTokenDecimals({ client, chainId: fromChainId, token: fromToken });
      const wei = parseAmountToWei(amount, decimals);
      if (wei <= 0n) throw new Error('Invalid amount');

      console.log(`[SwapCard] Preparing swap: ${fromChainId} -> ${toChainId}`);
      const preparePayload = {
        fromChainId,
        toChainId,
        fromToken: normalizeToApi(fromToken),
        toToken: normalizeToApi(toToken),
        amount: wei.toString(),
        sender: effectiveAddress,
      };
      console.log(`[SwapCard] Prepare payload:`, preparePayload);

      const prep = await swapApi.prepare(preparePayload);
      console.log(`[SwapCard] Prepare response:`, prep);

      const seq = flattenPrepared(prep.prepared);
      console.log(`[SwapCard] Transactions to execute:`, seq.map(t => ({ chainId: t.chainId, to: t.to, value: t.value })));

      if (!seq.length) throw new Error('No transactions returned by prepare');

      // Log the first transaction's chainId - this is where the swap will start
      const firstTxChainId = seq[0]?.chainId;
      console.log(`[SwapCard] First transaction chainId: ${firstTxChainId}, fromChainId: ${fromChainId}`);

      setPreparing(false);

      setExecuting(true);
      const hashes: Array<{ hash: string; chainId: number }> = [];

      // Track the current chain to avoid unnecessary switches
      let currentChainId: number | null = null;

      for (const t of seq) {
        // Always use the chainId from the transaction itself (returned by backend)
        const requiredChainId = t.chainId;

        // Switch chain if needed (either first tx or different chain)
        if (currentChainId !== requiredChainId) {
          console.log(`[SwapCard] Transaction requires chain ${requiredChainId}, switching...`);
          try {
            await switchChain(defineChain(requiredChainId));
            // Wait a bit for the wallet to fully switch
            await new Promise(resolve => setTimeout(resolve, 500));
            currentChainId = requiredChainId;
            console.log(`[SwapCard] ✅ Switched to chain ${requiredChainId}`);
          } catch (switchError: any) {
            console.error(`[SwapCard] Failed to switch to chain ${requiredChainId}:`, switchError);
            // Try to provide a more helpful error message
            const networkName = networks.find(n => n.chainId === requiredChainId)?.name || `chain ${requiredChainId}`;
            throw new Error(`Please switch to ${networkName} in your wallet to continue`);
          }
        }

        // Get the current nonce from the network to avoid "nonce too low" errors
        const currentNonce = await getCurrentNonce(client, t.chainId, effectiveAddress as `0x${string}`);
        console.log(`[SwapCard] Current nonce for chain ${t.chainId}: ${currentNonce}`);

        // Log transaction details for debugging
        console.log(`[SwapCard] Preparing tx for chain ${t.chainId}:`, {
          to: t.to,
          chainId: t.chainId,
          value: t.value,
          nonce: currentNonce,
        });

        const tx = prepareTransaction({
          to: t.to as Address,
          chain: defineChain(t.chainId),
          client,
          data: t.data as Hex,
          value: t.value != null ? BigInt(t.value as any) : 0n,
          nonce: currentNonce,
        });

        if (!account) {
          throw new Error('To execute the swap, you need to connect your wallet. Please go to the dashboard and connect your wallet first.');
        }

        const result = await safeExecuteTransactionV2(async () => {
          return await sendTransaction({ account, transaction: tx });
        });

        if (!result.success) {
          throw new Error(`Transaction failed: ${result.error}`);
        }

        if (!result.transactionHash) {
          throw new Error('Transaction failed: no transaction hash returned.');
        }

        console.log(`Transaction ${result.transactionHash} submitted on chain ${t.chainId}`);
        hashes.push({ hash: result.transactionHash, chainId: t.chainId });
      }
      setTxHashes(hashes);
    } catch (e: any) {
      if (e instanceof SwapApiError) {
        setDebugInfo({
          context: 'prepare',
          url: e.url,
          payload: e.payload,
          status: e.status,
          response: e.responseBody,
          causeMessage: e.cause instanceof Error ? e.cause.message : undefined,
        });
      }
      applyThrowableAsError(
        e,
        'Unable to prepare or execute the swap',
        onSwap
      );
    } finally {
      setPreparing(false);
      setExecuting(false);
    }
  }

  function swapSides() {
    setFromChainId(toChainId);
    setFromToken(toToken);
    setToChainId(fromChainId);
    setToToken(fromToken);
    setQuote(null);
    setTxHashes([]);
  }

  const receivePreview = useMemo(() => {
    if (!quote) return null;

    const symbol = (() => {
      if (!toNet) return undefined;
      if (isNative(toToken)) {
        return toNet.nativeCurrency?.symbol;
      }
      return toNet.tokens?.find((t) => t.address === toToken)?.symbol;
    })();

    const amountOut = quote.toAmount || quote.estimatedReceiveAmount;
    if (!amountOut) return null;

    try {
      const formatted = formatAmountHuman(BigInt(amountOut), toTokenDecimals);
      return `${formatted} ${symbol ?? ''}`.trim();
    } catch {
      return null;
    }
  }, [quote, toNet, toToken, toTokenDecimals]);

  async function handlePrimaryAction() {
    if (!quote) return;

    if (needsWalletConnection) {
      return;
    }

    if (fromChainId === TON_CHAIN_ID) {
      await handleTonSwap();
    } else {
      await onSwap();
    }
  }

  const needsWalletConnection = quote && !account;

  const primaryLabel = quote
    ? executing
      ? 'Executing swap…'
      : preparing
        ? 'Preparing transactions…'
        : needsWalletConnection
          ? 'Connect Wallet to Swap'
          : 'Swap Tokens'
    : quoting
      ? 'Calculating quote…'
      : 'Waiting for quote…';

  const primaryVariant = quote ? 'accent' : 'primary';
  const isTelegram = typeof window !== 'undefined' && (window as any).Telegram?.WebApp;
  const isiOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isRetryCoolingDown =
    !!(errorState?.retryAvailableAt && errorState.retryAvailableAt > Date.now());
  const retryDisabled =
    !errorState?.canRetry || isRetryCoolingDown;
  const retrySecondsHint = errorState
    ? (errorState.retryAvailableAt
      ? Math.max(0, Math.ceil((errorState.retryAvailableAt - Date.now()) / 1000))
      : errorState.retryAfterSeconds)
    : undefined;

  const handleErrorRetry = () => {
    if (retryDisabled) return;
    const retry = retryHandlerRef.current;
    if (!retry) return;
    clearErrorState();
    retry();
  };

  return (
    <Card padding={20} tone="muted">
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--tg-theme-text-color, #111)' }}>
          Token Swap
        </h2>
        <p style={{ marginTop: 6, color: 'var(--tg-theme-hint-color, #687280)', fontSize: 14 }}>
          Bridge and swap assets seamlessly across supported networks.
        </p>
      </div>

      <div style={panelStyle}>
        <Label style={{ marginBottom: 12 }}>From</Label>
        <div style={selectGrid}>
          <div>
            <Label htmlFor="from-chain" style={{ fontSize: 12 }}>Chain</Label>
            <Select
              id="from-chain"
              value={String(fromChainId)}
              onChange={(e) => setFromChainId(Number(e.target.value))}
            >
              <option value="" disabled>Select chain</option>
              {networks.map((net) => (
                <option key={net.chainId} value={net.chainId}>
                  {net.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="from-token" style={{ fontSize: 12 }}>Token</Label>
            <button
              onClick={() => setIsFromTokenModalOpen(true)}
              disabled={!fromNet}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                background: '#252525',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: fromNet ? 'pointer' : 'not-allowed',
                opacity: fromNet ? 1 : 0.5,
              }}
            >
              {fromTokenDisplay.icon ? (
                <img src={fromTokenDisplay.icon} alt={fromTokenDisplay.symbol} style={{ width: 24, height: 24, borderRadius: '50%' }} />
              ) : (
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #52525b, #27272a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 700,
                }}>
                  {fromTokenDisplay.symbol.substring(0, 2)}
                </div>
              )}
              <span style={{ color: 'white', fontWeight: 500 }}>{fromTokenDisplay.symbol}</span>
            </button>
            <TokenSelectionModal
              isOpen={isFromTokenModalOpen}
              onClose={() => setIsFromTokenModalOpen(false)}
              onSelect={(token) => setFromToken(token.address)}
              customTokens={fromNetTokens}
            />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Label htmlFor="amount" style={{ fontSize: 12 }}>Amount</Label>
          <Input
            id="amount"
            type="number"
            min="0"
            step="any"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ fontSize: 18, fontWeight: 600 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        <Button
          variant="outline"
          size="icon"
          onClick={swapSides}
          disabled={!canSubmit}
          style={{
            borderWidth: 2,
            background: 'transparent',
          }}
        >
          <ArrowUpDownIcon />
        </Button>
      </div>

      <div style={{ ...panelStyle, marginTop: 16 }}>
        <Label style={{ marginBottom: 12 }}>To</Label>
        <div style={selectGrid}>
          <div>
            <Label htmlFor="to-chain" style={{ fontSize: 12 }}>Chain</Label>
            <Select
              id="to-chain"
              value={String(toChainId)}
              onChange={(e) => setToChainId(Number(e.target.value))}
            >
              <option value="" disabled>Select chain</option>
              {networks.map((net) => (
                <option key={net.chainId} value={net.chainId}>
                  {net.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="to-token" style={{ fontSize: 12 }}>Token</Label>
            <button
              onClick={() => setIsToTokenModalOpen(true)}
              disabled={!toNet}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                background: '#252525',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: toNet ? 'pointer' : 'not-allowed',
                opacity: toNet ? 1 : 0.5,
              }}
            >
              {toTokenDisplay.icon ? (
                <img src={toTokenDisplay.icon} alt={toTokenDisplay.symbol} style={{ width: 24, height: 24, borderRadius: '50%' }} />
              ) : (
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #52525b, #27272a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 700,
                }}>
                  {toTokenDisplay.symbol.substring(0, 2)}
                </div>
              )}
              <span style={{ color: 'white', fontWeight: 500 }}>{toTokenDisplay.symbol}</span>
            </button>
            <TokenSelectionModal
              isOpen={isToTokenModalOpen}
              onClose={() => setIsToTokenModalOpen(false)}
              onSelect={(token) => setToToken(token.address)}
              customTokens={toNetTokens}
            />
          </div>
        </div>
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            border: '1px solid rgba(148, 163, 184, 0.3)',
            background: 'var(--tg-theme-bg-color, #fff)',
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: 'var(--tg-theme-hint-color, #687280)' }}>You will receive</p>
          <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 600 }}>
            {receivePreview ?? '—'}
          </p>
        </div>
      </div>

      {/* Quote Details Section */}
      {quote && (
        <div style={{ ...panelStyle, marginTop: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: 'var(--tg-theme-text-color, #111)' }}>
            📊 Quote Details
          </h3>
          <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--tg-theme-hint-color, #687280)' }}>From Amount:</span>
              <span style={{ fontWeight: 600 }}>{amount} {fromNet?.tokens.find(t => t.address === fromToken)?.symbol || 'Token'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--tg-theme-hint-color, #687280)' }}>To Amount:</span>
              <span style={{ fontWeight: 600 }}>{receivePreview}</span>
            </div>
            {quote.estimatedReceiveAmount && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--tg-theme-hint-color, #687280)' }}>Estimated Receive:</span>
                <span style={{ fontWeight: 600 }}>{formatAmountHuman(BigInt(quote.estimatedReceiveAmount), toTokenDecimals)} {toNet?.tokens.find(t => t.address === toToken)?.symbol || toNet?.nativeCurrency?.symbol || 'Token'}</span>
              </div>
            )}
            {quote.originAmount && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--tg-theme-hint-color, #687280)' }}>Origin Amount:</span>
                <span style={{ fontWeight: 600 }}>{formatAmountHuman(BigInt(quote.originAmount), 18)}</span>
              </div>
            )}
            {quote.destinationAmount && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--tg-theme-hint-color, #687280)' }}>Destination Amount:</span>
                <span style={{ fontWeight: 600 }}>{formatAmountHuman(BigInt(quote.destinationAmount), toTokenDecimals)}</span>
              </div>
            )}
            {quote.estimatedExecutionTimeMs && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--tg-theme-hint-color, #687280)' }}>Est. Time:</span>
                <span style={{ fontWeight: 600 }}>{(quote.estimatedExecutionTimeMs / 1000).toFixed(1)}s</span>
              </div>
            )}
            <div style={{ marginTop: 8, padding: 8, background: 'rgba(34, 197, 94, 0.1)', borderRadius: 8, border: '1px solid rgba(34, 197, 94, 0.2)' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                ✅ Quote ready — you can execute the swap
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Raw Quote Debug (only in debug mode) */}
      {quote && new URLSearchParams(window.location.search).get('debug') === '1' && (
        <details style={{ marginTop: 16, fontSize: 13 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>🔍 Raw Quote Data</summary>
          <pre
            style={{
              marginTop: 8,
              whiteSpace: 'pre-wrap',
              background: '#111',
              color: '#0f0',
              padding: 8,
              borderRadius: 8,
              fontSize: 11,
              overflow: 'auto',
            }}
          >
            {JSON.stringify(quote, null, 2)}
          </pre>
        </details>
      )}

      <div style={{ marginTop: 20 }}>
        {needsWalletConnection ? (
          <ConnectButton
            client={client!}
            wallets={wallets}
            connectModal={{
              size: 'compact',
              title: 'Connect Wallet to Execute Swap',
              showThirdwebBranding: false,
            }}
          />
        ) : (
          <Button
            onClick={handlePrimaryAction}
            variant={primaryVariant}
            size="lg"
            block
            disabled={!canSubmit || quoting || preparing || executing}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <ArrowDownIcon />
              {primaryLabel}
            </span>
          </Button>
        )}
      </div>

      {errorState && (
        <ErrorStateCard
          title={errorState.title}
          description={errorState.description}
          category={errorState.category}
          primaryLabel={errorState.primaryLabel}
          onPrimaryAction={handleErrorRetry}
          primaryDisabled={retryDisabled}
          secondaryAction={errorState.secondaryAction}
          traceId={errorState.traceId}
          retryAfterSeconds={retrySecondsHint}
        />
      )}

      {quote && isTelegram && isiOS && (
        <div style={{ marginTop: 12 }}>
          <Button
            variant="outline"
            size="lg"
            block
            onClick={async () => {
              try {
                const WebApp = (window as any).Telegram?.WebApp;
                const clientId = THIRDWEB_CLIENT_ID;
                const authApiBase = (process.env.VITE_AUTH_API_BASE || '').replace(/\/+$/, '');
                const walletCookie = clientId ? localStorage.getItem(`walletToken-${clientId}`) : null;
                const token = localStorage.getItem('authToken');
                let nonce = '';
                if (authApiBase) {
                  const resp = await fetch(`${authApiBase}/auth/miniapp/session/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, walletCookie, ttlSeconds: 600 }),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    nonce = data.nonce;
                  }
                }
                const params = new URLSearchParams({
                  fromChainId: String(fromChainId),
                  toChainId: String(toChainId),
                  fromToken: normalizeToApi(fromToken),
                  toToken: normalizeToApi(toToken),
                  amount: amount.trim(),
                });
                if (nonce) params.set('nonce', nonce);
                const url = `${window.location.origin}/miniapp/swap/external?${params.toString()}`;
                if (WebApp?.openLink) {
                  WebApp.openLink(url, { try_instant_view: false });
                } else {
                  window.open(url, '_blank');
                }
              } catch (e) {
                console.error('[SwapCard] open external failed', e);
              }
            }}
          >
            Execute in Safari (recommended on iOS)
          </Button>
        </div>
      )}

      {debugInfo && (
        <details style={{ marginTop: 16, fontSize: 13 }}>
          <summary>Debug info ({debugInfo.context})</summary>
          {debugInfo.url && <div style={{ marginTop: 6 }}>URL: {debugInfo.url}</div>}
          {debugInfo.status && <div>Status: {debugInfo.status}</div>}
          {typeof debugInfo.payload !== 'undefined' && (
            <pre
              style={{
                marginTop: 6,
                whiteSpace: 'pre-wrap',
                background: '#111',
                color: '#0f0',
                padding: 8,
                borderRadius: 8,
              }}
            >
              {formatForDebug(debugInfo.payload)}
            </pre>
          )}
          {typeof debugInfo.response !== 'undefined' && (
            <pre
              style={{
                marginTop: 6,
                whiteSpace: 'pre-wrap',
                background: '#111',
                color: '#0f0',
                padding: 8,
                borderRadius: 8,
              }}
            >
              {formatForDebug(debugInfo.response)}
            </pre>
          )}
          {debugInfo.causeMessage && <div>Cause: {debugInfo.causeMessage}</div>}
        </details>
      )}

      {txHashes.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <SwapSuccessCard
            txHashes={txHashes}
            onClose={() => setTxHashes([])}
          />
        </div>
      )}

      {showFundWallet && (
        <div style={{ marginTop: 16, padding: 16, background: 'rgba(255, 193, 7, 0.1)', borderRadius: 12, border: '1px solid rgba(255, 193, 7, 0.3)' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#ff6b35' }}>
            💰 Add Funds
          </h4>
          <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--tg-theme-text-color, #333)' }}>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ConnectButton
              client={client!}
              wallets={wallets}
              connectModal={{
                size: 'compact',
                title: 'Add Funds',
                showThirdwebBranding: false,
              }}
              connectButton={{
                label: '💰 Add ETH',
                style: {
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 14,
                  background: '#ff6b35',
                  color: '#fff',
                },
              }}
              theme="dark"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFundWallet(false)}
              style={{ width: '100%' }}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default SwapCard;
