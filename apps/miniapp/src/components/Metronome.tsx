'use client';

/**
 * Metronome Synth widget — UI orchestrator.
 *
 * Owns the select → input → review → status view machine, drives the
 * prepare-* request against MetronomeApiClient, and sends each prepared
 * step through the connected ThirdWeb wallet.
 *
 * Transaction execution is intentionally simpler than yield's helper for
 * now. Phase 3 (REFACTOR_PLAN.md) will extract a shared executor that all
 * DeFi widgets can reuse — until then, duplicating the minimum required
 * logic here keeps Metronome unblocked without importing the complex
 * yield-specific recovery paths.
 */

import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, Activity, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defineChain } from 'thirdweb/chains';
import { useActiveAccount, useSwitchActiveWalletChain } from 'thirdweb/react';
import { DefiWidgetModalShell } from '@/components/ui/DefiWidgetModalShell';
import { useIsMobileBreakpoint } from '@/shared/hooks/useIsMobileBreakpoint';
import { useMetronomeApi } from '@/features/metronome/api';
import { METRONOME_BASE_CHAIN_ID, METRONOME_CONFIG } from '@/features/metronome/config';
import { useMetronomeData } from '@/features/metronome/useMetronomeData';
import type {
  CollateralMarket,
  PrepareResponse,
  PreparedTransaction,
  SyntheticMarket,
  MetronomeUiAction,
} from '@/features/metronome/types';
import { parseAmountToWei } from '@/features/swap/utils';
import {
  MetronomeSelectView,
} from '@/components/metronome/MetronomeSelectView';
import { MetronomeInputView } from '@/components/metronome/MetronomeInputView';
import { MetronomeReviewView } from '@/components/metronome/MetronomeReviewView';
import { MetronomeStatusView } from '@/components/metronome/MetronomeStatusView';
import type {
  MetronomeTxStage,
  MetronomeTxStep,
  MetronomeTxStepStage,
} from '@/components/metronome/metronomeTxState';

type ViewState = 'select' | 'input' | 'review' | 'status';

export interface MetronomeProps {
  onClose:          () => void;
  initialAction?:   MetronomeUiAction;
  initialAmount?:   string | number;
  initialCollateralSymbol?: string;
  initialSynthSymbol?: string;
  variant?:         'modal' | 'panel';
}

const TITLE_BY_VIEW: Record<ViewState, string> = {
  select: 'Metronome',
  input:  'Metronome',
  review: 'Review',
  status: 'Status',
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function buildTxSteps(bundle: PrepareResponse['bundle']): MetronomeTxStep[] {
  return bundle.steps.map((step, i) => ({
    id:     `step-${i}`,
    label:  step.description || `Step ${i + 1}`,
    stage:  'queued' as MetronomeTxStepStage,
    txHash: null,
  }));
}

function toHex(value?: string): string | undefined {
  if (value == null || value === '') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('0x')) return trimmed;
  try {
    return `0x${BigInt(trimmed).toString(16)}`;
  } catch {
    return undefined;
  }
}

function extractTxHash(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)) return value;
  if (typeof value === 'object' && value !== null) {
    const candidate = (value as { transactionHash?: string; hash?: string }).transactionHash
      ?? (value as { hash?: string }).hash;
    if (typeof candidate === 'string' && /^0x[0-9a-fA-F]{64}$/.test(candidate)) return candidate;
  }
  return null;
}

