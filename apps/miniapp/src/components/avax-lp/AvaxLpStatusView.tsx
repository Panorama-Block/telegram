import { motion } from 'framer-motion';
import { AlertCircle, Check, ExternalLink, Loader2 } from 'lucide-react';
import { NeonButton } from '@/components/ui/NeonButton';
import {
  canRetryYieldTx,
  getYieldStepStatusClass,
  getYieldStepStatusLabel,
  type YieldTxStage,
  type YieldTxStep,
} from '@/components/yield/yieldTxState';
import { SNOWTRACE_URL } from '@/features/avax-lp/config';
import type { AvaxLpAction } from '@/features/avax-lp/types';

const ACTION_LABELS: Record<AvaxLpAction, string> = {
  enter: 'Enter Position',
  exit:  'Exit Position',
  claim: 'Claim Rewards',
};

interface AvaxLpStatusViewProps {
  action: AvaxLpAction;
  txStage: YieldTxStage;
  txSteps: YieldTxStep[];
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  onViewPosition: () => void;
  isNavigatingToPositions?: boolean;
  onNewPosition: () => void;
}

export function AvaxLpStatusView({
  action,
  txStage,
  txSteps,
  error,
  onClose,
  onRetry,
  onViewPosition,
  isNavigatingToPositions = false,
  onNewPosition,
}: AvaxLpStatusViewProps) {
  const isSuccess = txStage === 'confirmed';
  const isPartial = txStage === 'partial_confirmed';
  const isFailed = txStage === 'failed';
  const isExecuting = txStage === 'awaiting_wallet' || txStage === 'pending' || txStage === 'recovering';

  const completedSteps = txSteps.filter((step) => step.stage === 'confirmed').length;
  const totalSteps = txSteps.length;

  const heading = isSuccess
    ? 'Transaction Successful'
    : isPartial
      ? 'Partially Executed'
      : isFailed
        ? 'Transaction Failed'
        : txStage === 'awaiting_wallet'
          ? 'Confirm in wallet'
          : txStage === 'recovering'
            ? 'Recovering transaction hash'
            : txStage === 'pending'
              ? 'Executing bundle'
              : 'Processing transaction';

  return (
    <motion.div
      key="status"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col h-full"
    >
      <div className="px-4 sm:px-6 pb-6 flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        <div className="pt-2 flex flex-col items-center text-center gap-2">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center border ${
            isSuccess
              ? 'bg-orange-500/20 border-orange-500/30'
              : isPartial
                ? 'bg-amber-500/20 border-amber-500/30'
                : isFailed
                  ? 'bg-red-500/20 border-red-500/30'
                  : 'bg-orange-500/10 border-orange-500/20'
          }`}>
            {isSuccess ? (
              <Check className="w-8 h-8 text-orange-300" />
            ) : isPartial ? (
              <AlertCircle className="w-8 h-8 text-amber-300" />
            ) : isFailed ? (
              <AlertCircle className="w-8 h-8 text-red-400" />
            ) : (
              <Loader2 className="w-7 h-7 text-orange-300 animate-spin" />
            )}
          </div>

          <p className="text-lg font-medium text-white">{heading}</p>
          <p className="text-sm text-zinc-500">
            {ACTION_LABELS[action]} on Avalanche
          </p>
          {totalSteps > 0 && (
            <p className="text-xs text-zinc-400">
              {completedSteps}/{totalSteps} steps completed
            </p>
          )}
        </div>

        <div className="space-y-2">
          {txSteps.map((step, index) => (
            <div key={step.id} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-300">
                  {index + 1}/{totalSteps} {step.label}
                </span>
                <span className={`text-[11px] font-medium ${getYieldStepStatusClass(step.stage)}`}>
                  {getYieldStepStatusLabel(step.stage)}
                </span>
              </div>
              {step.txHash && (
                <a
                  href={`${SNOWTRACE_URL}${step.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[11px] text-orange-300 hover:text-orange-200 transition-colors"
                >
                  <span className="font-mono truncate flex-1">{step.txHash}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="flex-1" />

        {isSuccess ? (
          <div className="space-y-2">
            <NeonButton onClick={onViewPosition} disabled={isNavigatingToPositions}>
              {isNavigatingToPositions ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading positions...
                </span>
              ) : 'View Position'}
            </NeonButton>
            <NeonButton onClick={onNewPosition} className="bg-white/10 hover:bg-white/15 shadow-none text-white">
              New Position
            </NeonButton>
          </div>
        ) : isExecuting ? (
          <NeonButton onClick={onClose} className="bg-white/10 hover:bg-white/15 shadow-none text-white">
            Close
          </NeonButton>
        ) : (
          <div className="space-y-2">
            {canRetryYieldTx(txStage) && (
              <NeonButton onClick={onRetry}>Try Again</NeonButton>
            )}
            <NeonButton onClick={onClose} className="bg-white/10 hover:bg-white/15 shadow-none text-white">
              Close
            </NeonButton>
          </div>
        )}
      </div>
    </motion.div>
  );
}
