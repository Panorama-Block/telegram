import { motion, AnimatePresence } from "framer-motion";
import {
  Landmark,
  X,
  ArrowLeft,
  Check,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  RefreshCcw,
  Loader2,
  ChevronDown,
  Clock
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DataInput } from "@/components/ui/DataInput";
import { TokenSelectionModal } from "@/components/TokenSelectionModal";
import { cn } from "@/lib/utils";
import { useLendingData } from "@/features/lending/useLendingData";
import { useLendingApi } from "@/features/lending/api";
import type { LendingAccountPositionRow, LendingToken } from "@/features/lending/types";
import { formatAmountHuman, parseAmountToWei } from "@/features/swap/utils";
import { THIRDWEB_CLIENT_ID } from "@/shared/config/thirdweb";
import { waitForEvmReceipt } from "@/shared/utils/evmReceipt";
import { useRateLimitCountdown, parseRetryAfter } from "@/shared/hooks/useRateLimitCountdown";
import { mapError } from "@/shared/lib/errorMapper";
import { useActiveAccount } from "thirdweb/react";
import {
  canRetryLendingTx,
  getLendingStepStatusClass,
  getLendingStepStatusLabel,
  type LendingTxStage,
  type LendingTxStepStage,
} from "@/components/lending/lendingTxState";

// Feature flags
import { FEATURE_FLAGS, FEATURE_METADATA } from "@/config/features";

type ViewState = 'input' | 'review' | 'status';
type Mode = 'supply' | 'borrow';
type Flow = 'open' | 'close'; // open=supply/borrow, close=withdraw/repay
type LendingActionType = 'supply' | 'withdraw' | 'borrow' | 'repay';

type TxStep = {
  id: string;
  label: string;
  stage: LendingTxStepStage;
  txHash: string | null;
};

interface LendingProps {
  onClose: () => void;
  initialAmount?: string | number;
  initialAsset?: string;
  initialMode?: Mode;
  initialFlow?: Flow;
  variant?: 'modal' | 'panel';
}