export function Metronome({
  onClose,
  initialAction,
  initialAmount,
  initialCollateralSymbol,
  initialSynthSymbol,
  variant = 'modal',
}: MetronomeProps) {
  const account = useActiveAccount();
  const switchChain = useSwitchActiveWalletChain();
  const api = useMetronomeApi();
  const isMobile = useIsMobileBreakpoint();

  const {
    markets,
    position,
    collateralRows,
    debtRows,
    loading,
    positionLoading,
    error: dataError,
    refresh,
  } = useMetronomeData();

  const [viewState, setViewState] = useState<ViewState>('select');
  const [action, setAction] = useState<MetronomeUiAction>(initialAction ?? 'deposit');
  const [selectedCollateral, setSelectedCollateral] = useState<CollateralMarket | null>(null);
  const [selectedSynth, setSelectedSynth] = useState<SyntheticMarket | null>(null);
  const [amount, setAmount] = useState<string>(initialAmount != null ? String(initialAmount) : '');

  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareResponse, setPrepareResponse] = useState<PrepareResponse | null>(null);
  const [txStage, setTxStage] = useState<MetronomeTxStage>('idle');
  const [txSteps, setTxSteps] = useState<MetronomeTxStep[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const isExecutingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const safeSet = useCallback((fn: () => void) => {
    if (mountedRef.current) fn();
  }, []);

  // Resolve initial collateral/synth from URL symbols once markets load.
  useEffect(() => {
    if (!markets) return;
    if (initialCollateralSymbol && !selectedCollateral) {
      const match = markets.collateral.find(
        (m) => m.underlyingSymbol.toLowerCase() === initialCollateralSymbol.toLowerCase()
          || m.symbol.toLowerCase() === initialCollateralSymbol.toLowerCase(),
      );
      if (match) setSelectedCollateral(match);
    }
    if (initialSynthSymbol && !selectedSynth) {
      const match = markets.synthetic.find(
        (m) => m.symbol.toLowerCase() === initialSynthSymbol.toLowerCase(),
      );
      if (match) setSelectedSynth(match);
    }
  }, [markets, initialCollateralSymbol, initialSynthSymbol, selectedCollateral, selectedSynth]);

  // Jump straight to input if we arrived with enough context.
  useEffect(() => {
    if (viewState !== 'select') return;
    if (!initialAction) return;
    if ((initialAction === 'deposit' || initialAction === 'withdraw') && selectedCollateral) {
      setViewState('input');
    } else if ((initialAction === 'mint' || initialAction === 'repay' || initialAction === 'unwind') && selectedSynth) {
      setViewState('input');
    }
  }, [viewState, initialAction, selectedCollateral, selectedSynth]);

  const debtForSelectedSynth = useMemo(() => {
    if (!selectedSynth || !position) return null;
    return position.debt.find((d) => d.symbol === selectedSynth.symbol)?.debt ?? '0';
  }, [selectedSynth, position]);

  const sharesForSelectedCollateral = useMemo(() => {
    if (!selectedCollateral || !position) return null;
    return position.collateral.find((c) => c.symbol === selectedCollateral.symbol)?.shares ?? '0';
  }, [selectedCollateral, position]);

  const handlePickAction = useCallback(
    (next: MetronomeUiAction, target: { collateral?: CollateralMarket; synth?: SyntheticMarket }) => {
      setAction(next);
      if (target.collateral) setSelectedCollateral(target.collateral);
      if (target.synth)      setSelectedSynth(target.synth);
      setAmount('');
      setError(null);
      setPrepareResponse(null);
      setTxSteps([]);
      setTxStage('idle');
      setViewState('input');
    },
    [],
  );

  const ensureChain = useCallback(async () => {
    if (!switchChain) return;
    try {
      await switchChain(defineChain(METRONOME_BASE_CHAIN_ID));
    } catch {
      // already on Base or wallet refused — surface on send
    }
  }, [switchChain]);

  const buildPrepareRequest = useCallback(async (): Promise<PrepareResponse> => {
    if (!account?.address) throw new Error('Connect wallet to continue.');
    const userAddress = account.address;

    if (action === 'deposit') {
      if (!selectedCollateral) throw new Error('Select a collateral market.');
      const units = parseAmountToWei(amount, selectedCollateral.decimals).toString();
      return api.prepareDeposit({
        userAddress,
        depositTokenAddress: selectedCollateral.depositToken,
        amount: units,
      });
    }
    if (action === 'withdraw') {
      if (!selectedCollateral) throw new Error('Select a collateral market.');
      const units = parseAmountToWei(amount, 18).toString(); // shares are 18-dec
      return api.prepareWithdraw({
        userAddress,
        depositTokenAddress: selectedCollateral.depositToken,
        amount: units,
      });
    }
    if (action === 'mint') {
      if (!selectedSynth) throw new Error('Select a synth market.');
      const units = parseAmountToWei(amount, selectedSynth.decimals).toString();
      return api.prepareMint({
        userAddress,
        debtTokenAddress: selectedSynth.debtToken,
        amount: units,
      });
    }
    if (action === 'repay') {
      if (!selectedSynth) throw new Error('Select a synth market.');
      const units = parseAmountToWei(amount, selectedSynth.decimals).toString();
      return api.prepareRepay({
        userAddress,
        debtTokenAddress: selectedSynth.debtToken,
        amount: units,
      });
    }
    // unwind
    if (!selectedSynth || !selectedCollateral) {
      throw new Error('Unwind needs both a synth and a collateral target.');
    }
    const synthUnits = parseAmountToWei(amount, selectedSynth.decimals).toString();
    return api.prepareUnwind({
      userAddress,
      debtTokenAddress:    selectedSynth.debtToken,
      depositTokenAddress: selectedCollateral.depositToken,
      synthAmount:         synthUnits,
    });
  }, [action, amount, api, account?.address, selectedCollateral, selectedSynth]);

  const handlePrepare = useCallback(async () => {
    if (isPreparing) return;
    if (!account?.address) { setError('Connect wallet to continue.'); return; }
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount.'); return; }

    safeSet(() => {
      setError(null);
      setIsPreparing(true);
      setTxStage('preparing');
      setViewState('review');
    });

    try {
      const response = await buildPrepareRequest();
      safeSet(() => {
        setPrepareResponse(response);
        setTxSteps(buildTxSteps(response.bundle));
        setTxStage('idle');
      });
    } catch (err) {
      safeSet(() => {
        setError(errorMessage(err, 'Failed to prepare transaction.'));
        setTxStage('failed');
      });
    } finally {
      safeSet(() => { setIsPreparing(false); });
    }
  }, [isPreparing, account?.address, amount, buildPrepareRequest, safeSet]);

  const markStep = useCallback((index: number, stage: MetronomeTxStepStage, hash: string | null = null) => {
    setTxSteps((prev) => prev.map((step, i) => {
      if (i !== index) return step;
      return { ...step, stage, txHash: hash ?? step.txHash };
    }));
  }, []);

  const sendStep = useCallback(async (tx: PreparedTransaction): Promise<string> => {
    if (!account?.sendTransaction) throw new Error('Wallet does not support sendTransaction.');
    const target = {
      to: tx.to,
      data: tx.data,
      value: toHex(tx.value) ?? '0x0',
      chainId: Number(tx.chainId || METRONOME_BASE_CHAIN_ID),
    };
    const result = await account.sendTransaction(target as any);
    const hash = extractTxHash(result);
    if (!hash) throw new Error('Wallet returned no transaction hash.');
    return hash;
  }, [account]);

  const handleExecute = useCallback(async () => {
    if (!prepareResponse || !account?.address) return;
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;

    try {
      safeSet(() => {
        setViewState('status');
        setTxStage('awaiting_wallet');
        setError(null);
      });

      await ensureChain();

      const total = prepareResponse.bundle.steps.length;
      for (let i = 0; i < total; i += 1) {
        const step = prepareResponse.bundle.steps[i];
        safeSet(() => {
          markStep(i, 'awaiting_wallet');
          setTxStage('awaiting_wallet');
        });
        try {
          const hash = await sendStep(step);
          safeSet(() => {
            markStep(i, 'confirmed', hash);
            if (i < total - 1) setTxStage('pending');
          });
        } catch (err) {
          safeSet(() => {
            markStep(i, 'failed');
            if (i > 0) {
              setTxStage('partial_confirmed');
              setError(`${errorMessage(err, 'Transaction failed.')} Previous step(s) may already be submitted.`);
            } else {
              setTxStage('failed');
              setError(errorMessage(err, 'Transaction failed.'));
            }
          });
          return;
        }
      }

      safeSet(() => { setTxStage('confirmed'); });
      // Best-effort refresh; ignore errors.
      try { await refresh(); } catch { /* noop */ }
    } finally {
      isExecutingRef.current = false;
    }
  }, [account?.address, prepareResponse, ensureChain, sendStep, markStep, refresh, safeSet]);

  const handleBack = useCallback(() => {
    setError(null);
    if (viewState === 'status') {
      if (txStage === 'failed') { setViewState('review'); return; }
      onClose(); return;
    }
    if (viewState === 'review') { setViewState('input'); return; }
    if (viewState === 'input')  { setViewState('select'); return; }
    onClose();
  }, [viewState, txStage, onClose]);

  const handleRetry = useCallback(() => {
    if (!prepareResponse) return;
    setError(null);
    setTxStage('idle');
    setTxSteps(buildTxSteps(prepareResponse.bundle));
    setViewState('review');
  }, [prepareResponse]);

  const handleNew = useCallback(() => {
    setAction('deposit');
    setSelectedCollateral(null);
    setSelectedSynth(null);
    setAmount('');
    setPrepareResponse(null);
    setTxSteps([]);
    setTxStage('idle');
    setError(null);
    setViewState('select');
  }, []);

  const header = viewState !== 'status' ? (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={handleBack}
        className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
      >
        {viewState === 'select' ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
      </button>
      <div className="flex items-center gap-2 flex-1">
        <Activity className="w-5 h-5 text-fuchsia-400" />
        <h2 className="text-lg font-display font-bold text-white">{TITLE_BY_VIEW[viewState]}</h2>
      </div>
    </div>
  ) : null;

  const footer = (
    <div className="py-4 flex items-center justify-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
      <span className="text-[10px] sm:text-xs font-medium text-zinc-500">
        Powered by Metronome Synth on Base · {METRONOME_CONFIG.DEFAULT_SLIPPAGE_BPS / 100}% slippage
      </span>
    </div>
  );

  const inputError = error ?? (dataError && viewState === 'input' ? dataError.message : null);

  return (
    <DefiWidgetModalShell
      dataTour="widget-metronome"
      onClose={onClose}
      variant={variant}
      isMobile={isMobile}
      header={header}
      footer={footer}
      gradientClassName="bg-fuchsia-500/10"
      cardClassName="md:min-h-[540px]"
      bodyClassName="custom-scrollbar"
    >
      <AnimatePresence mode="wait">
        {viewState === 'select' && (
          <MetronomeSelectView
            markets={markets}
            collateralRows={collateralRows}
            debtRows={debtRows}
            loading={loading}
            positionLoading={positionLoading}
            error={dataError}
            walletConnected={Boolean(account?.address)}
            onRetry={() => { void refresh(); }}
            onPickAction={handlePickAction}
          />
        )}
        {viewState === 'input' && (
          <MetronomeInputView
            action={action}
            collateral={selectedCollateral ?? undefined}
            synth={selectedSynth ?? undefined}
            amount={amount}
            onAmountChange={setAmount}
            sharesBalance={sharesForSelectedCollateral}
            debtOutstanding={debtForSelectedSynth}
            walletBalance={null}
            synthBalance={null}
            error={inputError}
            walletConnected={Boolean(account?.address)}
            isPreparing={isPreparing}
            onContinue={handlePrepare}
          />
        )}
        {viewState === 'review' && (
          <MetronomeReviewView
            action={action}
            amount={amount}
            prepareResponse={prepareResponse}
            txStage={txStage}
            txSteps={txSteps}
            error={error}
            onExecute={handleExecute}
            onBack={handleBack}
          />
        )}
        {viewState === 'status' && (
          <MetronomeStatusView
            action={action}
            txStage={txStage}
            txSteps={txSteps}
            error={error}
            onClose={onClose}
            onRetry={handleRetry}
            onNew={handleNew}
          />
        )}
      </AnimatePresence>
    </DefiWidgetModalShell>
  );
}
