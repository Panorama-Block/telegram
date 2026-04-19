'use client';

import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, Layers, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { AvaxLpSelectView } from '@/components/avax-lp/AvaxLpSelectView';
import { AvaxLpInputView } from '@/components/avax-lp/AvaxLpInputView';
import { AvaxLpReviewView } from '@/components/avax-lp/AvaxLpReviewView';
import { AvaxLpStatusView } from '@/components/avax-lp/AvaxLpStatusView';
import type { YieldTxStep, YieldTxStepStage, YieldTxStage } from '@/components/yield/yieldTxState';
import { DefiWidgetModalShell } from '@/components/ui/DefiWidgetModalShell';
import { useAvaxLpApi } from '@/features/avax-lp/api';
import { AVAX_LP_CONFIG, AVAX_CHAIN_ID, TOKEN_ICONS } from '@/features/avax-lp/config';
import type {
  AvaxLpAction,
  AvaxLpPool,
  AvaxLpPrepareResponse,
  TransactionExecutionStatus,
} from '@/features/avax-lp/types';
import { useAvaxLpData } from '@/features/avax-lp/useAvaxLpData';
import { formatAmountHuman, parseAmountToWei } from '@/features/swap/utils';
import { useIsMobileBreakpoint } from '@/shared/hooks/useIsMobileBreakpoint';

export interface AvaxLpProps {
  onClose: () => void;
  initialAction?: AvaxLpAction;
  initialPoolId?: number;
  initialAmount?: string | number;
  variant?: 'modal' | 'panel';
}

type ViewState = 'select' | 'input' | 'review' | 'status';

const PREPARE_TIMEOUT_MS = 30_000;
const PREPARE_CACHE_TTL_MS = 45_000;
const PREPARE_PREWARM_DEBOUNCE_MS = 350;

const ACTION_TITLES: Record<AvaxLpAction, string> = {
  add: 'Add Liquidity',
  remove: 'Remove Liquidity',
  stake: 'Stake LP',
  unstake: 'Unstake LP',
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
      .then((value) => { clearTimeout(timeoutHandle); resolve(value); })
      .catch((error) => { clearTimeout(timeoutHandle); reject(error); });
  });
}

