'use client';

import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, TrendingUp, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { YieldSelectView } from '@/components/yield/YieldSelectView';
import { YieldInputView } from '@/components/yield/YieldInputView';
import { YieldReviewView } from '@/components/yield/YieldReviewView';
import { YieldStatusView } from '@/components/yield/YieldStatusView';
import type { YieldTxStep, YieldTxStepStage, YieldTxStage } from '@/components/yield/yieldTxState';
import { DefiWidgetModalShell } from '@/components/ui/DefiWidgetModalShell';
import { useYieldApi } from '@/features/yield/api';
import { YIELD_CONFIG } from '@/features/yield/config';
import { normalizePoolId } from '@/features/yield/normalizers';
import type { TransactionExecutionStatus, YieldAction, YieldPoolWithAPR, YieldPrepareResponse } from '@/features/yield/types';
import { useYieldData } from '@/features/yield/useYieldData';
import { formatAmountHuman, parseAmountToWei } from '@/features/swap/utils';
import { useIsMobileBreakpoint } from '@/shared/hooks/useIsMobileBreakpoint';

export interface YieldProps {
  onClose: () => void;
  initialAction?: YieldAction;
  initialPoolId?: string;
  initialAmount?: string | number;
  variant?: 'modal' | 'panel';
}

type ViewState = 'select' | 'input' | 'review' | 'status';

const PREPARE_TIMEOUT_MS = 30_000;
const PREPARE_CACHE_TTL_MS = 45_000;
const PREPARE_PREWARM_DEBOUNCE_MS = 350;
const NON_ZERO_BALANCE_CACHE_TTL_MS = 90_000;

