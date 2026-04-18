/**
 * MoonwellLending — Lending widget for Moonwell Finance on Base (chainId 8453).
 *
 * Mirrors Lending.tsx (Benqi/Avalanche) with the following changes:
 *   - Uses useMoonwellLendingApi / useMoonwellLendingData
 *   - chainId = 8453, explorer = basescan.org
 *   - Header subtitle: "Moonwell · Base"
 *   - Tracking: chain='base', provider='moonwell'
 *   - No validation fee step
 */

import { AnimatePresence } from "framer-motion";
import { Landmark, X, ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DefiWidgetModalShell } from "@/components/ui/DefiWidgetModalShell";
import { useMoonwellLendingData } from "@/features/lending/moonwell/useMoonwellLendingData";
import { useMoonwellLendingApi, MOONWELL_CHAIN_ID } from "@/features/lending/moonwell/api";
import type { LendingAccountPositionRow, LendingToken } from "@/features/lending/types";
import { formatAmountHuman, parseAmountToWei } from "@/features/swap/utils";
import { THIRDWEB_CLIENT_ID } from "@/shared/config/thirdweb";
import { waitForEvmReceipt } from "@/shared/utils/evmReceipt";
import { useIsMobileBreakpoint } from "@/shared/hooks/useIsMobileBreakpoint";
import { useRateLimitCountdown, parseRetryAfter } from "@/shared/hooks/useRateLimitCountdown";
import { mapError } from "@/shared/lib/errorMapper";
import { useActiveAccount } from "thirdweb/react";
import { startSwapTracking, type SwapTracker } from "@/features/gateway";
import {
  type LendingTxStage,
  type LendingTxStepStage,
} from "@/components/lending/lendingTxState";
import { LendingInputView } from "@/components/lending/LendingInputView";
import { LendingReviewView } from "@/components/lending/LendingReviewView";
import { LendingStatusView } from "@/components/lending/LendingStatusView";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewState = 'input' | 'review' | 'status';
type Mode = 'supply' | 'borrow';
type Flow = 'open' | 'close';
type LendingActionType = 'supply' | 'withdraw' | 'borrow' | 'repay';
type LendingInfoPopup = 'risk' | 'flow' | 'pending' | 'steps';

type TxStep = {
  id: string;
  label: string;
  stage: LendingTxStepStage;
  txHash: string | null;
  to?: string | null;
  data?: string | null;
  chainId?: number;
};

