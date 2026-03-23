import { motion } from 'framer-motion';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { NeonButton } from '@/components/ui/NeonButton';
import { getYieldStepStatusClass, getYieldStepStatusLabel, type YieldTxStage, type YieldTxStep } from '@/components/yield/yieldTxState';
import type { YieldAction, YieldPoolWithAPR, YieldPrepareResponse } from '@/features/yield/types';
import { formatAmountHuman } from '@/features/swap/utils';

const ACTION_LABELS: Record<YieldAction, string> = {
  enter: 'Enter Position',
  exit: 'Exit Position',
  claim: 'Claim Rewards',
};

function truncateAddress(value: string | null): string {
  if (!value) return '--';
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getMetaString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

interface YieldReviewViewProps {
  action: YieldAction;
  pool: YieldPoolWithAPR | null;
  amountA: string;
  amountB: string;
  exitAmount: string;
  slippageBps: number;
  prepareResponse: YieldPrepareResponse | null;
  txStage: YieldTxStage;
  txSteps: YieldTxStep[];
  error: string | null;
  onExecute: () => void;
  onBack: () => void;
}

export function YieldReviewView({
  action,
  pool,
  amountA,
  amountB,
  exitAmount,
  slippageBps,
  prepareResponse,
  txStage,
  txSteps,
  error,
  onExecute,
  onBack,
}: YieldReviewViewProps) {
  const isBusy = txStage === 'awaiting_wallet' || txStage === 'pending' || txStage === 'recovering';

  if (txStage === 'preparing') {
    return (
      <motion.div
        key="review-loading"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex flex-col h-full"
      >
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-12">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-sm text-zinc-400">Preparing transaction bundle...</p>
        </div>
      </motion.div>
    );
  }

  if (!prepareResponse && error) {
    return (
      <motion.div
        key="review-error"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex flex-col h-full"
      >
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-12">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-red-400 text-center">{error}</p>
          <button
            onClick={onBack}
            className="text-sm text-zinc-400 hover:text-white transition-colors mt-2"
          >
            Go Back
          </button>
        </div>
      </motion.div>
    );
  }

  if (!prepareResponse) return null;

  if (!pool) {
    return (
      <motion.div
        key="review-missing-pool"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex flex-col h-full"
      >
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-12">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-red-400 text-center">
            Pool context unavailable. Please go back and select the pool again.
          </p>
          <button
            onClick={onBack}
            className="text-sm text-zinc-400 hover:text-white transition-colors mt-2"
          >
            Go Back
          </button>
        </div>
      </motion.div>
    );
  }

  const metadata = prepareResponse.metadata as Record<string, unknown>;
  const bundle = prepareResponse.bundle;

  const poolAddress = getMetaString(metadata, 'poolAddress');
  const gaugeAddress = getMetaString(metadata, 'gaugeAddress');
  const estimatedLiquidity = getMetaString(metadata, 'estimatedLiquidity');
  const lpAmount = getMetaString(metadata, 'lpAmount');

  const displaySteps = txSteps.length > 0
    ? txSteps
    : bundle.steps.map((step, index) => ({
        id: `step-${index}`,
        label: step.description || `Step ${index + 1}`,
        stage: 'queued' as const,
        txHash: null,
      }));

  return (
    <motion.div
      key="review"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <div className="px-4 sm:px-6 pb-6 space-y-3 relative z-10 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between pt-1">
          <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-[10px] font-bold rounded border border-cyan-500/20 flex items-center gap-1">
            <Check className="w-3 h-3" />
            {ACTION_LABELS[action]}
          </span>
          <span className="text-xs text-zinc-500">{bundle.totalSteps} steps</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Pool</span>
            <span className="text-white font-medium">{pool.tokenA.symbol} / {pool.tokenB.symbol}</span>
          </div>

          {action === 'enter' && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">{pool.tokenA.symbol}</span>
                <span className="text-white font-mono">{amountA}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">{pool.tokenB.symbol}</span>
                <span className="text-white font-mono">{amountB}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Slippage tolerance</span>
                <span className="text-white">{(slippageBps / 100).toFixed(1)}%</span>
              </div>
              {estimatedLiquidity && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Estimated LP output</span>
                  <span className="text-cyan-300 font-mono">
                    {formatAmountHuman(BigInt(estimatedLiquidity), 18, 8)} LP
                  </span>
                </div>
              )}
            </>
          )}

          {action === 'exit' && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">LP amount</span>
                <span className="text-white font-mono">{exitAmount}</span>
              </div>
              {lpAmount && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">LP to remove</span>
                  <span className="text-cyan-300 font-mono">
                    {formatAmountHuman(BigInt(lpAmount), 18, 8)} LP
                  </span>
                </div>
              )}
            </>
          )}

          {action === 'claim' && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Action</span>
              <span className="text-cyan-300">Claim all pending rewards</span>
            </div>
          )}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Bundle details</div>
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Pool address</span>
            <span className="text-zinc-300 font-mono">{truncateAddress(poolAddress)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Gauge</span>
            <span className="text-zinc-300 font-mono">{truncateAddress(gaugeAddress)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Reward token</span>
            <span className="text-zinc-300">{pool.rewardToken.symbol}</span>
          </div>
        </div>

        <div className="space-y-2">
          {displaySteps.map((step, index) => (
            <div
              key={step.id}
              className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2"
            >
              <span className="text-xs text-zinc-300">
                {index + 1}. {step.label}
              </span>
              <span className={`text-[11px] font-medium ${getYieldStepStatusClass(step.stage)}`}>
                {getYieldStepStatusLabel(step.stage)}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="flex-1" />

        <NeonButton onClick={onExecute} disabled={isBusy}>
          {isBusy ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Executing...
            </span>
          ) : (
            `Execute ${ACTION_LABELS[action]}`
          )}
        </NeonButton>
      </div>
    </motion.div>
  );
}