const ACTION_TITLES: Record<YieldAction, string> = {
  enter: 'Enter Position',
  exit: 'Exit Position',
  claim: 'Claim Rewards',
};

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out. Please try again.`));
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

function buildPrepareCacheKey(params: {
  action: YieldAction;
  poolId: string;
  amountA: string;
  amountB: string;
  exitAmount: string;
  slippageBps: number;
  userAddress: string;
}): string {
  return [
    params.userAddress.toLowerCase(),
    params.poolId.toLowerCase(),
    params.action,
    params.amountA.trim(),
    params.amountB.trim(),
    params.exitAmount.trim(),
    String(params.slippageBps),
  ].join('|');
}

function isValidHexBalance(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value);
}

function resolveInjectedProviderForAccount(address?: string): any | null {
  const ethereum = typeof window !== 'undefined' ? (window as any)?.ethereum : null;
  if (!ethereum) return null;

  const candidates = Array.isArray(ethereum?.providers) && ethereum.providers.length > 0
    ? ethereum.providers
    : [ethereum];

  const normalizedAddress = typeof address === 'string' ? address.toLowerCase() : '';
  if (normalizedAddress) {
    const selectedAddressMatch = candidates.find((provider: any) => {
      const selected = typeof provider?.selectedAddress === 'string' ? provider.selectedAddress.toLowerCase() : null;
      return selected === normalizedAddress;
    });
    if (selectedAddressMatch) return selectedAddressMatch;
  }

  return candidates[0] ?? null;
}

async function fetchErc20BalanceViaProvider(params: {
  provider: any;
  tokenAddress: string;
  userAddress: string;
  decimals: number;
}): Promise<string | null> {
  const { provider, tokenAddress, userAddress, decimals } = params;
  if (!provider || typeof provider.request !== 'function') return null;

  const data = `0x70a08231${userAddress.toLowerCase().replace('0x', '').padStart(64, '0')}`;
  const result = await provider.request({
    method: 'eth_call',
    params: [
      {
        to: tokenAddress,
        data,
      },
      'latest',
    ],
  });

  if (!isValidHexBalance(result)) return null;
  const value = BigInt(result);
  return formatAmountHuman(value, decimals, 6);
}

async function fetchErc20BalanceWeiViaProvider(params: {
  provider: any;
  tokenAddress: string;
  userAddress: string;
}): Promise<string | null> {
  const { provider, tokenAddress, userAddress } = params;
  if (!provider || typeof provider.request !== 'function') return null;

  const data = `0x70a08231${userAddress.toLowerCase().replace('0x', '').padStart(64, '0')}`;
  const result = await provider.request({
    method: 'eth_call',
    params: [
      {
        to: tokenAddress,
        data,
      },
      'latest',
    ],
  });

  if (!isValidHexBalance(result)) return null;
  return BigInt(result).toString();
}

function buildTxSteps(bundle: YieldPrepareResponse['bundle']): YieldTxStep[] {
  return bundle.steps.map((step, index) => ({
    id: `step-${index}`,
    label: step.description || `Step ${index + 1}`,
    stage: 'queued' as YieldTxStepStage,
    txHash: null,
  }));
}

export function Yield({
  onClose,
  initialAction,
  initialPoolId,
  initialAmount,
  variant = 'modal',
}: YieldProps) {
  const account = useActiveAccount();
  const yieldApi = useYieldApi();
  const isMobile = useIsMobileBreakpoint();

  const {
    pools,
    positions,
    portfolio,
    loading,
    error: dataError,
    refresh,
  } = useYieldData();

  const initialAmountValue = initialAmount != null ? String(initialAmount) : '';

  const [viewState, setViewState] = useState<ViewState>(
    initialAction && initialPoolId ? 'input' : 'select',
  );

  const [action, setAction] = useState<YieldAction>(initialAction ?? 'enter');
  const [poolId, setPoolId] = useState<string | null>(normalizePoolId(initialPoolId) ?? null);

  const [amountA, setAmountA] = useState(initialAction === 'enter' ? initialAmountValue : initialAmountValue);
  const [amountB, setAmountB] = useState(initialAction === 'enter' ? initialAmountValue : initialAmountValue);
  const [exitAmount, setExitAmount] = useState(initialAction === 'exit' ? initialAmountValue : initialAmountValue);
  const [slippageBps, setSlippageBps] = useState<number>(YIELD_CONFIG.DEFAULT_SLIPPAGE_BPS);

  const [prepareResponse, setPrepareResponse] = useState<YieldPrepareResponse | null>(null);
  const [txStage, setTxStage] = useState<YieldTxStage>('idle');
  const [isPreparing, setIsPreparing] = useState(false);
  const [reviewPool, setReviewPool] = useState<YieldPoolWithAPR | null>(null);
  const [txSteps, setTxSteps] = useState<YieldTxStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [liveWalletBalances, setLiveWalletBalances] = useState<Record<string, string>>({});
  const [liveWalletLpBalanceWei, setLiveWalletLpBalanceWei] = useState<string>('0');

  const isMountedRef = useRef(true);
  const isExecutingRef = useRef(false);
  const lastNonZeroBalancesRef = useRef<Record<string, { value: string; timestamp: number }>>({});
  const prepareCacheRef = useRef<Map<string, { response: YieldPrepareResponse; timestamp: number }>>(new Map());
  const prepareInFlightRef = useRef<Map<string, Promise<YieldPrepareResponse>>>(new Map());

  useEffect(() => {
    // React StrictMode (dev) mounts/unmounts effects twice.
    // Ensure mounted flag is restored on each mount cycle.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSet = useCallback((fn: () => void) => {
    if (!isMountedRef.current) return;
    fn();
  }, []);

  useEffect(() => {
    if (!poolId || pools.length === 0) return;
    const canonical = normalizePoolId(poolId, pools);
    if (canonical && canonical !== poolId) {
      setPoolId(canonical);
    }
  }, [poolId, pools]);

  const selectedPool = useMemo<YieldPoolWithAPR | null>(
    () => (poolId ? pools.find((pool) => pool.id === poolId) ?? null : null),
    [pools, poolId],
  );

  const selectedPosition = useMemo(
    () => (selectedPool ? positions.find((position) => position.poolId === selectedPool.id) ?? null : null),
    [positions, selectedPool],
  );

  const effectiveWalletBalances = useMemo(() => {
    const backendBalances = portfolio?.walletBalances ?? {};
    const symbols = new Set<string>([
      ...Object.keys(backendBalances),
      ...Object.keys(liveWalletBalances),
    ]);

    if (selectedPool) {
      symbols.add(selectedPool.tokenA.symbol);
      symbols.add(selectedPool.tokenB.symbol);
    }

    const merged: Record<string, string> = {};
    for (const symbol of symbols) {
      const liveValue = liveWalletBalances[symbol];
      const backendValue = backendBalances[symbol];
      const liveNum = liveValue == null ? NaN : Number.parseFloat(liveValue);
      const backendNum = backendValue == null ? NaN : Number.parseFloat(backendValue);
      const lastKnown = lastNonZeroBalancesRef.current[symbol];
      const now = Date.now();
      const lastKnownFresh = lastKnown && (now - lastKnown.timestamp) < NON_ZERO_BALANCE_CACHE_TTL_MS;

      if (Number.isFinite(liveNum) && liveNum > 0) {
        merged[symbol] = liveValue!;
        lastNonZeroBalancesRef.current[symbol] = { value: liveValue!, timestamp: now };
        continue;
      }

      if (Number.isFinite(backendNum) && backendNum > 0) {
        merged[symbol] = backendValue!;
        lastNonZeroBalancesRef.current[symbol] = { value: backendValue!, timestamp: now };
        continue;
      }

      if (lastKnownFresh && ((Number.isFinite(liveNum) && liveNum === 0) || (Number.isFinite(backendNum) && backendNum === 0))) {
        merged[symbol] = lastKnown.value;
        continue;
      }

      merged[symbol] = liveValue ?? backendValue ?? '0';
    }

    return merged;
  }, [liveWalletBalances, portfolio?.walletBalances, selectedPool]);

  useEffect(() => {
    if (!account?.address || !selectedPool) {
      setLiveWalletBalances({});
      setLiveWalletLpBalanceWei('0');
      return;
    }

    const provider = resolveInjectedProviderForAccount(account.address);
    if (!provider || typeof provider.request !== 'function') return;

    let cancelled = false;
    const fetchBalances = async () => {
      try {
        const [balanceA, balanceB, lpBalance] = await Promise.all([
          fetchErc20BalanceViaProvider({
            provider,
            tokenAddress: selectedPool.tokenA.address,
            userAddress: account.address,
            decimals: selectedPool.tokenA.decimals,
          }).catch(() => null),
          fetchErc20BalanceViaProvider({
            provider,
            tokenAddress: selectedPool.tokenB.address,
            userAddress: account.address,
            decimals: selectedPool.tokenB.decimals,
          }).catch(() => null),
          fetchErc20BalanceWeiViaProvider({
            provider,
            tokenAddress: selectedPool.poolAddress,
            userAddress: account.address,
          }).catch(() => null),
        ]);

        if (cancelled) return;
        setLiveWalletBalances((prev) => ({
          ...prev,
          ...(balanceA != null ? { [selectedPool.tokenA.symbol]: balanceA } : {}),
          ...(balanceB != null ? { [selectedPool.tokenB.symbol]: balanceB } : {}),
        }));
        if (lpBalance != null) {
          setLiveWalletLpBalanceWei(lpBalance);
        }
      } catch {
        // Keep backend balance fallback.
      }
    };

    void fetchBalances();
    const interval = window.setInterval(() => {
      void fetchBalances();
    }, 12_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [account?.address, selectedPool]);

  useEffect(() => {
    if (viewState !== 'input') return;
    if (poolId && !selectedPool && pools.length > 0) {
      setViewState('select');
      setError('Please select an available pool.');
    }
  }, [viewState, poolId, selectedPool, pools.length]);

  const resetTransactionState = useCallback(() => {
    setPrepareResponse(null);
    setTxStage('idle');
    setTxSteps([]);
    setReviewPool(null);
  }, []);

  const loadPrepareResponse = useCallback(async (): Promise<YieldPrepareResponse> => {
    if (!account?.address) {
      throw new Error('Connect wallet to continue.');
    }
    if (!selectedPool) {
      throw new Error('Select a pool first.');
    }

    if (action === 'enter') {
      if (!amountA || parseFloat(amountA) <= 0 || !amountB || parseFloat(amountB) <= 0) {
        throw new Error('Enter valid amounts for both pool tokens.');
      }
    } else if (action === 'exit') {
      if (!exitAmount || parseFloat(exitAmount) <= 0) {
        throw new Error('Enter a valid LP amount to exit.');
      }
    }

    const cacheKey = buildPrepareCacheKey({
      action,
      poolId: selectedPool.id,
      amountA,
      amountB,
      exitAmount,
      slippageBps,
      userAddress: account.address,
    });

    const cached = prepareCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PREPARE_CACHE_TTL_MS) {
      return cached.response;
    }

    const existing = prepareInFlightRef.current.get(cacheKey);
    if (existing) return existing;

    const requestPromise = (async () => {
      if (action === 'enter') {
        return await withTimeout(
          yieldApi.prepareEnter({
            userAddress: account.address,
            poolId: selectedPool.id,
            amountA: parseAmountToWei(amountA, selectedPool.tokenA.decimals).toString(),
            amountB: parseAmountToWei(amountB, selectedPool.tokenB.decimals).toString(),
            slippageBps,
          }),
          PREPARE_TIMEOUT_MS,
          'Preparing transaction bundle',
        );
      }

      if (action === 'exit') {
        return await withTimeout(
          yieldApi.prepareExit({
            userAddress: account.address,
            poolId: selectedPool.id,
            amount: parseAmountToWei(exitAmount, 18).toString(),
          }),
          PREPARE_TIMEOUT_MS,
          'Preparing transaction bundle',
        );
      }

      return await withTimeout(
        yieldApi.prepareClaim({
          userAddress: account.address,
          poolId: selectedPool.id,
        }),
        PREPARE_TIMEOUT_MS,
        'Preparing transaction bundle',
      );
    })()
      .then((response) => {
        prepareCacheRef.current.set(cacheKey, {
          response,
          timestamp: Date.now(),
        });
        return response;
      })
      .finally(() => {
        prepareInFlightRef.current.delete(cacheKey);
      });

    prepareInFlightRef.current.set(cacheKey, requestPromise);
    return requestPromise;
  }, [
    account?.address,
    action,
    amountA,
    amountB,
    exitAmount,
    selectedPool,
    slippageBps,
    yieldApi,
  ]);

  const handleSelectAction = useCallback((nextAction: YieldAction) => {
    setAction(nextAction);
    setError(null);
  }, []);

  const handleSelectPool = useCallback((nextPoolId: string) => {
    const canonical = normalizePoolId(nextPoolId, pools) ?? nextPoolId;
    setPoolId(canonical);
    setReviewPool(null);
    setError(null);
    resetTransactionState();
    setViewState('input');
  }, [pools, resetTransactionState]);

  const handleQuickClaim = useCallback((nextPoolId: string) => {
    setAction('claim');
    handleSelectPool(nextPoolId);
  }, [handleSelectPool]);

  const handleQuickExit = useCallback((nextPoolId: string) => {
    setAction('exit');
    handleSelectPool(nextPoolId);
  }, [handleSelectPool]);

  useEffect(() => {
    if (viewState !== 'input') return;
    if (!account?.address || !selectedPool) return;

    if (action === 'enter' && (!amountA || parseFloat(amountA) <= 0 || !amountB || parseFloat(amountB) <= 0)) {
      return;
    }
    if (action === 'exit' && (!exitAmount || parseFloat(exitAmount) <= 0)) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadPrepareResponse().catch(() => {
        // Best-effort prewarm only.
      });
    }, PREPARE_PREWARM_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    account?.address,
    action,
    amountA,
    amountB,
    exitAmount,
    loadPrepareResponse,
    selectedPool,
    viewState,
  ]);

  const handlePrepare = useCallback(async () => {
    console.log('[YIELD] handlePrepare:start', {
      action,
      poolId: selectedPool?.id ?? null,
      account: account?.address ?? null,
      amountA,
      amountB,
      exitAmount,
      slippageBps,
      isPreparing,
    });

    if (isPreparing) return;
    if (!account?.address) {
      setError('Connect wallet to continue.');
      console.warn('[YIELD] handlePrepare:blocked (wallet not connected)');
      return;
    }

    if (!selectedPool) {
      setError('Select a pool first.');
      setViewState('select');
      console.warn('[YIELD] handlePrepare:blocked (no selected pool)');
      return;
    }

    safeSet(() => {
      setError(null);
      setTxStage('preparing');
      setIsPreparing(true);
      setReviewPool(selectedPool);
      setViewState('review');
    });

    try {
      const response = await loadPrepareResponse();

      safeSet(() => {
        setPrepareResponse(response);
        setTxSteps(buildTxSteps(response.bundle));
        setTxStage('idle');
        setViewState('review');
      });
      console.log('[YIELD] handlePrepare:success', {
        totalSteps: response.bundle.totalSteps,
        summary: response.bundle.summary,
      });
    } catch (err) {
      safeSet(() => {
        setError(getErrorMessage(err, 'Failed to prepare transaction.'));
        setTxStage('failed');
      });
      console.error('[YIELD] handlePrepare:error', err);
    } finally {
      safeSet(() => {
        setIsPreparing(false);
      });
      console.log('[YIELD] handlePrepare:done');
    }
  }, [
    account?.address,
    action,
    amountA,
    amountB,
    exitAmount,
    slippageBps,
    selectedPool,
    isPreparing,
    loadPrepareResponse,
    safeSet,
  ]);

  const markStep = useCallback((index: number, stage: YieldTxStepStage, txHash: string | null = null) => {
    setTxSteps((prev) => prev.map((step, currentIndex) => {
      if (currentIndex !== index) return step;
      return {
        ...step,
        stage,
        txHash: txHash ?? step.txHash,
      };
    }));
  }, []);

  const handleExecute = useCallback(async () => {
    if (!prepareResponse || !account?.address) return;
    if (isExecutingRef.current) return;
    if (txStage === 'awaiting_wallet' || txStage === 'pending' || txStage === 'recovering') return;

    isExecutingRef.current = true;

    try {
      safeSet(() => {
        setViewState('status');
        setTxStage('awaiting_wallet');
        setError(null);
      });

      const results: TransactionExecutionStatus[] = [];

      for (let i = 0; i < prepareResponse.bundle.steps.length; i += 1) {
        const step = prepareResponse.bundle.steps[i];

        safeSet(() => {
          markStep(i, 'awaiting_wallet');
          setTxStage('awaiting_wallet');
        });

        try {
          const result = await yieldApi.executeTransaction(step);
          results.push(result);

          safeSet(() => {
            if (result.source === 'recovered') {
              markStep(i, 'recovering');
              setTxStage('recovering');
            }
            markStep(i, 'confirmed', result.transactionHash);
            if (i < prepareResponse.bundle.steps.length - 1) {
              setTxStage('pending');
            }
          });

          void yieldApi.submitTransaction(result.transactionHash, account.address, action).catch((submitError) => {
            console.warn('[YIELD] Failed to submit transaction for tracking:', submitError);
          });
        } catch (err) {
          safeSet(() => {
            markStep(i, 'failed');
            if (results.length > 0) {
              setTxStage('partial_confirmed');
              setError(`${getErrorMessage(err, 'Transaction execution failed.')} Previous step(s) were submitted.`);
            } else {
              setTxStage('failed');
              setError(getErrorMessage(err, 'Transaction execution failed.'));
            }
          });
          return;
        }
      }

      safeSet(() => {
        setTxStage('confirmed');
      });

      await refresh();
    } finally {
      isExecutingRef.current = false;
    }
  }, [account?.address, action, markStep, prepareResponse, refresh, safeSet, txStage, yieldApi]);

  const handleBack = useCallback(() => {
    setError(null);

    if (viewState === 'status') {
      if (txStage === 'failed') {
        setViewState('review');
        return;
      }
      onClose();
      return;
    }

    if (viewState === 'review') {
      setViewState('input');
      return;
    }

    if (viewState === 'input') {
      setViewState('select');
      return;
    }

    onClose();
  }, [onClose, txStage, viewState]);

  const handleRetry = useCallback(() => {
    if (!prepareResponse) return;
    setError(null);
    setTxStage('idle');
    setTxSteps(buildTxSteps(prepareResponse.bundle));
    setViewState('review');
  }, [prepareResponse]);

  const handleViewPosition = useCallback(() => {
    setAction('exit');
    setViewState('input');
    setReviewPool(null);
    setError(null);
    resetTransactionState();
  }, [resetTransactionState]);

  const handleNewPosition = useCallback(() => {
    setAction('enter');
    setPoolId(null);
    setAmountA('');
    setAmountB('');
    setExitAmount('');
    setReviewPool(null);
    setError(null);
    resetTransactionState();
    setViewState('select');
  }, [resetTransactionState]);

  const reviewPoolData = useMemo<YieldPoolWithAPR | null>(
    () => selectedPool ?? reviewPool,
    [reviewPool, selectedPool],
  );

  const currentTitle = ACTION_TITLES[action] ?? 'Yield';

  const viewTitles: Record<ViewState, string> = {
    select: 'Yield',
    input: currentTitle,
    review: 'Review Transaction',
    status: 'Transaction Status',
  };

  const header = viewState !== 'status' ? (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={handleBack}
        className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
      >
        {viewState === 'select' ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
      </button>
      <div className="flex items-center gap-2 flex-1">
        <TrendingUp className="w-5 h-5 text-cyan-400" />
        <h2 className="text-lg font-display font-bold text-white">{viewTitles[viewState]}</h2>
      </div>
    </div>
  ) : null;

  const footer = (
    <div className="py-4 flex items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
      <span className="text-[10px] sm:text-xs font-medium text-zinc-500">Powered on Base</span>
    </div>
  );

  return (
    <DefiWidgetModalShell
      onClose={onClose}
      variant={variant}
      isMobile={isMobile}
      header={header}
      footer={footer}
      gradientClassName="bg-cyan-500/10"
      cardClassName="md:min-h-[540px]"
      bodyClassName="custom-scrollbar"
    >
      <AnimatePresence mode="wait">
        {viewState === 'select' && (
          <YieldSelectView
            pools={pools}
            userPositions={positions}
            loading={loading}
            error={dataError}
            onRetry={() => { void refresh(); }}
            onSelectPool={handleSelectPool}
            onQuickClaim={handleQuickClaim}
            onQuickExit={handleQuickExit}
          />
        )}

        {viewState === 'input' && selectedPool && (
          <YieldInputView
            action={action}
            onSelectAction={handleSelectAction}
            pool={selectedPool}
            amountA={amountA}
            amountB={amountB}
            setAmountA={setAmountA}
            setAmountB={setAmountB}
            exitAmount={exitAmount}
            setExitAmount={setExitAmount}
            slippageBps={slippageBps}
            setSlippageBps={setSlippageBps}
            userPosition={selectedPosition}
            portfolio={portfolio}
            walletBalances={effectiveWalletBalances}
            walletLpBalanceWei={liveWalletLpBalanceWei}
            error={error ?? dataError}
            walletConnected={!!account?.address}
            isPreparing={isPreparing}
            onContinue={handlePrepare}
          />
        )}

        {viewState === 'review' && (
          <YieldReviewView
            action={action}
            pool={reviewPoolData}
            amountA={amountA}
            amountB={amountB}
            exitAmount={exitAmount}
            slippageBps={slippageBps}
            prepareResponse={prepareResponse}
            txStage={txStage}
            txSteps={txSteps}
            error={error}
            onExecute={handleExecute}
            onBack={handleBack}
          />
        )}

        {viewState === 'status' && (
          <YieldStatusView
            action={action}
            txStage={txStage}
            txSteps={txSteps}
            error={error}
            onClose={onClose}
            onRetry={handleRetry}
            onViewPosition={handleViewPosition}
            onNewPosition={handleNewPosition}
          />
        )}
      </AnimatePresence>
    </DefiWidgetModalShell>
  );
}
