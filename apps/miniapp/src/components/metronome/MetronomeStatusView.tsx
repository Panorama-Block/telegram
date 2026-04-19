'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { MetronomeUiAction } from '@/features/metronome/types';
import type { MetronomeTxStage, MetronomeTxStep } from './metronomeTxState';
import {
  canRetryMetronomeTx,
  getMetronomeStepStatusClass,
  getMetronomeStepStatusLabel,
} from './metronomeTxState';

export interface MetronomeStatusViewProps {
  action:    MetronomeUiAction;
  txStage:   MetronomeTxStage;
  txSteps:   MetronomeTxStep[];
  error:     string | null;
  onClose:   () => void;
  onRetry:   () => void;
  onNew:     () => void;
}

const TITLE: Record<MetronomeUiAction, string> = {
  deposit:  'Deposit',
  withdraw: 'Withdrawal',
  mint:     'Mint',
  repay:    'Repay',
  unwind:   'Unwind',
};

export function MetronomeStatusView({
  action,
  txStage,
  txSteps,
  error,
  onClose,
  onRetry,
  onNew,
}: MetronomeStatusViewProps) {
  const confirmed = txStage === 'confirmed';
  const failed = txStage === 'failed' || txStage === 'partial_confirmed';
  const inFlight = txStage === 'awaiting_wallet' || txStage === 'pending' || txStage === 'recovering';

  return (
    <motion.div
      key="status"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col h-full"
    >
      <div className="px-4 sm:px-6 py-6 flex-1 overflow-y-auto custom-scrollbar space-y-5">
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              confirmed
                ? 'bg-emerald-500/10 border border-emerald-500/30'
                : failed
                ? 'bg-red-500/10 border border-red-500/30'
                : 'bg-fuchsia-500/10 border border-fuchsia-500/30'
            }`}
          >
            {confirmed ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            ) : failed ? (
              txStage === 'partial_confirmed'
                ? <AlertTriangle className="w-7 h-7 text-amber-400" />
                : <XCircle className="w-7 h-7 text-red-400" />
            ) : (
              <Loader2 className="w-7 h-7 animate-spin text-fuchsia-300" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {confirmed
                ? `${TITLE[action]} confirmed`
                : txStage === 'partial_confirmed'
                ? `${TITLE[action]} partially confirmed`
                : failed
                ? `${TITLE[action]} failed`
                : `${TITLE[action]} in progress`}
            </h3>
            {inFlight && (
              <p className="text-[11px] text-zinc-500 mt-0.5">Follow the wallet prompts to confirm each step.</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {txSteps.map((step, i) => (
            <div
              key={step.id}
              className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5"
            >
              <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-zinc-400 shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">{step.label}</div>
                <div className={`text-[10px] ${getMetronomeStepStatusClass(step.stage)}`}>
                  {getMetronomeStepStatusLabel(step.stage)}
                </div>
                {step.txHash && (
                  <a
                    href={`https://basescan.org/tx/${step.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-fuchsia-300 hover:text-fuchsia-200 underline break-all"
                  >
                    {step.txHash.slice(0, 10)}…{step.txHash.slice(-8)}
                  </a>
                )}
              </div>
              {step.stage === 'confirmed' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {step.stage === 'failed' && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      <div className="px-4 sm:px-6 pb-3 pt-2 border-t border-white/5 flex gap-2">
        {canRetryMetronomeTx(txStage) ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onRetry}
              className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-500/30 text-fuchsia-100 transition-colors"
            >
              Retry
            </button>
          </>
        ) : confirmed ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onNew}
              className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-500/30 text-fuchsia-100 transition-colors"
            >
              New action
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled
            className="w-full py-3 rounded-xl text-sm font-semibold bg-white/5 border border-white/10 text-zinc-500 cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            In progress…
          </button>
        )}
      </div>
    </motion.div>
  );
}