function safeParseBigInt(value: string | null | undefined): bigint | null {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function normalizeInitialAmount(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  const trimmed = String(raw).trim();
  if (!trimmed) return undefined;
  return trimmed;
}

function isValidAmountInput(value: string): boolean {
  if (value === '') return true;
  return /^(\d+(\.\d*)?|\.\d*)$/.test(value);
}

function formatAPY(apy: number | null | undefined): string {
  if (apy == null || !Number.isFinite(apy)) return '--';
  return `${apy.toFixed(2)}%`;
}

function getExplorerTxUrl(chainId: number, txHash: string): string {
  if (chainId === 43114) return `https://snowtrace.io/tx/${txHash}`;
  return `https://snowtrace.io/tx/${txHash}`;
}

export function Lending({
  onClose,
  initialAmount,
  initialAsset,
  initialMode,
  initialFlow,
  variant = 'modal',
}: LendingProps) {
  const account = useActiveAccount();
  const lendingApi = useLendingApi();
  const {
    tokens,
    userPosition,
    loading: loadingData,
    error: dataError,
    refresh,
    fetchPosition,
  } = useLendingData();

  const [viewState, setViewState] = useState<ViewState>('input');
  const [mode, setMode] = useState<Mode>(initialMode ?? 'supply');
  const [flow, setFlow] = useState<Flow>(initialFlow ?? 'open');

  const [showTokenList, setShowTokenList] = useState(false);
  const [activeMarket, setActiveMarket] = useState<LendingToken | null>(null);

  const [amount, setAmount] = useState<string>(normalizeInitialAmount(initialAmount) ?? '');

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
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const effectiveAddress = account?.address ?? null;

  // Initialize selected market when tokens load.
  useEffect(() => {
    if (activeMarket || tokens.length === 0) return;
    const bySymbol = initialAsset
      ? tokens.find((t) => t.symbol.toUpperCase() === initialAsset.toUpperCase())
      : null;
    setActiveMarket(bySymbol ?? tokens[0]);
  }, [activeMarket, initialAsset, tokens]);

  // Fetch wallet balance for the selected underlying asset.
  useEffect(() => {
    if (!THIRDWEB_CLIENT_ID || !effectiveAddress || !activeMarket) {
      setWalletBalanceWei(null);
      setWalletBalanceHuman(null);
      return;
    }

    let cancelled = false;
    setLoadingBalance(true);

    const fetchBalance = async () => {
      try {
        const { createThirdwebClient, getContract, defineChain } = await import("thirdweb");
        const { getBalance } = await import("thirdweb/extensions/erc20");
        const { eth_getBalance, getRpcClient } = await import("thirdweb/rpc");

        const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
        const chainId = 43114;
        const tokenAddress = (activeMarket.address || '').toLowerCase();
        const isNative =
          !tokenAddress ||
          tokenAddress === 'native' ||
          tokenAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
          tokenAddress === '0x0000000000000000000000000000000000000000';

        let balance: bigint;
        let decimals = activeMarket.decimals ?? 18;
        if (isNative) {
          const rpc = getRpcClient({ client, chain: defineChain(chainId) });
          balance = await eth_getBalance(rpc, { address: effectiveAddress as `0x${string}` });
        } else {
          const tokenContract = getContract({
            client,
            chain: defineChain(chainId),
            address: activeMarket.address as `0x${string}`,
          });
          const res = await getBalance({ contract: tokenContract, address: effectiveAddress as `0x${string}` });
          balance = res.value;
          decimals = res.decimals;
        }

        if (cancelled) return;
        setWalletBalanceWei(balance);
        setWalletBalanceHuman(formatAmountHuman(balance, decimals, 6));
      } catch (e) {
        console.warn('[LENDING] Failed to fetch wallet balance:', e);
        if (!cancelled) {
          setWalletBalanceWei(null);
          setWalletBalanceHuman(null);
        }
      } finally {
        if (!cancelled) setLoadingBalance(false);
      }
    };

    fetchBalance();
    return () => {
      cancelled = true;
    };
  }, [activeMarket, effectiveAddress]);

  useEffect(() => {
    if (!historyOpen || !effectiveAddress) return;
    let cancelled = false;
    setHistoryLoading(true);
    lendingApi
      .getTransactionHistory(10)
      .then((txs) => {
        if (!cancelled) setTxHistory(txs);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [historyOpen, effectiveAddress, lendingApi]);

  const activePositionRow = useMemo<LendingAccountPositionRow | null>(() => {
    if (!activeMarket) return null;
    const rows = userPosition?.positions || [];
    const addr = activeMarket.qTokenAddress?.toLowerCase();
    if (!addr) return null;
    return rows.find((r) => (r.qTokenAddress || '').toLowerCase() === addr) || null;
  }, [activeMarket, userPosition?.positions]);

  const suppliedWei = useMemo(() => {
    const v = activePositionRow?.suppliedWei;
    return safeParseBigInt(v) ?? 0n;
  }, [activePositionRow?.suppliedWei]);

  const borrowedWei = useMemo(() => {
    const v = activePositionRow?.borrowedWei;
    return safeParseBigInt(v) ?? 0n;
  }, [activePositionRow?.borrowedWei]);

  const qTokenBalanceWei = useMemo(() => {
    const v = activePositionRow?.qTokenBalanceWei;
    return safeParseBigInt(v) ?? 0n;
  }, [activePositionRow?.qTokenBalanceWei]);

  const qTokenDecimals = useMemo(() => {
    const v = activePositionRow?.qTokenDecimals;
    return Number.isFinite(v) ? Number(v) : 8;
  }, [activePositionRow?.qTokenDecimals]);

  const activeQTokenSymbol = useMemo(() => {
    return activePositionRow?.qTokenSymbol || activeMarket?.qTokenSymbol || 'qToken';
  }, [activeMarket?.qTokenSymbol, activePositionRow?.qTokenSymbol]);

  const positionMaxWei = useMemo(() => {
    if (!activeMarket) return 0n;
    if (mode === 'supply' && flow === 'close') return suppliedWei;
    if (mode === 'borrow' && flow === 'close') return borrowedWei;
    return 0n;
  }, [activeMarket, borrowedWei, flow, mode, suppliedWei]);

  const amountWei = useMemo(() => {
    if (!activeMarket) return null;
    if (!amount) return null;
    if (!isValidAmountInput(amount)) return null;
    try {
      return parseAmountToWei(amount, activeMarket.decimals ?? 18);
    } catch {
      return null;
    }
  }, [activeMarket, amount]);

  const previewHuman = useMemo(() => {
    if (!activeMarket || amountWei == null) return '';
    return formatAmountHuman(amountWei, activeMarket.decimals ?? 18, 6);
  }, [activeMarket, amountWei]);

  const maxHuman = useMemo(() => {
    if (!activeMarket) return null;
    const decimals = activeMarket.decimals ?? 18;

    if (flow === 'open') {
      // Borrowing does not depend on current wallet balance (it's limited by collateral/health).
      if (mode === 'borrow') return null;
      if (walletBalanceWei == null) return null;
      return formatAmountHuman(walletBalanceWei, decimals, 6);
    }

    return formatAmountHuman(positionMaxWei, decimals, 6);
  }, [activeMarket, flow, mode, positionMaxWei, walletBalanceWei]);

  const canReview = useMemo(() => {
    if (!activeMarket) return false;
    if (!amountWei || amountWei <= 0n) return false;
    if (flow === 'open') {
      if (mode === 'borrow') return true;
      return walletBalanceWei == null ? true : amountWei <= walletBalanceWei;
    }
    return amountWei <= positionMaxWei;
  }, [activeMarket, amountWei, flow, mode, walletBalanceWei, positionMaxWei]);

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

  const setActiveAction = useCallback((action: LendingActionType) => {
    if (action === 'supply') {
      setMode('supply');
      setFlow('open');
      return;
    }
    if (action === 'withdraw') {
      setMode('supply');
      setFlow('close');
      return;
    }
    if (action === 'borrow') {
      setMode('borrow');
      setFlow('open');
      return;
    }
    setMode('borrow');
    setFlow('close');
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
    const base = positionMaxWei;
    const human = formatAmountHuman(base, decimals, 6);
    return `Available: ${human} ${sym}`;
  }, [activeMarket, flow, loadingBalance, mode, positionMaxWei, walletBalanceHuman]);

  const uiTokens = useMemo(() => {
    return tokens.map((t) => ({
      ticker: t.symbol,
      name: t.symbol,
      network: "Avalanche",
      address: t.address,
      qTokenAddress: t.qTokenAddress,
      qTokenSymbol: t.qTokenSymbol,
      balance: "--",
      icon: t.icon,
      supplyAPY: t.supplyAPY,
      borrowAPY: t.borrowAPY,
      decimals: t.decimals,
    }));
  }, [tokens]);

  const resetTxUi = useCallback(() => {
    setTxError(null);
    setTxWarning(null);
    setTxHashes([]);
    setTxSteps([]);
    setTxStage('idle');
  }, []);

  useEffect(() => {
    if (viewState === 'input') resetTxUi();
  }, [resetTxUi, viewState]);

  const waitForReceipt = useCallback(async (
    hash: string,
    tracking?: { to?: string | null; data?: string | null }
  ) => {
    return await waitForEvmReceipt({
      clientId: THIRDWEB_CLIENT_ID,
      chainId: 43114,
      txHash: hash,
      pollIntervalMs: 2_500,
      shouldContinue: () => isMountedRef.current,
      tracking: {
        fromAddress: account?.address,
        to: tracking?.to,
        data: tracking?.data,
      },
    });
  }, [account?.address]);

  const handlePrepareAndExecute = useCallback(async () => {
    if (!activeMarket || !amount || !canReview) return;
    if (!account) {
      setTxError('Connect an EVM wallet to continue.');
      return;
    }

    setTxError(null);
    setTxWarning(null);
    setTxStage('awaiting_wallet');
    setTxHashes([]);
    setViewState('status');

    try {
      const decimals = activeMarket.decimals ?? 18;
      const qTokenAddress = activeMarket.qTokenAddress;
      const opAmount = amount;

      const prepared = await (async () => {
        if (mode === 'supply' && flow === 'open') return await lendingApi.prepareSupply(qTokenAddress, opAmount, decimals);
        if (mode === 'supply' && flow === 'close') return await lendingApi.prepareWithdraw(qTokenAddress, opAmount, decimals);
        if (mode === 'borrow' && flow === 'open') return await lendingApi.prepareBorrow(qTokenAddress, opAmount, decimals);
        return await lendingApi.prepareRepay(qTokenAddress, opAmount, decimals);
      })();

      const data = prepared?.data;
      if (!data) throw new Error('Failed to prepare transaction.');

      const validationTx = data.validation;
      const actionTx = data.supply || data.withdraw || data.borrow || data.repay;

      const toPreparedTx = (txLike: any) => {
        if (!txLike?.to || !txLike?.data) return null;
        return {
          to: txLike.to,
          data: txLike.data,
          value: txLike.value || '0',
          gasLimit: txLike.gasLimit || txLike.gas,
          gasPrice: txLike.gasPrice,
          chainId: 43114,
        };
      };

      const txs = [toPreparedTx(validationTx), toPreparedTx(actionTx)].filter(Boolean) as any[];
      if (txs.length === 0) throw new Error('No valid transaction payload from backend.');

      const stepLabels = txs.length > 1 ? ['Validation', actionLabel] : [actionLabel];
      setTxSteps(
        stepLabels.map((label, index) => ({
          id: `step-${index}-${label.toLowerCase()}`,
          label,
          stage: 'queued',
          txHash: null,
        }))
      );

      const markStep = (index: number, patch: Partial<TxStep>) => {
        setTxSteps((prev) => prev.map((step, i) => (i === index ? { ...step, ...patch } : step)));
      };

      const executeAndConfirm = async (
        tx: any,
        label: string,
        index: number
      ): Promise<{ hash: string; outcome: 'confirmed' | 'timeout' }> => {
        let submittedHash: string | null = null;
        try {
          setTxStage('awaiting_wallet');
          markStep(index, { stage: 'awaiting_wallet' });

          const hash = await lendingApi.executeTransaction(tx);
          submittedHash = hash;
          setTxHashes((prev) => [...prev, hash]);
          setTxStage('pending');
          markStep(index, { stage: 'pending', txHash: hash });

          const receipt = await waitForReceipt(hash, {
            to: tx?.to,
            data: tx?.data,
          });
          const resolvedHash =
            typeof receipt.txHash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(receipt.txHash)
              ? receipt.txHash
              : hash;

          if (resolvedHash !== hash) {
            setTxHashes((prev) => prev.map((h) => (h === hash ? resolvedHash : h)));
            markStep(index, { txHash: resolvedHash });
          }

          if (receipt.outcome === 'reverted') {
            markStep(index, { stage: 'failed' });
            throw new Error(`${label} transaction reverted on-chain.`);
          }
          if (receipt.outcome === 'timeout' || receipt.outcome === 'cancelled') {
            markStep(index, { stage: 'timeout' });
            return { hash: resolvedHash, outcome: 'timeout' };
          }

          markStep(index, { stage: 'confirmed' });
          return { hash: resolvedHash, outcome: 'confirmed' };
        } catch (error) {
          if (submittedHash) {
            markStep(index, { stage: 'failed', txHash: submittedHash });
          } else {
            markStep(index, { stage: 'failed' });
          }
          throw error;
        }
      };

      let hasTimeout = false;
      for (let index = 0; index < txs.length; index++) {
        const tx = txs[index];
        const label = stepLabels[index] ?? `Step ${index + 1}`;
        const result = await executeAndConfirm(tx, label, index);
        if (result.outcome === 'timeout') {
          hasTimeout = true;
          setTxStage('timeout');
          const extraHint = label === 'Validation'
            ? ' If this later confirms in your wallet, do not retry immediately to avoid a duplicate validation fee.'
            : '';
          setTxWarning(
            `${label} transaction was submitted, but confirmation is still pending on-chain. Wait a moment, then use Try again or Refresh.${extraHint}`
          );
          break;
        }
      }

      if (!hasTimeout) {
        setTxStage('confirmed');
        void fetchPosition();
        // Refresh history so the new tx shows up
        lendingApi.getTransactionHistory(10).then(setTxHistory).catch(() => {});
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Transaction failed';
      const is429 = /429|rate.?limit/i.test(message);
      if (is429) {
        rateLimit.trigger(parseRetryAfter(e));
      }
      setTxError(mapError(e, message));
      setTxStage('failed');
    }
  }, [account, actionLabel, activeMarket, amount, canReview, fetchPosition, flow, lendingApi, mode, rateLimit, waitForReceipt]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const modalVariants = {
    initial: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
    animate: isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 },
    exit: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
  };

  const healthLabel = useMemo(() => {
    const liq = userPosition?.liquidity;
    if (!liq) return { text: '--', tone: 'zinc' as const };
    const shortfall = safeParseBigInt(liq.shortfall) || 0n;
    if (shortfall > 0n) return { text: 'Shortfall', tone: 'red' as const };
    return liq.isHealthy ? { text: 'Healthy', tone: 'green' as const } : { text: 'At risk', tone: 'yellow' as const };
  }, [userPosition?.liquidity]);

  const latestTxHash = useMemo(() => {
    if (txSteps.length > 0) {
      for (let index = txSteps.length - 1; index >= 0; index--) {
        const candidate = txSteps[index]?.txHash;
        if (candidate) return candidate;
      }
    }
    if (!txHashes.length) return null;
    return txHashes[txHashes.length - 1];
  }, [txHashes, txSteps]);

  const card = (
    <GlassCard className="w-full shadow-2xl overflow-hidden relative bg-[#0A0A0A] border-white/10 max-h-[78vh] md:max-h-[85vh] md:h-auto md:min-h-[540px] flex flex-col rounded-2xl border pb-safe overflow-y-auto">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-primary/10 blur-[60px] pointer-events-none" />

      <AnimatePresence mode="wait">
        {viewState === 'input' && (
          <motion.div
            key="input"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full"
          >
            <div className="px-6 py-4 flex items-center justify-between relative z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold text-white">Lending</h2>
                  <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                    Benqi · Avalanche
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 pb-8 space-y-2 relative z-10 flex-1 flex flex-col">
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'supply', label: 'Supply' },
                  { key: 'withdraw', label: 'Withdraw' },
                  { key: 'borrow', label: 'Borrow' },
                  { key: 'repay', label: 'Repay' },
                ] as const).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveAction(item.key)}
                    className={`py-2 rounded-xl border transition-colors text-xs font-medium ${
                      activeAction === item.key
                        ? 'bg-primary/15 border-primary/30 text-white'
                        : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <DataInput
                label={inputLabel}
                value={amount}
                balance={balanceLabel}
                onMaxClick={maxHuman ? () => setAmount(maxHuman) : undefined}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!isValidAmountInput(next)) return;
                  setAmount(next);
                }}
                placeholder="0.00"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowTokenList(true)}
                    className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2.5 sm:px-3 py-1.5 sm:py-2 min-h-[40px] sm:min-h-[44px] hover:bg-zinc-900 active:bg-zinc-800 transition-colors group"
                  >
                    {activeMarket?.icon ? (
                      <img src={activeMarket.icon} alt={activeMarket.symbol} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-zinc-700" />
                    )}
                    <span className="text-white font-medium text-sm sm:text-base">{activeMarket?.symbol ?? '--'}</span>
                  </button>
                }
              />

              <div className="mt-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{secondaryLabel}</div>
                <div className="text-white font-mono text-lg">
                  {previewHuman || '0'} {activeMarket?.symbol ?? '--'}
                </div>
              </div>

              <div className="py-2 flex flex-col gap-2 text-xs px-2 mt-2">
                <div className="flex items-center gap-1 text-zinc-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>
                    {actionLabel} · {mode === 'supply' ? `APY ${formatAPY(activeMarket?.supplyAPY)}` : `APY ${formatAPY(activeMarket?.borrowAPY)}`}
                  </span>
                </div>
                {rateLimit.isLimited && (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200 text-[11px] flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Rate limited. Retry in <span className="font-mono font-medium">{rateLimit.remaining}s</span></span>
                  </div>
                )}
                {dataError && (
                  <div className="text-[11px] text-red-400">{dataError}</div>
                )}
                {!dataError && Array.isArray(userPosition?.warnings) && userPosition.warnings.length > 0 && (
                  <div className="text-[11px] text-amber-300">{userPosition.warnings[0]}</div>
                )}
                {!account && (
                  <div className="text-[11px] text-yellow-400">Connect your wallet in the app to use Lending.</div>
                )}
              </div>

              <div className="mt-2 rounded-2xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-white">Position</div>
                  <button
                    type="button"
                    onClick={() => refresh()}
                    className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <RefreshCcw className="w-4 h-4" />
                    Refresh
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-[10px] text-zinc-500 uppercase mb-1">Supplied</div>
                    <div className="text-sm font-mono text-white">
                      {activeMarket ? formatAmountHuman(suppliedWei, activeMarket.decimals ?? 18, 6) : '--'}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">
                      {formatAmountHuman(qTokenBalanceWei, qTokenDecimals, 6)} {activeQTokenSymbol}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-[10px] text-zinc-500 uppercase mb-1">Borrowed</div>
                    <div className="text-sm font-mono text-white">
                      {activeMarket ? formatAmountHuman(borrowedWei, activeMarket.decimals ?? 18, 6) : '--'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-[10px] text-zinc-500 uppercase">Account health</div>
                  <div className={cn(
                    "text-xs font-medium",
                    healthLabel.tone === 'green' && "text-emerald-400",
                    healthLabel.tone === 'yellow' && "text-yellow-400",
                    healthLabel.tone === 'red' && "text-red-400",
                    healthLabel.tone === 'zinc' && "text-zinc-400",
                  )}>
                    {healthLabel.text}
                  </div>
                </div>
              </div>

              {effectiveAddress && (
                <div className="mt-2 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setHistoryOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-white hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-zinc-400" />
                      Recent Activity
                    </div>
                    <ChevronDown className={cn("w-4 h-4 text-zinc-400 transition-transform", historyOpen && "rotate-180")} />
                  </button>
                  {historyOpen && (
                    <div className="px-4 pb-3 space-y-2">
                      {historyLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                        </div>
                      ) : txHistory.length === 0 ? (
                        <div className="text-[11px] text-zinc-500 text-center py-3">No transactions yet</div>
                      ) : (
                        txHistory.map((tx, i) => {
                          const action = (tx.action || 'unknown').toLowerCase();
                          const actionColor =
                            action === 'supply' ? 'text-emerald-400' :
                            action === 'borrow' ? 'text-amber-400' :
                            action === 'repay' ? 'text-blue-400' :
                            action === 'redeem' || action === 'withdraw' ? 'text-purple-400' :
                            'text-zinc-400';
                          const statusDot =
                            tx.status === 'confirmed' ? 'bg-emerald-500' :
                            tx.status === 'pending' ? 'bg-amber-500' :
                            'bg-red-500';
                          const date = tx.createdAt ? new Date(tx.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
                          return (
                            <div key={tx.txId || i} className="flex items-center justify-between py-1.5 border-t border-white/5 first:border-0">
                              <div className="flex items-center gap-2">
                                <span className={cn("w-1.5 h-1.5 rounded-full", statusDot)} />
                                <span className={cn("text-xs font-medium capitalize", actionColor)}>{action}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                                {tx.txHash && (
                                  <a
                                    href={getExplorerTxUrl(tx.chainId || 43114, tx.txHash)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-cyan-400 hover:text-cyan-300 font-mono"
                                  >
                                    {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}
                                  </a>
                                )}
                                {date && <span>{date}</span>}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4">
                <NeonButton
                  onClick={() => setViewState('review')}
                  disabled={!canReview || loadingData || !activeMarket || !account}
                >
                  {actionLabel}
                </NeonButton>
              </div>
            </div>
          </motion.div>
        )}

        {viewState === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full"
          >
            <div className="px-6 py-4 flex items-center justify-between relative z-10 shrink-0">
              <h2 className="text-lg font-display font-bold text-white">Confirm {actionLabel.toLowerCase()}</h2>
              <button onClick={() => setViewState('input')} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 pb-6 flex-1 flex flex-col relative z-10 justify-center gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="font-medium text-white text-sm sm:text-base">
                    {actionLabel} {activeMarket?.symbol ?? '--'}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-zinc-500">Amount</span>
                    <span className="text-white font-mono font-medium text-base sm:text-lg">
                      {amount || '0'} {activeMarket?.symbol ?? ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-zinc-500">{secondaryLabel}</span>
                    <span className="text-white font-mono font-medium">{previewHuman || '--'} {activeMarket?.symbol ?? ''}</span>
                  </div>
                </div>
              </div>

              {txError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <div className="min-w-0">{txError}</div>
                </div>
              )}

              {rateLimit.isLimited && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Rate limited. Retry in <span className="font-mono font-medium">{rateLimit.remaining}s</span></span>
                </div>
              )}

              <div className="pt-2 relative">
                <NeonButton
                  onClick={handlePrepareAndExecute}
                  className={cn("w-full bg-white text-black hover:bg-zinc-200 shadow-none")}
                  disabled={txStage === 'awaiting_wallet' || txStage === 'pending' || rateLimit.isLimited}
                >
                  {rateLimit.isLimited
                    ? `Wait ${rateLimit.remaining}s…`
                    : txStage === 'awaiting_wallet'
                      ? 'Confirming in wallet…'
                      : txStage === 'pending'
                        ? 'Submitting…'
                        : `Confirm ${actionLabel.toLowerCase()}`}
                </NeonButton>
                {(txStage === 'awaiting_wallet' || txStage === 'pending') && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {viewState === 'status' && (
          <motion.div
            key="status"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col h-full items-center justify-center p-6 text-center gap-4"
          >
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center",
              txStage === 'confirmed'
                ? "bg-green-500/20"
                : txStage === 'failed'
                  ? "bg-red-500/20"
                  : txStage === 'timeout'
                    ? "bg-amber-500/20"
                    : "bg-primary/15"
            )}>
              {txStage === 'confirmed' ? (
                <Check className="w-8 h-8 text-green-500" />
              ) : txStage === 'failed' ? (
                <AlertCircle className="w-8 h-8 text-red-400" />
              ) : txStage === 'timeout' ? (
                <AlertCircle className="w-8 h-8 text-amber-400" />
              ) : (
                <Landmark className="w-8 h-8 text-primary" />
              )}
            </div>

            <div className="space-y-1">
              <div className="text-xl font-bold text-white">
                {txStage === 'awaiting_wallet'
                  ? 'Confirm in wallet'
                  : txStage === 'pending'
                    ? 'Pending confirmation'
                    : txStage === 'confirmed'
                      ? 'Confirmed'
                      : txStage === 'timeout'
                        ? 'Submitted'
                        : txStage === 'failed'
                          ? 'Transaction issue'
                          : 'Transaction'}
              </div>
              <div className="text-zinc-400 text-sm">
                {txStage === 'awaiting_wallet'
                  ? 'Approve the transaction in your wallet.'
                  : txStage === 'pending'
                    ? 'Waiting for on-chain confirmation…'
                    : txStage === 'confirmed'
                      ? 'Position will refresh automatically.'
                      : txStage === 'timeout'
                        ? 'Transaction was submitted, but confirmation is still pending.'
                        : txStage === 'failed'
                          ? (txError ?? 'Something went wrong.')
                          : 'Preparing transaction…'}
              </div>
            </div>

            {txWarning && (
              <div className="w-full p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">{txWarning}</div>
              </div>
            )}

            {latestTxHash && (
              <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-left space-y-2">
                <div className="text-xs text-zinc-500 uppercase">Transaction</div>
                <a
                  href={getExplorerTxUrl(43114, latestTxHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
                >
                  <span className="font-mono truncate">{latestTxHash}</span>
                  <ExternalLink className="w-4 h-4 shrink-0" />
                </a>
                {txHashes.length > 1 && (
                  <div className="text-[11px] text-zinc-500">
                    Includes {txHashes.length} on-chain steps (validation + action).
                  </div>
                )}
              </div>
            )}

            {txSteps.length > 0 && (
              <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-left space-y-2">
                <div className="text-xs text-zinc-500 uppercase">Steps</div>
                {txSteps.map((step, index) => (
                  <div key={step.id} className="rounded-lg border border-white/10 bg-black/20 p-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-white">
                        {index + 1}. {step.label}
                      </div>
                      <div className={cn("text-[11px] font-medium", getLendingStepStatusClass(step.stage))}>
                        {getLendingStepStatusLabel(step.stage)}
                      </div>
                    </div>
                    {step.txHash && (
                      <a
                        href={getExplorerTxUrl(43114, step.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 text-[11px] text-cyan-300 hover:text-cyan-200 transition-colors"
                      >
                        <span className="font-mono truncate">{step.txHash}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="w-full space-y-3">
              <NeonButton onClick={onClose}>
                {txStage === 'confirmed' ? 'Done' : 'Close'}
              </NeonButton>

              {canRetryLendingTx(txStage) && (
                <button
                  onClick={() => {
                    setViewState('review');
                    setTxStage('idle');
                    setTxError(null);
                    setTxWarning(null);
                    setTxHashes([]);
                    setTxSteps([]);
                  }}
                  className="w-full py-3 text-zinc-400 hover:text-white transition-colors"
                >
                  Try again
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="py-8 relative z-10 flex items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
        <img src="/miniapp/icons/benqui_logo.png" alt="Benqi" className="w-8 h-8 rounded-full" />
        <span className="text-sm font-medium text-zinc-400">Powered by Benqi</span>
      </div>

      <TokenSelectionModal
        isOpen={showTokenList}
        onClose={() => setShowTokenList(false)}
        onSelect={(token) => {
          // TokenSelectionModal returns a UI token shape; map back to LendingToken by symbol.
          const found = tokens.find((t) => t.symbol === token.ticker);
          if (found) setActiveMarket(found);
          setShowTokenList(false);
        }}
        customTokens={uiTokens}
      />
    </GlassCard>
  );

  if (variant === 'panel') {
    return (
      <div className="w-full max-w-[520px] mx-auto p-4">
        {card}
      </div>
    );
  }

  // Coming Soon State
  if (!FEATURE_FLAGS.LENDING_ENABLED) {
    const metadata = FEATURE_METADATA.lending;
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          variants={modalVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[340px] md:max-w-[400px]"
          onClick={(e) => e.stopPropagation()}
        >
          <GlassCard className="w-full shadow-2xl overflow-hidden relative bg-[#0A0A0A] border-white/10 flex flex-col rounded-2xl border">
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between relative z-10 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Landmark className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Lending</h2>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Coming Soon</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Coming Soon Content - Compact */}
            <div className="px-4 py-5 text-center">
              <div className="mb-4 flex justify-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                    <Clock className="w-7 h-7 text-cyan-400" />
                  </div>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-cyan-400 text-xs font-medium">Coming Soon</span>
              </div>

              <h3 className="text-lg font-bold text-white mb-1.5">{metadata?.name || 'Lending Service'}</h3>
              <p className="text-zinc-400 text-xs leading-relaxed mb-3">{metadata?.description || 'This feature is under development.'}</p>

              {metadata?.expectedLaunch && (
                <p className="text-zinc-500 text-[10px]">Expected: {metadata.expectedLaunch}</p>
              )}
            </div>

            {/* Footer - Only Go to Chat */}
            <div className="px-4 py-3 border-t border-white/5">
              <NeonButton onClick={onClose} className="w-full text-sm py-2.5">
                Go to Chat
              </NeonButton>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pb-20 md:pb-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        variants={modalVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full md:max-w-[480px] md:my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {card}
      </motion.div>
    </motion.div>
  );
}