function buildPrepareCacheKey(params: {
  action: AvaxLpAction;
  poolId: number;
  amountA: string;
  amountB: string;
  removeAmount: string;
  stakeAmount: string;
  unstakeAmount: string;
  slippageBps: number;
  userAddress: string;
}): string {
  return [
    params.userAddress.toLowerCase(),
    String(params.poolId),
    params.action,
    params.amountA.trim(),
    params.amountB.trim(),
    params.removeAmount.trim(),
    params.stakeAmount.trim(),
    params.unstakeAmount.trim(),
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
    ? ethereum.providers : [ethereum];
  const normalizedAddress = typeof address === 'string' ? address.toLowerCase() : '';
  if (normalizedAddress) {
    const match = candidates.find((p: any) => {
      const sel = typeof p?.selectedAddress === 'string' ? p.selectedAddress.toLowerCase() : null;
      return sel === normalizedAddress;
    });
    if (match) return match;
  }
  return candidates[0] ?? null;
}

async function fetchNativeBalanceViaProvider(params: {
  provider: any;
  userAddress: string;
  decimals: number;
}): Promise<string | null> {
  const { provider, userAddress, decimals } = params;
  if (!provider || typeof provider.request !== 'function') return null;
  try {
    const result = await provider.request({
      method: 'eth_getBalance',
      params: [userAddress, 'latest'],
    });
    if (!isValidHexBalance(result)) return null;
    return formatAmountHuman(BigInt(result), decimals, 6);
  } catch {
    return null;
  }
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
  try {
    const result = await provider.request({
      method: 'eth_call',
      params: [{ to: tokenAddress, data }, 'latest'],
    });
    if (!isValidHexBalance(result)) return null;
    return formatAmountHuman(BigInt(result), decimals, 6);
  } catch {
    return null;
  }
}

async function fetchErc20BalanceWeiViaProvider(params: {
  provider: any;
  tokenAddress: string;
  userAddress: string;
}): Promise<string | null> {
  const { provider, tokenAddress, userAddress } = params;
  if (!provider || typeof provider.request !== 'function') return null;
  const data = `0x70a08231${userAddress.toLowerCase().replace('0x', '').padStart(64, '0')}`;
  try {
    const result = await provider.request({
      method: 'eth_call',
      params: [{ to: tokenAddress, data }, 'latest'],
    });
    if (!isValidHexBalance(result)) return null;
    return BigInt(result).toString();
  } catch {
    return null;
  }
}

function buildTxSteps(bundle: AvaxLpPrepareResponse['bundle']): YieldTxStep[] {
  return bundle.steps.map((step, index) => ({
    id: `step-${index}`,
    label: step.description || `Step ${index + 1}`,
    stage: 'queued' as YieldTxStepStage,
    txHash: null,
  }));
}

export function AvaxLp({
  onClose,
  initialAction,
  initialPoolId,
  initialAmount,
  variant = 'modal',
}: AvaxLpProps) {
  const account = useActiveAccount();
  const avaxLpApi = useAvaxLpApi();
  const isMobile = useIsMobileBreakpoint();

  const { pools, positions, loading, userLoading, error: dataError, refresh } = useAvaxLpData();

  const initialAmountValue = initialAmount != null ? String(initialAmount) : '';

  const [viewState, setViewState] = useState<ViewState>(
    initialAction !== undefined && initialPoolId !== undefined ? 'input' : 'select',
  );
  const [selectTab, setSelectTab] = useState<'pools' | 'positions' | undefined>(undefined);

  const [action, setAction] = useState<AvaxLpAction>(initialAction ?? 'add');
  const [poolId, setPoolId] = useState<number | null>(initialPoolId ?? null);

  const [amountA, setAmountA] = useState(initialAction === 'add' ? initialAmountValue : '');
  const [amountB, setAmountB] = useState(initialAction === 'add' ? initialAmountValue : '');
  const [removeAmount, setRemoveAmount] = useState(initialAction === 'remove' ? initialAmountValue : '');
  const [stakeAmount, setStakeAmount] = useState(initialAction === 'stake' ? initialAmountValue : '');
  const [unstakeAmount, setUnstakeAmount] = useState(initialAction === 'unstake' ? initialAmountValue : '');
  const [slippageBps, setSlippageBps] = useState<number>(AVAX_LP_CONFIG.DEFAULT_SLIPPAGE_BPS);

  const [prepareResponse, setPrepareResponse] = useState<AvaxLpPrepareResponse | null>(null);
  const [txStage, setTxStage] = useState<YieldTxStage>('idle');
  const [isPreparing, setIsPreparing] = useState(false);
  const [reviewPool, setReviewPool] = useState<AvaxLpPool | null>(null);
  const [txSteps, setTxSteps] = useState<YieldTxStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [liveWalletBalances, setLiveWalletBalances] = useState<Record<string, string>>({});
  const [liveWalletLpBalanceWei, setLiveWalletLpBalanceWei] = useState<string>('0');
  const [isNavigatingToPositions, setIsNavigatingToPositions] = useState(false);

  const isMountedRef = useRef(true);
  const isExecutingRef = useRef(false);
  const prepareCacheRef = useRef<Map<string, { response: AvaxLpPrepareResponse; timestamp: number }>>(new Map());
  const prepareInFlightRef = useRef<Map<string, Promise<AvaxLpPrepareResponse>>>(new Map());

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const safeSet = useCallback((fn: () => void) => {
    if (!isMountedRef.current) return;
    fn();
  }, []);

  const selectedPool = useMemo<AvaxLpPool | null>(
    () => (poolId !== null ? pools.find((p) => p.poolId === poolId) ?? null : null),
    [pools, poolId],
  );

  const selectedPosition = useMemo(
    () => (selectedPool ? positions.find((p) => p.poolId === selectedPool.poolId) ?? null : null),
    [positions, selectedPool],
  );

  useEffect(() => {
    if (viewState !== 'input') return;
    if (poolId !== null && !selectedPool && pools.length > 0) {
      setViewState('select');
      setError('Please select an available pool.');
    }
  }, [viewState, poolId, selectedPool, pools.length]);

  useEffect(() => {
    if (!account?.address || !selectedPool) {
      setLiveWalletBalances({});
      setLiveWalletLpBalanceWei('0');
      return;
    }

    let cancelled = false;
    const fetchBalances = async () => {
      try {
        const { createThirdwebClient, getContract, defineChain } = await import('thirdweb');
        const { eth_getBalance, getRpcClient } = await import('thirdweb/rpc');
        const { getBalance } = await import('thirdweb/extensions/erc20');
        const { THIRDWEB_CLIENT_ID } = await import('@/shared/config/thirdweb');
        if (!THIRDWEB_CLIENT_ID) return;

        const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
        const chain = defineChain(AVAX_CHAIN_ID);
        const rpc = getRpcClient({ client, chain });
        const addr = account.address as `0x${string}`;

        const fetchA = selectedPool.tokenA.isNative
          ? eth_getBalance(rpc, { address: addr })
          : getBalance({ contract: getContract({ client, chain, address: selectedPool.tokenA.address }), address: addr })
              .then(r => r.value);

        const fetchB = selectedPool.tokenB.isNative
          ? eth_getBalance(rpc, { address: addr })
          : getBalance({ contract: getContract({ client, chain, address: selectedPool.tokenB.address }), address: addr })
              .then(r => r.value);

        const fetchLp = getBalance({
          contract: getContract({ client, chain, address: selectedPool.lpTokenAddress }),
          address: addr,
        });

        const [weiA, weiB, lpResult] = await Promise.all([
          fetchA.catch(() => null),
          fetchB.catch(() => null),
          fetchLp.catch(() => null),
        ]);

        if (cancelled) return;
        setLiveWalletBalances((prev) => ({
          ...prev,
          ...(weiA != null ? { [selectedPool.tokenA.symbol]: formatAmountHuman(weiA, selectedPool.tokenA.decimals, 6) } : {}),
          ...(weiB != null ? { [selectedPool.tokenB.symbol]: formatAmountHuman(weiB, selectedPool.tokenB.decimals, 6) } : {}),
        }));
        if (lpResult != null) setLiveWalletLpBalanceWei(lpResult.value.toString());
      } catch { /* keep backend fallback */ }
    };

    void fetchBalances();
    const interval = window.setInterval(() => void fetchBalances(), 12_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [account?.address, selectedPool]);

  const resetTransactionState = useCallback(() => {
    setPrepareResponse(null);
    setTxStage('idle');
    setTxSteps([]);
    setReviewPool(null);
  }, []);

  const loadPrepareResponse = useCallback(async (): Promise<AvaxLpPrepareResponse> => {
    if (!account?.address) throw new Error('Connect wallet to continue.');
    if (!selectedPool) throw new Error('Select a pool first.');

    if (action === 'add') {
      if (!amountA || parseFloat(amountA) <= 0 || !amountB || parseFloat(amountB) <= 0) {
        throw new Error('Enter valid amounts for both pool tokens.');
      }
    } else if (action === 'remove') {
      if (!removeAmount || parseFloat(removeAmount) <= 0) throw new Error('Enter a valid LP amount to remove.');
    } else if (action === 'stake') {
      if (!stakeAmount || parseFloat(stakeAmount) <= 0) throw new Error('Enter a valid LP amount to stake.');
    } else if (action === 'unstake') {
      if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) throw new Error('Enter a valid LP amount to unstake.');
    }

    const cacheKey = buildPrepareCacheKey({
      action, poolId: selectedPool.poolId, amountA, amountB, removeAmount, stakeAmount, unstakeAmount, slippageBps, userAddress: account.address,
    });

    const cached = prepareCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PREPARE_CACHE_TTL_MS) return cached.response;

    const existing = prepareInFlightRef.current.get(cacheKey);
    if (existing) return existing;

    const requestPromise = (async () => {
      let resp: AvaxLpPrepareResponse;

      if (action === 'add') {
        resp = await withTimeout(
          avaxLpApi.prepareAddLiquidity({
            userAddress: account.address,
            tokenA: selectedPool.tokenA.address,
            tokenB: selectedPool.tokenB.address,
            amountADesired: parseAmountToWei(amountA, selectedPool.tokenA.decimals).toString(),
            amountBDesired: parseAmountToWei(amountB, selectedPool.tokenB.decimals).toString(),
            slippageBps,
          }),
          PREPARE_TIMEOUT_MS, 'Preparing transaction bundle',
        );
      } else if (action === 'remove') {
        resp = await withTimeout(
          avaxLpApi.prepareRemoveLiquidity({
            userAddress: account.address,
            tokenA: selectedPool.tokenA.address,
            tokenB: selectedPool.tokenB.address,
            lpAmount: parseAmountToWei(removeAmount, 18).toString(),
          }),
          PREPARE_TIMEOUT_MS, 'Preparing transaction bundle',
        );
      } else if (action === 'stake') {
        resp = await withTimeout(
          avaxLpApi.prepareStake({
            userAddress: account.address,
            poolId: selectedPool.poolId,
            lpAmount: parseAmountToWei(stakeAmount, 18).toString(),
          }),
          PREPARE_TIMEOUT_MS, 'Preparing transaction bundle',
        );
      } else if (action === 'unstake') {
        resp = await withTimeout(
          avaxLpApi.prepareUnstake({
            userAddress: account.address,
            poolId: selectedPool.poolId,
            lpAmount: parseAmountToWei(unstakeAmount, 18).toString(),
          }),
          PREPARE_TIMEOUT_MS, 'Preparing transaction bundle',
        );
      } else {
        resp = await withTimeout(
          avaxLpApi.prepareClaimRewards({
            userAddress: account.address,
            poolId: selectedPool.poolId,
          }),
          PREPARE_TIMEOUT_MS, 'Preparing transaction bundle',
        );
      }

      return resp;
    })()
      .then((response) => {
        prepareCacheRef.current.set(cacheKey, { response, timestamp: Date.now() });
        return response;
      })
      .finally(() => { prepareInFlightRef.current.delete(cacheKey); });

    prepareInFlightRef.current.set(cacheKey, requestPromise);
    return requestPromise;
  }, [
    account?.address, action, amountA, amountB, removeAmount, stakeAmount, unstakeAmount,
    selectedPool, slippageBps, avaxLpApi,
  ]);

  const handleSelectAction = useCallback((nextAction: AvaxLpAction) => {
    setAction(nextAction);
    setError(null);
  }, []);

  const handleSelectPool = useCallback((nextPoolId: number) => {
    setPoolId(nextPoolId);
    setReviewPool(null);
    setError(null);
    resetTransactionState();
    setViewState('input');
  }, [resetTransactionState]);

  const handleQuickClaim = useCallback((nextPoolId: number) => {
    setAction('claim');
    handleSelectPool(nextPoolId);
  }, [handleSelectPool]);

  const handleQuickRemove = useCallback((nextPoolId: number) => {
    setAction('remove');
    handleSelectPool(nextPoolId);
  }, [handleSelectPool]);

  // Prewarm prepare cache on input changes
  useEffect(() => {
    if (viewState !== 'input') return;
    if (!account?.address || !selectedPool) return;
    if (action === 'add' && (!amountA || parseFloat(amountA) <= 0 || !amountB || parseFloat(amountB) <= 0)) return;
    if (action === 'remove' && (!removeAmount || parseFloat(removeAmount) <= 0)) return;
    if (action === 'stake' && (!stakeAmount || parseFloat(stakeAmount) <= 0)) return;
    if (action === 'unstake' && (!unstakeAmount || parseFloat(unstakeAmount) <= 0)) return;

    const timer = window.setTimeout(() => {
      void loadPrepareResponse().catch(() => {});
    }, PREPARE_PREWARM_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [
    account?.address, action, amountA, amountB, removeAmount, stakeAmount, unstakeAmount,
    loadPrepareResponse, selectedPool, viewState,
  ]);

  const handlePrepare = useCallback(async () => {
    if (isPreparing) return;
    if (!account?.address) { setError('Connect wallet to continue.'); return; }
    if (!selectedPool) { setError('Select a pool first.'); setViewState('select'); return; }

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
    } catch (err) {
      safeSet(() => {
        setError(getErrorMessage(err, 'Failed to prepare transaction.'));
        setTxStage('failed');
      });
    } finally {
      safeSet(() => setIsPreparing(false));
    }
  }, [account?.address, selectedPool, isPreparing, loadPrepareResponse, safeSet]);

  const markStep = useCallback((index: number, stage: YieldTxStepStage, txHash: string | null = null) => {
    setTxSteps((prev) => prev.map((step, i) => {
      if (i !== index) return step;
      return { ...step, stage, txHash: txHash ?? step.txHash };
    }));
  }, []);

  const handleExecute = useCallback(async () => {
    if (!prepareResponse || !account?.address) return;
    if (isExecutingRef.current) return;
    if (txStage === 'awaiting_wallet' || txStage === 'pending' || txStage === 'recovering') return;

    isExecutingRef.current = true;

    try {
      safeSet(() => { setViewState('status'); setTxStage('awaiting_wallet'); setError(null); });

      const results: TransactionExecutionStatus[] = [];

      for (let i = 0; i < prepareResponse.bundle.steps.length; i += 1) {
        const step = prepareResponse.bundle.steps[i];

        safeSet(() => { markStep(i, 'awaiting_wallet'); setTxStage('awaiting_wallet'); });

        try {
          const result = await avaxLpApi.executeTransaction(step);
          results.push(result);

          safeSet(() => {
            if (result.source === 'recovered') { markStep(i, 'recovering'); setTxStage('recovering'); }
            markStep(i, 'confirmed', result.transactionHash);
            if (i < prepareResponse.bundle.steps.length - 1) setTxStage('pending');
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

      safeSet(() => setTxStage('confirmed'));
      await refresh();
    } finally {
      isExecutingRef.current = false;
    }
  }, [account?.address, avaxLpApi, markStep, prepareResponse, refresh, safeSet, txStage]);

  const handleBack = useCallback(() => {
    setError(null);
    if (viewState === 'status') { if (txStage === 'failed') { setViewState('review'); return; } onClose(); return; }
    if (viewState === 'review') { setViewState('input'); return; }
    if (viewState === 'input') { setViewState('select'); return; }
    onClose();
  }, [onClose, txStage, viewState]);

  const handleRetry = useCallback(() => {
    if (!prepareResponse) return;
    setError(null);
    setTxStage('idle');
    setTxSteps(buildTxSteps(prepareResponse.bundle));
    setViewState('review');
  }, [prepareResponse]);

  const handleViewPosition = useCallback(async () => {
    setIsNavigatingToPositions(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      await refresh();
    } finally {
      setIsNavigatingToPositions(false);
    }
    setSelectTab('positions');
    setPoolId(null);
    setReviewPool(null);
    setError(null);
    resetTransactionState();
    setViewState('select');
  }, [resetTransactionState, refresh]);

  const handleNewPosition = useCallback(() => {
    setAction('add');
    setPoolId(null);
    setAmountA('');
    setAmountB('');
    setRemoveAmount('');
    setStakeAmount('');
    setUnstakeAmount('');
    setReviewPool(null);
    setError(null);
    setSelectTab(undefined);
    resetTransactionState();
    setViewState('select');
  }, [resetTransactionState]);

  const reviewPoolData = useMemo<AvaxLpPool | null>(
    () => selectedPool ?? reviewPool,
    [reviewPool, selectedPool],
  );

  const viewTitles: Record<ViewState, string> = {
    select: 'Yield — Avalanche LP',
    input: ACTION_TITLES[action] ?? 'TraderJoe LP',
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
        <Layers className="w-5 h-5 text-orange-400" />
        <h2 className="text-lg font-display font-bold text-white">{viewTitles[viewState]}</h2>
      </div>
    </div>
  ) : null;

  const footer = (
    <div className="py-4 flex items-center justify-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
      <img
        src="https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png"
        alt="Avalanche"
        className="w-4 h-4 rounded-full object-contain"
      />
      <img src={TOKEN_ICONS.JOE} alt="TraderJoe" className="w-4 h-4 rounded-full object-contain" />
      <span className="text-[10px] sm:text-xs font-medium text-zinc-500">Powered by TraderJoe on Avalanche</span>
    </div>
  );

  return (
    <DefiWidgetModalShell
      dataTour="widget-avax-lp"
      onClose={onClose}
      variant={variant}
      isMobile={isMobile}
      header={header}
      footer={footer}
      gradientClassName="bg-orange-500/10"
      cardClassName="md:min-h-[540px]"
      bodyClassName="custom-scrollbar"
    >
      <AnimatePresence mode="wait">
        {viewState === 'select' && (
          <AvaxLpSelectView
            key={selectTab ?? 'default'}
            pools={pools}
            userPositions={positions}
            loading={loading}
            userLoading={userLoading}
            error={dataError}
            onRetry={() => { void refresh(); }}
            onSelectPool={handleSelectPool}
            onQuickClaim={handleQuickClaim}
            onQuickRemove={handleQuickRemove}
            initialTab={selectTab}
          />
        )}

        {viewState === 'input' && selectedPool && (
          <AvaxLpInputView
            action={action}
            onSelectAction={handleSelectAction}
            pool={selectedPool}
            amountA={amountA}
            amountB={amountB}
            setAmountA={setAmountA}
            setAmountB={setAmountB}
            removeAmount={removeAmount}
            setRemoveAmount={setRemoveAmount}
            stakeAmount={stakeAmount}
            setStakeAmount={setStakeAmount}
            unstakeAmount={unstakeAmount}
            setUnstakeAmount={setUnstakeAmount}
            slippageBps={slippageBps}
            setSlippageBps={setSlippageBps}
            userPosition={selectedPosition}
            walletBalances={liveWalletBalances}
            walletLpBalanceWei={liveWalletLpBalanceWei}
            error={error ?? dataError}
            walletConnected={!!account?.address}
            isPreparing={isPreparing}
            onContinue={handlePrepare}
          />
        )}

        {viewState === 'review' && (
          <AvaxLpReviewView
            action={action}
            pool={reviewPoolData}
            amountA={amountA}
            amountB={amountB}
            removeAmount={removeAmount}
            stakeAmount={stakeAmount}
            unstakeAmount={unstakeAmount}
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
          <AvaxLpStatusView
            action={action}
            txStage={txStage}
            txSteps={txSteps}
            error={error}
            onClose={onClose}
            onRetry={handleRetry}
            onViewPosition={() => { void handleViewPosition(); }}
            isNavigatingToPositions={isNavigatingToPositions}
            onNewPosition={handleNewPosition}
          />
        )}
      </AnimatePresence>
    </DefiWidgetModalShell>
  );
}
