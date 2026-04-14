import { AnimatePresence } from "framer-motion";
import {
  Landmark,
  X,
  ArrowLeft,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TokenSelectionModal } from "@/components/TokenSelectionModal";
import { DefiWidgetModalShell } from "@/components/ui/DefiWidgetModalShell";
import { useLendingData } from "@/features/lending/useLendingData";
import { useLendingApi } from "@/features/lending/api";
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

type ViewState = 'input' | 'review' | 'status';
type Mode = 'supply' | 'borrow';
type Flow = 'open' | 'close'; // open=supply/borrow, close=withdraw/repay
type LendingActionType = 'supply' | 'withdraw' | 'borrow' | 'repay';

type TxStep = {
  id: string;
  label: string;
  stage: LendingTxStepStage;
  txHash: string | null;
  to?: string | null;
  data?: string | null;
  chainId?: number;
};

interface LendingProps {
  onClose: () => void;
  initialAmount?: string | number;
  initialAsset?: string;
  initialMode?: Mode;
  initialFlow?: Flow;
  initialViewState?: ViewState;
  variant?: 'modal' | 'panel';
}

type LendingInfoPopup = 'risk' | 'flow' | 'pending' | 'steps';

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
  initialViewState,
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
  const [infoPopup, setInfoPopup] = useState<LendingInfoPopup | null>(null);
  const [activeMarket, setActiveMarket] = useState<LendingToken | null>(null);

  const [amount, setAmount] = useState<string>(normalizeInitialAmount(initialAmount) ?? '');

  // When launched with initialViewState='review' AND an initialAmount (e.g. from chat),
  // auto-advance once market data loads. Requires initialAmount so that user typing
  // the first digit does NOT trigger navigation.
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

  const reviewRiskHint = useMemo(() => {
    if (activeAction === 'borrow') {
      return 'Borrowing reduces account health. If collateral value drops too far, liquidation risk increases.';
    }
    if (activeAction === 'withdraw') {
      return 'Withdrawing collateral can reduce account health. Confirm health stays safe before signing.';
    }
    return null;
  }, [activeAction]);

  // Auto-fill amount with the max for the active action whenever the tab changes.
  // - Supply   → wallet balance
  // - Withdraw → supplied amount
  // - Repay    → borrowed amount
  // - Borrow   → clear (limit is protocol-side, no static max)
  // NOTE: must come AFTER activeAction and maxHuman are declared (both used in deps).
  useEffect(() => {
    if (normalizeInitialAmount(initialAmount)) return; // respect explicit initial amount
    if (lastAutoFilledActionRef.current === activeAction) return; // already handled this action

    if (maxHuman === null) {
      // maxHuman is null while loading OR intentionally for borrow.
      if (activeAction === 'borrow') {
        lastAutoFilledActionRef.current = activeAction;
        setAmount('');
      }
      return;
    }

    lastAutoFilledActionRef.current = activeAction;
    setAmount(maxHuman);
  }, [maxHuman, activeAction, initialAmount]);

  const setActiveAction = useCallback((action: LendingActionType) => {
    // Reset so the auto-fill effect re-runs with the correct max for the new action.
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
    if (txActionInFlightRef.current) return;
    txActionInFlightRef.current = true;

    setTxError(null);
    setTxWarning(null);
    setTxStage('awaiting_wallet');
    setTxHashes([]);
    setViewState('status');

    let tracker: SwapTracker | null = null;
    try {
      const decimals = activeMarket.decimals ?? 18;
      const qTokenAddress = activeMarket.qTokenAddress;
      const opAmount = amount;
      const normalizedAddress = account.address?.toLowerCase();
      const action = activeAction;

      const zeroAddress = "0x0000000000000000000000000000000000000000";
      const underlyingAsset = {
        address: activeMarket.address || zeroAddress,
        symbol: activeMarket.symbol || 'TOKEN',
        decimals,
      };
      const qTokenAsset = {
        address: activeMarket.qTokenAddress || zeroAddress,
        symbol: activeMarket.qTokenSymbol || `q${activeMarket.symbol || 'TOKEN'}`,
        decimals: 8,
      };
      const fromAsset =
        action === 'withdraw' || action === 'borrow'
          ? qTokenAsset
          : underlyingAsset;
      const toAsset =
        action === 'withdraw' || action === 'borrow'
          ? underlyingAsset
          : qTokenAsset;

      if (normalizedAddress) {
        try {
          tracker = await startSwapTracking({
            userId: normalizedAddress,
            walletAddress: normalizedAddress,
            chain: 'avalanche',
            action,
            fromChainId: 43114,
            toChainId: 43114,
            fromAsset,
            toAsset,
            fromAmount: opAmount,
            toAmount: previewHuman || opAmount,
            provider: 'benqi',
          });
        } catch (trackingError) {
          console.warn('[LENDING] Gateway tracking unavailable (continuing without history sync):', trackingError);
        }
      }

      const prepared = await (async () => {
        if (mode === 'supply' && flow === 'open') return await lendingApi.prepareSupply(qTokenAddress, opAmount, decimals);
        if (mode === 'supply' && flow === 'close') {
          // Calcula qTokenAmount proporcional para evitar TransferFromFailed no contrato.
          // O contrato precisa de unidades de qToken (8 decimais), não de underlying wei.
          let qTokenOverride: string | undefined;
          const pos = activePositionRow as any;
          // Suporta tanto 'qTokenBalanceWei' (lending-service) quanto 'qTokenBalance' (execution-layer)
          const qTokenBalStr: string | undefined = pos?.qTokenBalanceWei || pos?.qTokenBalance;
          const suppliedWStr: string | undefined = pos?.suppliedWei;
          if (qTokenBalStr && suppliedWStr) {
            const qTokenBal = BigInt(qTokenBalStr);
            const suppliedW = BigInt(suppliedWStr);
            if (suppliedW > 0n && qTokenBal > 0n) {
              const opWei = parseAmountToWei(opAmount, decimals);
              qTokenOverride = ((opWei * qTokenBal) / suppliedW).toString();
            } else if (qTokenBal > 0n) {
              qTokenOverride = qTokenBalStr;
            }
          }
          return await lendingApi.prepareWithdraw(qTokenAddress, opAmount, decimals, qTokenOverride);
        }
        if (mode === 'borrow' && flow === 'open') return await lendingApi.prepareBorrow(qTokenAddress, opAmount, decimals);
        return await lendingApi.prepareRepay(qTokenAddress, opAmount, decimals);
      })();

      // Suporte ao formato novo (TransactionBundle) e antigo ({ data: { validation, withdraw } })
      const toPreparedTx = (txLike: any) => {
        if (!txLike?.to || !txLike?.data) return null;
        return {
          to: txLike.to,
          data: txLike.data,
          value: txLike.value || '0',
          gasLimit: txLike.gasLimit || txLike.gas || 700000,
          gasPrice: txLike.gasPrice,
          chainId: 43114,
        };
      };

      let txs: any[];
      if (prepared?.bundle?.steps?.length) {
        // Formato novo: { bundle: { steps: [{ to, data, value, chainId }] } }
        txs = prepared.bundle.steps.map(toPreparedTx).filter(Boolean);
      } else {
        // Formato legado: { data: { validation, supply|withdraw|borrow|repay } }
        const data = prepared?.data;
        if (!data) throw new Error('Failed to prepare transaction.');
        const validationTx = data.validation;
        const actionTx = data.supply || data.withdraw || data.borrow || data.repay;
        txs = [toPreparedTx(validationTx), toPreparedTx(actionTx)].filter(Boolean);
      }

      if (txs.length === 0) throw new Error('No valid transaction payload from backend.');

      const stepLabels = txs.length > 1 ? ['Validation', actionLabel] : [actionLabel];
      setTxSteps(
        stepLabels.map((label, index) => ({
          id: `step-${index}-${label.toLowerCase()}`,
          label,
          stage: 'queued',
          txHash: null,
          to: txs[index]?.to ?? null,
          data: txs[index]?.data ?? null,
          chainId: txs[index]?.chainId ?? 43114,
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

          const executionResult =
            typeof (lendingApi as any).executeTransactionWithStatus === 'function'
              ? await (lendingApi as any).executeTransactionWithStatus(tx)
              : {
                  transactionHash: await lendingApi.executeTransaction(tx),
                  confirmed: false,
                };

          const hash = executionResult.transactionHash;
          const confirmedByWalletSync = executionResult.confirmed === true;
          submittedHash = hash;
          setTxHashes((prev) => [...prev, hash]);
          setTxStage(confirmedByWalletSync ? 'confirmed' : 'pending');
          markStep(index, { stage: confirmedByWalletSync ? 'confirmed' : 'pending', txHash: hash });

          if (tracker) {
            try {
              const type =
                typeof tx?.data === 'string' && tx.data.startsWith('0x095ea7b3')
                  ? 'approval'
                  : index === stepLabels.length - 1
                    ? 'lend'
                    : 'other';
              await tracker.addTxHash(hash, 43114, type);
              if (index === 0) {
                await tracker.markSubmitted();
                await tracker.markPending();
              }
            } catch (trackingError) {
              console.warn('[LENDING] Failed to update gateway tx hash:', trackingError);
            }
          }

          if (confirmedByWalletSync) {
            return { hash, outcome: 'confirmed' };
          }

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
          if (tracker) {
            try {
              await tracker.markPending();
            } catch (trackingError) {
              console.warn('[LENDING] Failed to mark gateway transaction as pending:', trackingError);
            }
          }
          break;
        }
      }

      if (!hasTimeout) {
        setTxStage('confirmed');
        if (tracker) {
          try {
            await tracker.markConfirmed(previewHuman || opAmount);
          } catch (trackingError) {
            console.warn('[LENDING] Failed to mark gateway transaction as confirmed:', trackingError);
          }
        }
        void fetchPosition();
        // Refresh history so the new tx shows up
        lendingApi.getTransactionHistory(10).then(setTxHistory).catch(() => {});
      }
    } catch (e) {
      const rawMessage = e instanceof Error ? e.message : 'Transaction failed';
      const is429 = /429|rate.?limit/i.test(rawMessage);
      if (is429) {
        rateLimit.trigger(parseRetryAfter(e));
      }
      const mappedMessage = mapError(e, rawMessage);
      if (tracker) {
        try {
          const isPendingLike = /submitted|pending|timeout/i.test(rawMessage);
          if (isPendingLike) {
            await tracker.markPending();
          } else {
            await tracker.markFailed('LENDING_TX_FAILED', mappedMessage);
          }
        } catch (trackingError) {
          console.warn('[LENDING] Failed to mark gateway transaction failure:', trackingError);
        }
      }
      setTxError(mappedMessage);
      setTxStage('failed');
    } finally {
      txActionInFlightRef.current = false;
    }
  }, [account, actionLabel, activeAction, activeMarket, activePositionRow, amount, canReview, fetchPosition, flow, lendingApi, mode, previewHuman, rateLimit, waitForReceipt]);

  useEffect(() => {
    if (txStage !== 'timeout') {
      timeoutSyncHashRef.current = null;
      return;
    }

    let timeoutStepIndex = -1;
    for (let index = txSteps.length - 1; index >= 0; index--) {
      if (txSteps[index]?.stage === 'timeout' && txSteps[index]?.txHash) {
        timeoutStepIndex = index;
        break;
      }
    }

    const timeoutStep = timeoutStepIndex >= 0 ? txSteps[timeoutStepIndex] : null;
    const candidateHash = timeoutStep?.txHash || txHashes[txHashes.length - 1] || null;
    if (!candidateHash) return;
    if (timeoutSyncHashRef.current === candidateHash) return;
    timeoutSyncHashRef.current = candidateHash;

    let cancelled = false;

    const syncTimeoutState = async () => {
      try {
        const receipt = await waitForEvmReceipt({
          clientId: THIRDWEB_CLIENT_ID,
          chainId: timeoutStep?.chainId ?? 43114,
          txHash: candidateHash,
          timeoutMs: 45 * 60_000,
          pollIntervalMs: 4_000,
          shouldContinue: () => isMountedRef.current && !cancelled && txStage === 'timeout',
          tracking: {
            fromAddress: account?.address,
            to: timeoutStep?.to ?? null,
            data: timeoutStep?.data ?? null,
          },
        });

        if (cancelled || !isMountedRef.current) return;

        const resolvedHash =
          typeof receipt.txHash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(receipt.txHash)
            ? receipt.txHash
            : candidateHash;

        if (resolvedHash !== candidateHash) {
          setTxHashes((prev) => prev.map((hash) => (hash === candidateHash ? resolvedHash : hash)));
          setTxSteps((prev) =>
            prev.map((step) => (step.txHash === candidateHash ? { ...step, txHash: resolvedHash } : step)),
          );
        }

        if (receipt.outcome === 'confirmed') {
          if (timeoutStepIndex >= 0) {
            setTxSteps((prev) =>
              prev.map((step, index) =>
                index === timeoutStepIndex
                  ? {
                      ...step,
                      txHash: resolvedHash,
                      stage: 'confirmed',
                    }
                  : step,
              ),
            );
          }

          const hasQueuedSteps = timeoutStepIndex >= 0
            ? txSteps.some((step, index) => index > timeoutStepIndex && step.stage === 'queued')
            : false;

          if (hasQueuedSteps) {
            setTxWarning('Validation confirmed on-chain. Click Try again to send the remaining step.');
            return;
          }

          setTxWarning(null);
          setTxError(null);
          setTxStage('confirmed');
          void fetchPosition();
          lendingApi.getTransactionHistory(10).then(setTxHistory).catch(() => {});
          return;
        }

        if (receipt.outcome === 'reverted') {
          if (timeoutStepIndex >= 0) {
            setTxSteps((prev) =>
              prev.map((step, index) => (index === timeoutStepIndex ? { ...step, stage: 'failed' } : step)),
            );
          }
          setTxError('Transaction reverted on-chain after submission.');
          setTxStage('failed');
        }
      } catch (error) {
        console.warn('[LENDING] Timeout sync watcher failed:', error);
      }
    };

    void syncTimeoutState();

    return () => {
      cancelled = true;
    };
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
    if (txSteps.length > 0) {
      for (let index = txSteps.length - 1; index >= 0; index--) {
        const candidate = txSteps[index]?.txHash;
        if (candidate) return candidate;
      }
    }
    if (!txHashes.length) return null;
    return txHashes[txHashes.length - 1];
  }, [txHashes, txSteps]);

  const positionWarning = !dataError && Array.isArray(userPosition?.warnings) && userPosition.warnings.length > 0
    ? userPosition.warnings[0]
    : null;

  const header = viewState === 'input' ? (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex items-center gap-2 flex-1">
        <Landmark className="w-5 h-5 text-cyan-400" />
        <div>
          <h2 className="text-lg font-display font-bold text-white">Lending</h2>
          <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Benqi · Avalanche</div>
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
      body: 'Borrow and collateral withdrawals can lower account health. If health falls too much, positions may be liquidated.',
    },
    flow: {
      title: 'Execution flow',
      body: 'This action may use one or two transactions: a validation step and the final lending action. Confirm each step in wallet.',
    },
    pending: {
      title: 'Pending confirmation',
      body: 'Wallet approval only broadcasts the transaction. Final confirmation depends on blockchain inclusion and network finality.',
    },
    steps: {
      title: 'Step details',
      body: 'Validation checks limits/allowances. Action executes supply, withdraw, borrow, or repay and updates your position after confirmation.',
    },
  };

  return (
    <>
      <DefiWidgetModalShell
        dataTour="widget-lending"
        onClose={onClose}
        variant={variant}
        isMobile={isMobile}
        header={header}
        footer={(
          <div className="py-8 flex items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
            <img src="/miniapp/icons/benqui_logo.png" alt="Benqi" className="w-8 h-8 rounded-full" />
            <span className="text-sm font-medium text-zinc-400">Powered by Benqi</span>
          </div>
        )}
        cardClassName="md:min-h-[540px]"
        bodyClassName="custom-scrollbar"
      >
        <AnimatePresence mode="wait">
          {viewState === 'input' && (
            <LendingInputView
              activeAction={activeAction}
              onSelectAction={setActiveAction}
              inputLabel={inputLabel}
              amount={amount}
              balanceLabel={balanceLabel}
              maxHuman={maxHuman}
              onSetAmount={setAmount}
              onOpenTokenList={() => setShowTokenList(true)}
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
              onToggleHistory={() => setHistoryOpen((value) => !value)}
              historyLoading={historyLoading}
              txHistory={txHistory}
              getExplorerTxUrl={getExplorerTxUrl}
              canReview={canReview}
              loadingData={loadingData}
              hasActiveMarket={!!activeMarket}
              onContinue={() => setViewState('review')}
              tokenSymbol={activeMarket?.symbol ?? '--'}
              tokenIcon={activeMarket?.icon}
            />
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
                setViewState('review');
                setTxStage('idle');
                setTxError(null);
                setTxWarning(null);
                setTxHashes([]);
                setTxSteps([]);
              }}
            />
          )}
        </AnimatePresence>

        {infoPopup && (
          <div className="absolute inset-0 z-40 bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div className="w-full max-w-[360px] rounded-xl border border-white/10 bg-[#0b0d10] p-4 space-y-3">
              <div className="text-sm font-semibold text-white">{infoPopupCopy[infoPopup].title}</div>
              <p className="text-xs text-zinc-300 leading-relaxed">{infoPopupCopy[infoPopup].body}</p>
              <button
                type="button"
                onClick={() => setInfoPopup(null)}
                className="w-full py-2.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-sm font-medium transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </DefiWidgetModalShell>

      <TokenSelectionModal
        isOpen={showTokenList}
        onClose={() => setShowTokenList(false)}
        onSelect={(token) => {
          const found = tokens.find((candidate) => candidate.symbol === token.ticker);
          if (found) setActiveMarket(found);
          setShowTokenList(false);
        }}
        customTokens={uiTokens}
      />
    </>
  );
}
