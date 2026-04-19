'use client';

import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import type {
  PrepareResponse,
  MetronomeUiAction,
} from '@/features/metronome/types';
import type { MetronomeTxStage, MetronomeTxStep } from './metronomeTxState';
import { getMetronomeStepStatusClass, getMetronomeStepStatusLabel } from './metronomeTxState';

export interface MetronomeReviewViewProps {
  action:          MetronomeUiAction;
  amount:          string;
  prepareResponse: PrepareResponse | null;
  txStage:         MetronomeTxStage;
  txSteps:         MetronomeTxStep[];
  error:           string | null;
  onExecute:       () => void;
  onBack:          () => void;
}

const TITLE: Record<MetronomeUiAction, string> = {
  deposit:  'Confirm deposit',
  withdraw: 'Confirm withdrawal',
  mint:     'Confirm mint',
  repay:    'Confirm repay',
  unwind:   'Confirm unwind',
};

export function MetronomeReviewView({
  action,
  amount,
  prepareResponse,
  txStage,
  txSteps,
  error,
  onExecute,
  onBack,
}: MetronomeReviewViewProps) {
  const preparing = txStage === 'preparing' || !prepareResponse;
  const executing = txStage === 'awaiting_wallet' || txStage === 'pending' || txStage === 'recovering';

  return (
    <motion.div
      key="review"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <div className="px-4 sm:px-6 pb-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">{TITLE[action]}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Review the prepared transaction bundle before signing.</p>
        </div>

        {preparing ? (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-4 text-xs text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparing transaction bundle…
          </div>
        ) : (
          <>
            {prepareResponse?.bundle.summary && (
              <div className="rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/20 px-3 py-2.5 text-xs text-fuchsia-200">
                {prepareResponse.bundle.summary}
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Amount</span>
              <span className="text-white font-mono">{amount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Steps</span>
              <span className="text-white">{prepareResponse?.bundle.totalSteps ?? txSteps.length}</span>
            </div>

            <div className="space-y-2">
              <h4 className="text-[11px] uppercase tracking-wider text-zinc-500 px-1">Bundle</h4>
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
                  </div>
                  {step.stage === 'confirmed' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                </div>
              ))}
            </div>
          </>
        )}

        {error && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      <div className="px-4 sm:px-6 pb-3 pt-2 border-t border-white/5 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={executing}
          className="flex-1 py-3 rounded-xl text-sm font-medium bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onExecute}
          disabled={preparing || executing || !prepareResponse}
          className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-500/30 text-fuchsia-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {executing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Waiting on wallet…
            </>
          ) : (
            <>
              Execute <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