export interface MoonwellLendingProps {
  onClose: () => void;
  initialAmount?: string | number;
  initialAsset?: string;
  initialMode?: Mode;
  initialFlow?: Flow;
  initialViewState?: ViewState;
  variant?: 'modal' | 'panel';
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function safeParseBigInt(value: string | null | undefined): bigint | null {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return null;
  try { return BigInt(value); } catch { return null; }
}

function normalizeInitialAmount(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  const t = String(raw).trim();
  return t || undefined;
}

function isValidAmountInput(value: string): boolean {
  if (value === '') return true;
  return /^(\d+(\.\d*)?|\.\d*)$/.test(value);
}

function formatAPY(apy: number | null | undefined): string {
  if (apy == null || !Number.isFinite(apy)) return '--';
  return `${apy.toFixed(2)}%`;
}

function getExplorerTxUrl(_chainId: number, txHash: string): string {
  return `https://basescan.org/tx/${txHash}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MoonwellLending({
  onClose,
  initialAmount,
  initialAsset,
  initialMode,
  initialFlow,
  initialViewState,
  variant = 'modal',
}: MoonwellLendingProps) {
  const account = useActiveAccount();
  const lendingApi = useMoonwellLendingApi();
  const {
    tokens,
    userPosition,
    loading: loadingData,
    error: dataError,
    refresh,
    fetchPosition,
  } = useMoonwellLendingData();

  const [viewState, setViewState] = useState<ViewState>('input');
  const [mode, setMode] = useState<Mode>(initialMode ?? 'supply');
  const [flow, setFlow] = useState<Flow>(initialFlow ?? 'open');
  const [infoPopup, setInfoPopup] = useState<LendingInfoPopup | null>(null);
  const [activeMarket, setActiveMarket] = useState<LendingToken | null>(null);
  const [amount, setAmount] = useState<string>(normalizeInitialAmount(initialAmount) ?? '');

  const hasDeferredReviewRef = useRef(initialViewState === 'review' && !!normalizeInitialAmount(initialAmount));
  useEffect(() => {
    if (!hasDeferredReviewRef.current) return;
    if (activeMarket && amount) {
      hasDeferredReviewRef.current = false;
      setViewState('review');
    }
  }, [activeMarket, amount]);

  const [loadingBalance, setLoadingBalance] = useState(false);
  const [walletBalanceWei, setWalletBalanceWei] = useState<bigint | null>(null);
  const [walletBalanceHuman, setWalletBalanceHuman] = useState<string | null>(null);

  const [txStage, setTxStage] = useState<LendingTxStage>('idle');
  const [txError, setTxError] = useState<string | null>(null);
  const [txWarning, setTxWarning] = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<string[]>([]);
  const [txSteps, setTxSteps] = useState<TxStep[]>([]);

  const rateLimit = useRateLimitCountdown();
  const [txHistory, setTxHistory] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const isMountedRef = useRef(true);
  const timeoutSyncHashRef = useRef<string | null>(null);
  const txActionInFlightRef = useRef(false);
  const lastAutoFilledActionRef = useRef<string | null>(null);
  const [recoverEthLoading, setRecoverEthLoading] = useState(false);
  const [recoverEthError, setRecoverEthError] = useState<string | null>(null);
  const [recoverEthHash, setRecoverEthHash] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const effectiveAddress = account?.address ?? null;

  // Initialize market on first token load
  useEffect(() => {
    if (activeMarket || tokens.length === 0) return;
    const bySymbol = initialAsset
      ? tokens.find((t) => t.symbol.toUpperCase() === initialAsset.toUpperCase())
      : null;
    setActiveMarket(bySymbol ?? tokens[0]);
  }, [activeMarket, initialAsset, tokens]);

  // Fetch wallet balance for the selected underlying asset
  useEffect(() => {
    if (!THIRDWEB_CLIENT_ID || !effectiveAddress || !activeMarket) {
      setWalletBalanceWei(null);
      setWalletBalanceHuman(null);
      return;
    }
    let cancelled = false;
    setLoadingBalance(true);
    setWalletBalanceWei(null);
    setWalletBalanceHuman(null);

    const fetchBalance = async () => {
      try {
        const { createThirdwebClient, getContract, defineChain } = await import("thirdweb");
        const { getBalance } = await import("thirdweb/extensions/erc20");
        const { eth_getBalance, getRpcClient } = await import("thirdweb/rpc");

        const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
        const tokenAddress = (activeMarket.address || '').toLowerCase();
        // mWETH market uses native ETH for all operations (supportsEthVariant) — always show ETH balance
        const isEthVariant = activeMarket.qTokenSymbol === 'mWETH';
        const isNative =
          isEthVariant ||
          !tokenAddress ||
          tokenAddress === 'native' ||
          tokenAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
          tokenAddress === '0x0000000000000000000000000000000000000000';

        let balance: bigint;
        let decimals = activeMarket.decimals ?? 18;
        if (isNative) {
          const rpc = getRpcClient({ client, chain: defineChain(MOONWELL_CHAIN_ID) });
          balance = await eth_getBalance(rpc, { address: effectiveAddress as `0x${string}` });
        } else {
          const contract = getContract({
            client,
            chain: defineChain(MOONWELL_CHAIN_ID),
            address: activeMarket.address as `0x${string}`,
          });
          const res = await getBalance({ contract, address: effectiveAddress as `0x${string}` });
          balance = res.value;
          decimals = res.decimals;
        }
        if (cancelled) return;
        setWalletBalanceWei(balance);
        setWalletBalanceHuman(formatAmountHuman(balance, decimals, 6));
      } catch (e) {
        console.warn('[MOONWELL] Balance fetch failed:', e);
        if (!cancelled) { setWalletBalanceWei(null); setWalletBalanceHuman(null); }
      } finally {
        if (!cancelled) setLoadingBalance(false);
      }
    };
    fetchBalance();
    return () => { cancelled = true; };
  }, [activeMarket, effectiveAddress]);

  useEffect(() => {
    if (!historyOpen || !effectiveAddress) return;
    let cancelled = false;
    setHistoryLoading(true);
    lendingApi.getTransactionHistory(10)
      .then((txs) => { if (!cancelled) setTxHistory(txs); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [historyOpen, effectiveAddress, lendingApi]);

  // Position row for the active market
  const activePositionRow = useMemo<LendingAccountPositionRow | null>(() => {
    if (!activeMarket) return null;
    const rows = userPosition?.positions || [];
    const addr = activeMarket.qTokenAddress?.toLowerCase();
    if (!addr) return null;
    return rows.find((r) => (r.qTokenAddress || '').toLowerCase() === addr) || null;
  }, [activeMarket, userPosition?.positions]);

  const suppliedWei = useMemo(() => safeParseBigInt(activePositionRow?.suppliedWei) ?? 0n, [activePositionRow?.suppliedWei]);
  const borrowedWei = useMemo(() => safeParseBigInt(activePositionRow?.borrowedWei) ?? 0n, [activePositionRow?.borrowedWei]);
  const qTokenBalanceWei = useMemo(() => safeParseBigInt(activePositionRow?.qTokenBalanceWei) ?? 0n, [activePositionRow?.qTokenBalanceWei]);
  const qTokenDecimals = useMemo(() => {
    const v = activePositionRow?.qTokenDecimals;
    return Number.isFinite(v) ? Number(v) : 8;
  }, [activePositionRow?.qTokenDecimals]);
  const activeQTokenSymbol = useMemo(() => activePositionRow?.qTokenSymbol || activeMarket?.qTokenSymbol || 'mToken', [activeMarket?.qTokenSymbol, activePositionRow?.qTokenSymbol]);

  const positionMaxWei = useMemo(() => {
    if (!activeMarket) return 0n;
    if (mode === 'supply' && flow === 'close') return suppliedWei;
    if (mode === 'borrow' && flow === 'close') return borrowedWei;
    return 0n;
  }, [activeMarket, borrowedWei, flow, mode, suppliedWei]);

  const amountWei = useMemo(() => {
    if (!activeMarket || !amount || !isValidAmountInput(amount)) return null;
    try { return parseAmountToWei(amount, activeMarket.decimals ?? 18); } catch { return null; }
  }, [activeMarket, amount]);

  const previewHuman = useMemo(() => {
    if (!activeMarket || amountWei == null) return '';
    return formatAmountHuman(amountWei, activeMarket.decimals ?? 18, 6);
  }, [activeMarket, amountWei]);

  const maxHuman = useMemo(() => {
    if (!activeMarket) return null;
    const decimals = activeMarket.decimals ?? 18;
    if (flow === 'open') {
      if (mode === 'borrow') return null;
      if (walletBalanceWei == null) return null;
      return formatAmountHuman(walletBalanceWei, decimals, 6);
    }
    return formatAmountHuman(positionMaxWei, decimals, 6);
  }, [activeMarket, flow, mode, positionMaxWei, walletBalanceWei]);

  const canReview = useMemo(() => {
    if (!activeMarket || !amountWei || amountWei <= 0n) return false;
    if (flow === 'open') {
      if (mode === 'borrow') return true;
      // Block while balance is loading or unknown — don't let through with null balance
      if (loadingBalance || walletBalanceWei == null) return false;
      return amountWei <= walletBalanceWei;
    }
    return amountWei <= positionMaxWei;
  }, [activeMarket, amountWei, flow, loadingBalance, mode, walletBalanceWei, positionMaxWei]);

  const actionLabel = useMemo(() => {
    if (mode === 'supply' && flow === 'open') return 'Supply';
    if (mode === 'supply' && flow === 'close') return 'Withdraw';
    if (mode === 'borrow' && flow === 'open') return 'Borrow';
    return 'Repay';
  }, [flow, mode]);

  const activeAction = useMemo<LendingActionType>(() => {
    if (mode === 'supply' && flow === 'open') return 'supply';
    if (mode === 'supply' && flow === 'close') return 'withdraw';
    if (mode === 'borrow' && flow === 'open') return 'borrow';
    return 'repay';
  }, [flow, mode]);

  const reviewRiskHint = useMemo(() => {
    if (activeAction === 'borrow') return 'Borrowing reduces account health. If collateral value drops too far, liquidation risk increases.';
    if (activeAction === 'withdraw') return 'Withdrawing collateral can reduce account health. Confirm health stays safe before signing.';
    return null;
  }, [activeAction]);

  // Auto-fill amount with max on tab change
  useEffect(() => {
    if (normalizeInitialAmount(initialAmount)) return;
    if (lastAutoFilledActionRef.current === activeAction) return;
    if (maxHuman === null) {
      if (activeAction === 'borrow') { lastAutoFilledActionRef.current = activeAction; setAmount(''); }
      return;
    }
    lastAutoFilledActionRef.current = activeAction;
    setAmount(maxHuman);
  }, [maxHuman, activeAction, initialAmount]);

  const setActiveAction = useCallback((action: LendingActionType) => {
    lastAutoFilledActionRef.current = null;
    setAmount('');
    if (action === 'supply') { setMode('supply'); setFlow('open'); return; }
    if (action === 'withdraw') { setMode('supply'); setFlow('close'); return; }
    if (action === 'borrow') { setMode('borrow'); setFlow('open'); return; }
    setMode('borrow'); setFlow('close');
  }, []);

  const inputLabel = useMemo(() => {
    if (mode === 'supply' && flow === 'open') return 'You Supply';
    if (mode === 'supply' && flow === 'close') return 'You Withdraw';
    if (mode === 'borrow' && flow === 'open') return 'You Borrow';
    return 'You Repay';
  }, [flow, mode]);

  const secondaryLabel = useMemo(() => {
    if (activeAction === 'supply') return 'Estimated supplied';
    if (activeAction === 'withdraw') return 'Estimated withdrawn';
    if (activeAction === 'borrow') return 'Estimated borrowed';
    return 'Estimated repaid';
  }, [activeAction]);

  const balanceLabel = useMemo(() => {
    if (!activeMarket) return 'Available: --';
    const sym = activeMarket.symbol;
    if (flow === 'open') {
      if (mode === 'borrow') return 'Limit: --';
      if (loadingBalance) return `Available: ... ${sym}`;
      return `Available: ${walletBalanceHuman ?? '--'} ${sym}`;
    }
    const decimals = activeMarket.decimals ?? 18;
    return `Available: ${formatAmountHuman(positionMaxWei, decimals, 6)} ${sym}`;
  }, [activeMarket, flow, loadingBalance, mode, positionMaxWei, walletBalanceHuman]);

  const tokenOptions = useMemo(() =>
    tokens.map((t) => ({ symbol: t.symbol, icon: t.icon })),
  [tokens]);

  const resetTxUi = useCallback(() => {
    setTxError(null); setTxWarning(null); setTxHashes([]); setTxSteps([]); setTxStage('idle');
  }, []);

  useEffect(() => { if (viewState === 'input') resetTxUi(); }, [resetTxUi, viewState]);

  const waitForReceipt = useCallback(async (
    hash: string,
    tracking?: { to?: string | null; data?: string | null },
  ) => {
    return waitForEvmReceipt({
      clientId: THIRDWEB_CLIENT_ID,
      chainId: MOONWELL_CHAIN_ID,
      txHash: hash,
      pollIntervalMs: 2_500,
      shouldContinue: () => isMountedRef.current,
      tracking: { fromAddress: account?.address, to: tracking?.to, data: tracking?.data },
    });
  }, [account?.address]);

  // ── Main tx handler ────────────────────────────────────────────────────────

  const handleRecoverEth = useCallback(async () => {
    if (!account) { setRecoverEthError('Connect a wallet first.'); return; }
    if (recoverEthLoading) return;
    setRecoverEthLoading(true);
    setRecoverEthError(null);
    setRecoverEthHash(null);
    try {
      const bundle = await lendingApi.prepareRecoverEth();
      if (!bundle?.steps?.length) throw new Error('No transaction to execute.');
      const step = bundle.steps[0];
      const tx = { to: step.to, data: step.data, value: step.value || '0', gasLimit: step.gas || 200_000, chainId: MOONWELL_CHAIN_ID };
      const hash = await lendingApi.executeTransaction(tx);
      setRecoverEthHash(hash);
      setTimeout(() => refresh(), 4000);
    } catch (err: any) {
      setRecoverEthError(err?.message ?? 'Recovery failed.');
    } finally {
      setRecoverEthLoading(false);
    }
  }, [account, lendingApi, recoverEthLoading, refresh]);

  const handlePrepareAndExecute = useCallback(async () => {
    if (!activeMarket || !amount || !canReview) return;
    if (!account) { setTxError('Connect an EVM wallet to continue.'); return; }
    if (txActionInFlightRef.current) return;
    txActionInFlightRef.current = true;

    setTxError(null); setTxWarning(null); setTxStage('awaiting_wallet');
    setTxHashes([]); setViewState('status');

    let tracker: SwapTracker | null = null;
    try {
      const decimals = activeMarket.decimals ?? 18;
      const mTokenAddress = activeMarket.qTokenAddress; // normalized field
      const opAmount = amount;
      const normalizedAddress = account.address?.toLowerCase();
      const action = activeAction;

      const zeroAddr = "0x0000000000000000000000000000000000000000";
      const underlyingAsset = { address: activeMarket.address || zeroAddr, symbol: activeMarket.symbol || 'TOKEN', decimals };
      const mTokenAsset = {
        address: activeMarket.qTokenAddress || zeroAddr,
        symbol: activeMarket.qTokenSymbol || `m${activeMarket.symbol || 'TOKEN'}`,
        decimals: 8,
      };
      const fromAsset = (action === 'withdraw' || action === 'borrow') ? mTokenAsset : underlyingAsset;
      const toAsset   = (action === 'withdraw' || action === 'borrow') ? underlyingAsset : mTokenAsset;

      if (normalizedAddress) {
        try {
          tracker = await startSwapTracking({
            userId: normalizedAddress,
            walletAddress: normalizedAddress,
            chain: 'base',
            action,
            fromChainId: MOONWELL_CHAIN_ID,
            toChainId: MOONWELL_CHAIN_ID,
            fromAsset,
            toAsset,
            fromAmount: opAmount,
            toAmount: previewHuman || opAmount,
            provider: 'moonwell',
          });
        } catch (trackingError) {
          console.warn('[MOONWELL] Gateway tracking unavailable:', trackingError);
        }
      }

      // Prepare transaction bundle.
      // For supply, attempt the EIP-2612 permit flow first: it collapses the approve + execute
      // into a single Multicall3 transaction, bypassing MetaMask Smart Transaction cancellations.
      // Falls back to the two-step approve + execute flow when permit is unsupported.
      const prepared = await (async () => {
        if (mode === 'supply' && flow === 'open') {
          try {
            const permitCtx = await (lendingApi as any).prepareSupplyWithPermit?.(mTokenAddress, opAmount, decimals);
            if (permitCtx?.permitMessage) {
              const sig = await (lendingApi as any).signPermitMessage?.(permitCtx.permitMessage);
              if (sig) {
                return (lendingApi as any).finalizeSupplyPermit(permitCtx, sig);
              }
            }
          } catch {
            // Permit failed or wallet rejected typed signing — fall through to approve flow.
          }
          return lendingApi.prepareSupply(mTokenAddress, opAmount, decimals);
        }
        if (mode === 'supply' && flow === 'close') {
          // Compute mToken amount proportional to the underlying amount requested
          let mTokenOverride: string | undefined;
          const pos = activePositionRow as any;
          const mTokenBalStr: string | undefined = pos?.qTokenBalanceWei ?? pos?.mTokenBalanceWei;
          const suppliedWStr: string | undefined = pos?.suppliedWei;
          if (mTokenBalStr && suppliedWStr) {
            const mTokenBal = BigInt(mTokenBalStr);
            const suppliedW = BigInt(suppliedWStr);
            if (suppliedW > 0n && mTokenBal > 0n) {
              const opWei = parseAmountToWei(opAmount, decimals);
              mTokenOverride = ((opWei * mTokenBal) / suppliedW).toString();
            } else if (mTokenBal > 0n) {
              mTokenOverride = mTokenBalStr;
            }
          }
          return lendingApi.prepareWithdraw(mTokenAddress, opAmount, decimals, mTokenOverride);
        }
        if (mode === 'borrow' && flow === 'open') {
          return lendingApi.prepareBorrow(mTokenAddress, opAmount, decimals);
        }
        try {
          const permitCtx = await (lendingApi as any).prepareRepayWithPermit?.(mTokenAddress, opAmount, decimals);
          if (permitCtx?.permitMessage) {
            const sig = await (lendingApi as any).signPermitMessage?.(permitCtx.permitMessage);
            if (sig) {
              return (lendingApi as any).finalizeRepayPermit(permitCtx, sig);
            }
          }
        } catch {
          // Permit failed — fall through to approve flow.
        }
        return lendingApi.prepareRepay(mTokenAddress, opAmount, decimals);
      })();

      // Normalize response to steps array
      const toPreparedTx = (txLike: any) => {
        if (!txLike?.to || !txLike?.data) return null;
        return {
          to:       txLike.to,
          data:     txLike.data,
          value:    txLike.value || '0',
          gasLimit: txLike.gasLimit || txLike.gas || 700_000,
          gasPrice: txLike.gasPrice,
          chainId:  MOONWELL_CHAIN_ID,
        };
      };

      let txs: any[];
      if (prepared?.bundle?.steps?.length) {
        txs = prepared.bundle.steps.map(toPreparedTx).filter(Boolean);
      } else {
        // Fallback: legacy format { data: { supply/redeem/borrow/repay, approve? } }
        const data = prepared?.data;
        if (!data) throw new Error('Failed to prepare transaction.');
        const approveTx = toPreparedTx(data.approve);
        const actionTx  = toPreparedTx(data.supply ?? data.redeem ?? data.borrow ?? data.repay);
        txs = [approveTx, actionTx].filter(Boolean);
      }

      if (txs.length === 0) throw new Error('No valid transaction payload from backend.');

      const stepLabels = txs.length > 1 ? ['Approve', actionLabel] : [actionLabel];
      setTxSteps(stepLabels.map((label, index) => ({
        id:      `step-${index}-${label.toLowerCase()}`,
        label,
        stage:   'queued' as LendingTxStepStage,
        txHash:  null,
        to:      txs[index]?.to ?? null,
        data:    txs[index]?.data ?? null,
        chainId: MOONWELL_CHAIN_ID,
      })));

      // Detect MetaMask to apply STX-aware timeouts and messaging.
      // MetaMask Smart Transactions (STX) can cancel ERC-20 approves to unknown contracts
      // before broadcasting, causing "Transaction canceled" without user action.
      const injectedEth = typeof window !== 'undefined' ? (window as Window & { ethereum?: Record<string, unknown> }).ethereum : null;
      const isMetaMask = !!(
        injectedEth?.isMetaMask ||
        (Array.isArray((injectedEth as Record<string, unknown> & { providers?: unknown[] })?.providers) &&
         ((injectedEth as Record<string, unknown> & { providers?: unknown[] })?.providers as unknown[])
           ?.some((p: unknown) => (p as Record<string, unknown>)?.isMetaMask))
      );
      const hasApproveStep = txs.some((tx: Record<string, unknown>) =>
        typeof tx?.data === 'string' && (tx.data as string).startsWith('0x095ea7b3')
      );
      if (isMetaMask && hasApproveStep) {
        setTxWarning(
          'MetaMask detected: if the approval is cancelled, open MetaMask → Settings → Advanced → Smart Transactions → turn Off, then retry.'
        );
      }

      const markStep = (index: number, patch: Partial<TxStep>) => {
        setTxSteps((prev) => prev.map((s, i) => i === index ? { ...s, ...patch } : s));
      };

      const executeAndConfirm = async (
        tx: any,
        label: string,
        index: number,
      ): Promise<{ hash: string; outcome: 'confirmed' | 'timeout' }> => {
        let submittedHash: string | null = null;
        try {
          setTxStage('awaiting_wallet');
          markStep(index, { stage: 'awaiting_wallet' });

          const execResult = typeof (lendingApi as any).executeTransactionWithStatus === 'function'
            ? await (lendingApi as any).executeTransactionWithStatus(tx)
            : { transactionHash: await lendingApi.executeTransaction(tx), confirmed: false };

          const hash = execResult.transactionHash;
          const confirmedByWallet = execResult.confirmed === true;
          submittedHash = hash;
          setTxHashes((prev) => [...prev, hash]);
          setTxStage(confirmedByWallet ? 'confirmed' : 'pending');
          markStep(index, { stage: confirmedByWallet ? 'confirmed' : 'pending', txHash: hash });

          if (tracker) {
            try {
              const type = typeof tx?.data === 'string' && tx.data.startsWith('0x095ea7b3')
                ? 'approval'
                : index === stepLabels.length - 1 ? 'lend' : 'other';
              await tracker.addTxHash(hash, MOONWELL_CHAIN_ID, type);
              if (index === 0) { await tracker.markSubmitted(); await tracker.markPending(); }
            } catch (e) { console.warn('[MOONWELL] Tracking update failed:', e); }
          }

          if (confirmedByWallet) return { hash, outcome: 'confirmed' };

          const isApproval = typeof tx?.data === 'string' && tx.data.startsWith('0x095ea7b3');

          // For MetaMask users: use a 45-second timeout for approve transactions.
          // Base produces 2-second blocks, so a genuine approve confirms in <20 seconds.
          // MetaMask Smart Transactions (STX) may cancel approves to unknown contracts
          // silently (Blockaid security) — the tx is never broadcast and will never
          // confirm. 45 seconds is enough to distinguish confirmed from STX-cancelled.
          // For non-MetaMask wallets keep 3 minutes (conservative).
          const approveTimeoutMs = isApproval && isMetaMask ? 45_000 : 3 * 60_000;
          const receipt = isApproval
            ? await waitForEvmReceipt({
                clientId: THIRDWEB_CLIENT_ID,
                chainId: MOONWELL_CHAIN_ID,
                txHash: hash,
                timeoutMs: approveTimeoutMs,
                pollIntervalMs: 2_500,
                shouldContinue: () => isMountedRef.current,
                tracking: { fromAddress: account?.address, to: tx?.to, data: tx?.data },
              })
            : await waitForReceipt(hash, { to: tx?.to, data: tx?.data });
          const resolvedHash = typeof receipt.txHash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(receipt.txHash)
            ? receipt.txHash : hash;
          if (resolvedHash !== hash) {
            setTxHashes((prev) => prev.map((h) => h === hash ? resolvedHash : h));
            markStep(index, { txHash: resolvedHash });
          }
          if (receipt.outcome === 'reverted') { markStep(index, { stage: 'failed' }); throw new Error(`${label} transaction reverted on-chain.`); }
          if (receipt.outcome === 'timeout' || receipt.outcome === 'cancelled') { markStep(index, { stage: 'timeout' }); return { hash: resolvedHash, outcome: 'timeout' }; }
          markStep(index, { stage: 'confirmed' });
          return { hash: resolvedHash, outcome: 'confirmed' };
        } catch (error) {
          if (submittedHash) markStep(index, { stage: 'failed', txHash: submittedHash });
          else markStep(index, { stage: 'failed' });
          throw error;
        }
      };

      let hasTimeout = false;
      for (let i = 0; i < txs.length; i++) {
        const result = await executeAndConfirm(txs[i], stepLabels[i] ?? `Step ${i + 1}`, i);
        if (result.outcome === 'timeout') {
          const isApprovalStep = typeof txs[i]?.data === 'string' && txs[i].data.startsWith('0x095ea7b3');
          if (isApprovalStep && isMetaMask) {
            // MetaMask STX cancels approves to unlisted contracts silently.
            // Throw so the UI shows a clear error with actionable instructions.
            throw new Error(
              'MetaMask Smart Transactions cancelled your approval. ' +
              'To fix: open MetaMask → Settings → Advanced → Smart transactions → turn Off, then retry.'
            );
          }
          hasTimeout = true;
          setTxStage('timeout');
          setTxWarning(
            isApprovalStep
              ? `Approval timed out. If MetaMask shows "Transaction canceled", disable Smart Transactions in MetaMask → Settings → Advanced → Smart Transactions, then retry.`
              : `${stepLabels[i]} was submitted but confirmation is still pending. Wait, then use Try again or Refresh.`
          );
          if (tracker) { try { await tracker.markPending(); } catch {} }
          break;
        }
        // After a confirmed non-final step (typically the approve), wait briefly so that
        // the RPC node MetaMask uses to simulate the next transaction has indexed the
        // on-chain state change. Without this, MetaMask Smart Transaction may see the
        // stale pre-approve allowance and cancel the execute step.
        if (i < txs.length - 1) {
          await new Promise((r) => setTimeout(r, 4_000));
        }
      }

      if (!hasTimeout) {
        setTxStage('confirmed');
        if (tracker) { try { await tracker.markConfirmed(previewHuman || opAmount); } catch {} }
        void fetchPosition();
        lendingApi.getTransactionHistory(10).then(setTxHistory).catch(() => {});
      }
    } catch (e) {
      const rawMsg = e instanceof Error ? e.message : 'Transaction failed';
      const is429 = /429|rate.?limit/i.test(rawMsg);
      if (is429) rateLimit.trigger(parseRetryAfter(e));
      const mappedMsg = mapError(e, rawMsg);
      if (tracker) {
        try {
          if (/submitted|pending|timeout/i.test(rawMsg)) await tracker.markPending();
          else await tracker.markFailed('LENDING_TX_FAILED', mappedMsg);
        } catch {}
      }
      setTxError(mappedMsg);
      setTxStage('failed');
    } finally {
      txActionInFlightRef.current = false;
    }
  }, [account, actionLabel, activeAction, activeMarket, activePositionRow, amount, canReview, fetchPosition, flow, lendingApi, mode, previewHuman, rateLimit, waitForReceipt]);

  // Timeout auto-sync watcher
  useEffect(() => {
    if (txStage !== 'timeout') { timeoutSyncHashRef.current = null; return; }
    let timeoutStepIndex = -1;
    for (let i = txSteps.length - 1; i >= 0; i--) {
      if (txSteps[i]?.stage === 'timeout' && txSteps[i]?.txHash) { timeoutStepIndex = i; break; }
    }
    const timeoutStep = timeoutStepIndex >= 0 ? txSteps[timeoutStepIndex] : null;
    const candidateHash = timeoutStep?.txHash || txHashes[txHashes.length - 1] || null;
    if (!candidateHash || timeoutSyncHashRef.current === candidateHash) return;
    timeoutSyncHashRef.current = candidateHash;
    let cancelled = false;

    const sync = async () => {
      try {
        const receipt = await waitForEvmReceipt({
          clientId: THIRDWEB_CLIENT_ID,
          chainId: MOONWELL_CHAIN_ID,
          txHash: candidateHash,
          timeoutMs: 45 * 60_000,
          pollIntervalMs: 4_000,
          shouldContinue: () => isMountedRef.current && !cancelled && txStage === 'timeout',
          tracking: { fromAddress: account?.address, to: timeoutStep?.to ?? null, data: timeoutStep?.data ?? null },
        });
        if (cancelled || !isMountedRef.current) return;
        const resolvedHash = typeof receipt.txHash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(receipt.txHash) ? receipt.txHash : candidateHash;
        if (resolvedHash !== candidateHash) {
          setTxHashes((prev) => prev.map((h) => h === candidateHash ? resolvedHash : h));
          setTxSteps((prev) => prev.map((s) => s.txHash === candidateHash ? { ...s, txHash: resolvedHash } : s));
        }
        if (receipt.outcome === 'confirmed') {
          if (timeoutStepIndex >= 0) setTxSteps((prev) => prev.map((s, i) => i === timeoutStepIndex ? { ...s, txHash: resolvedHash, stage: 'confirmed' } : s));
          const hasQueued = timeoutStepIndex >= 0 && txSteps.some((s, i) => i > timeoutStepIndex && s.stage === 'queued');
          if (hasQueued) { setTxWarning('Confirmed. Click Try again to send the remaining step.'); return; }
          setTxWarning(null); setTxError(null); setTxStage('confirmed');
          void fetchPosition();
          lendingApi.getTransactionHistory(10).then(setTxHistory).catch(() => {});
          return;
        }
        if (receipt.outcome === 'reverted') {
          if (timeoutStepIndex >= 0) setTxSteps((prev) => prev.map((s, i) => i === timeoutStepIndex ? { ...s, stage: 'failed' } : s));
          setTxError('Transaction reverted on-chain after submission.');
          setTxStage('failed');
        }
      } catch (err) { console.warn('[MOONWELL] Timeout sync failed:', err); }
    };
    void sync();
    return () => { cancelled = true; };
  }, [account?.address, fetchPosition, lendingApi, txHashes, txStage, txSteps]);

  const isMobile = useIsMobileBreakpoint();

  const healthLabel = useMemo(() => {
    const liq = userPosition?.liquidity;
    if (!liq) return { text: '--', tone: 'zinc' as const };
    const shortfall = safeParseBigInt(liq.shortfall) || 0n;
    if (shortfall > 0n) return { text: 'Shortfall', tone: 'red' as const };
    return liq.isHealthy ? { text: 'Healthy', tone: 'green' as const } : { text: 'At risk', tone: 'yellow' as const };
  }, [userPosition?.liquidity]);

  const latestTxHash = useMemo(() => {
    for (let i = txSteps.length - 1; i >= 0; i--) {
      const h = txSteps[i]?.txHash;
      if (h) return h;
    }
    return txHashes.length ? txHashes[txHashes.length - 1] : null;
  }, [txHashes, txSteps]);

  const positionWarning = !dataError && Array.isArray(userPosition?.warnings) && userPosition.warnings.length > 0
    ? userPosition.warnings[0]
    : null;

  const header = viewState === 'input' ? (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex items-center gap-2 flex-1">
        <Landmark className="w-5 h-5 text-blue-400" />
        <div>
          <h2 className="text-lg font-display font-bold text-white">Lending</h2>
          <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Moonwell · Base</div>
        </div>
      </div>
      <button onClick={onClose} className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-500 hover:text-white active:text-white hover:bg-white/10 active:bg-white/20 rounded-full transition-colors">
        <X className="w-5 h-5" />
      </button>
    </div>
  ) : viewState === 'review' ? (
    <div className="flex items-center gap-3 px-4 py-3">
      <button onClick={() => setViewState('input')} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h2 className="text-lg font-display font-bold text-white flex-1">Confirm {actionLabel.toLowerCase()}</h2>
      <button onClick={onClose} className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-500 hover:text-white active:text-white hover:bg-white/10 active:bg-white/20 rounded-full transition-colors">
        <X className="w-5 h-5" />
      </button>
    </div>
  ) : null;

  const infoPopupCopy: Record<LendingInfoPopup, { title: string; body: string }> = {
    risk: {
      title: 'Lending risk',
      body: 'Borrowing and collateral withdrawals can lower account health. If health falls too far, positions may be liquidated.',
    },
    flow: {
      title: 'Execution flow',
      body: 'This action may use two transactions: an ERC20 approve and the lending action itself. Confirm each step in your wallet.',
    },
    pending: {
      title: 'Pending confirmation',
      body: 'Wallet approval only broadcasts the transaction. Final confirmation depends on Base network inclusion.',
    },
    steps: {
      title: 'Step details',
      body: 'Approve grants the lending contract allowance. The action step executes supply, withdraw, borrow, or repay.',
    },
  };

  return (
    <>
      <DefiWidgetModalShell
        dataTour="widget-moonwell-lending"
        onClose={onClose}
        variant={variant}
        isMobile={isMobile}
        header={header}
        footer={(
          <div className="py-8 flex items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
            <img
              src="https://assets.coingecko.com/coins/images/26111/small/moonwell-logo.png"
              alt="Moonwell"
              className="w-8 h-8 rounded-full"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span className="text-sm font-medium text-zinc-400">Powered by Moonwell</span>
          </div>
        )}
        cardClassName="md:min-h-[540px]"
        bodyClassName="custom-scrollbar"
      >
        <AnimatePresence mode="wait">
          {viewState === 'input' && (
            <>
            <LendingInputView
              activeAction={activeAction}
              onSelectAction={setActiveAction}
              inputLabel={inputLabel}
              amount={amount}
              balanceLabel={balanceLabel}
              maxHuman={maxHuman}
              onSetAmount={setAmount}
              onOpenTokenList={() => {}}
              secondaryLabel={secondaryLabel}
              previewHuman={previewHuman}
              actionLabel={actionLabel}
              mode={mode}
              formatAPY={formatAPY}
              supplyApy={activeMarket?.supplyAPY}
              borrowApy={activeMarket?.borrowAPY}
              isRateLimited={rateLimit.isLimited}
              rateLimitRemaining={rateLimit.remaining}
              dataError={dataError}
              positionWarning={positionWarning}
              hasAccount={!!account}
              onRefreshPosition={refresh}
              suppliedAmount={activeMarket ? formatAmountHuman(suppliedWei, activeMarket.decimals ?? 18, 6) : '--'}
              borrowedAmount={activeMarket ? formatAmountHuman(borrowedWei, activeMarket.decimals ?? 18, 6) : '--'}
              qTokenAmount={formatAmountHuman(qTokenBalanceWei, qTokenDecimals, 6)}
              qTokenSymbol={activeQTokenSymbol}
              healthTone={healthLabel.tone}
              healthText={healthLabel.text}
              showHistory={historyOpen}
              onToggleHistory={() => setHistoryOpen((v) => !v)}
              historyLoading={historyLoading}
              txHistory={txHistory}
              getExplorerTxUrl={getExplorerTxUrl}
              canReview={canReview}
              loadingData={loadingData}
              hasActiveMarket={!!activeMarket}
              onContinue={() => setViewState('review')}
              tokenSymbol={activeMarket?.symbol ?? '--'}
              tokenIcon={activeMarket?.icon}
              tokenOptions={tokenOptions}
              onSelectToken={(symbol) => {
                const found = tokens.find((t) => t.symbol === symbol);
                if (found) {
                  setActiveMarket(found);
                  setAmount('');
                  lastAutoFilledActionRef.current = null;
                }
              }}
            />

            {/* Recovery banner — only for WETH market on withdraw tab */}
            {activeMarket?.qTokenSymbol === 'mWETH' && mode === 'supply' && flow === 'close' && !recoverEthHash && (
              <div className="mx-4 mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm">
                <p className="text-yellow-300 font-medium mb-1">ETH stuck in proxy?</p>
                <p className="text-yellow-200/70 text-xs mb-2">
                  If a previous withdraw failed without returning ETH, use this button to recover it as native ETH.
                </p>
                {recoverEthError && <p className="text-red-400 text-xs mb-2">{recoverEthError}</p>}
                <button
                  onClick={handleRecoverEth}
                  disabled={recoverEthLoading || !account}
                  className="w-full rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 py-2 text-yellow-200 text-xs font-medium disabled:opacity-50 transition-colors"
                >
                  {recoverEthLoading ? 'Recovering...' : 'Recover stuck ETH'}
                </button>
              </div>
            )}
            {recoverEthHash && activeMarket?.qTokenSymbol === 'mWETH' && (
              <div className="mx-4 mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm">
                <p className="text-green-300 font-medium">ETH recovered!</p>
                <a href={`https://basescan.org/tx/${recoverEthHash}`} target="_blank" rel="noreferrer" className="text-green-400/70 text-xs underline">
                  View on Basescan
                </a>
              </div>
            )}
            </>
          )}

          {viewState === 'review' && (
            <LendingReviewView
              actionLabel={actionLabel}
              amount={amount}
              secondaryLabel={secondaryLabel}
              previewHuman={previewHuman}
              symbol={activeMarket?.symbol ?? '--'}
              txError={txError}
              isRateLimited={rateLimit.isLimited}
              rateLimitRemaining={rateLimit.remaining}
              txStage={txStage}
              riskHint={reviewRiskHint}
              onOpenFlowInfo={() => setInfoPopup('flow')}
              onOpenRiskInfo={() => setInfoPopup('risk')}
              onConfirm={handlePrepareAndExecute}
            />
          )}

          {viewState === 'status' && (
            <LendingStatusView
              txStage={txStage}
              txError={txError}
              txWarning={txWarning}
              latestTxHash={latestTxHash}
              txHashes={txHashes}
              txSteps={txSteps}
              getExplorerTxUrl={getExplorerTxUrl}
              onOpenPendingInfo={() => setInfoPopup('pending')}
              onOpenStepsInfo={() => setInfoPopup('steps')}
              onClose={onClose}
              onRetry={() => {
                setViewState('review'); setTxStage('idle');
                setTxError(null); setTxWarning(null);
                setTxHashes([]); setTxSteps([]);
              }}
            />
          )}
        </AnimatePresence>

        {infoPopup && (
          <div className="absolute inset-0 z-40 bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div className="w-full max-w-[360px] rounded-xl border border-white/10 bg-[#0b0d10] p-4 space-y-3">
              <div className="text-sm font-semibold text-white">{infoPopupCopy[infoPopup].title}</div>
              <p className="text-xs text-zinc-300 leading-relaxed">{infoPopupCopy[infoPopup].body}</p>
              <button type="button" onClick={() => setInfoPopup(null)} className="w-full py-2.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-sm font-medium transition-colors">
                Got it
              </button>
            </div>
          </div>
        )}
      </DefiWidgetModalShell>

    </>
  );
}
