/**
 * Transaction state machine shared across Metronome view files.
 *
 * Mirrors the yield/lending pattern — a reusable shape so each step in the
 * prepared bundle can advance through queued → awaiting_wallet → pending →
 * confirmed (or failed) independently, while an umbrella `MetronomeTxStage`
 * drives the top-level status view.
 */

export type MetronomeTxStage =
  | 'idle'
  | 'preparing'
  | 'awaiting_wallet'
  | 'recovering'
  | 'pending'
  | 'confirmed'
  | 'partial_confirmed'
  | 'failed';

export type MetronomeTxStepStage =
  | 'queued'
  | 'awaiting_wallet'
  | 'recovering'
  | 'pending'
  | 'confirmed'
  | 'failed';

export interface MetronomeTxStep {
  id:     string;
  label:  string;
  stage:  MetronomeTxStepStage;
  txHash: string | null;
}

export function getMetronomeStepStatusLabel(stage: MetronomeTxStepStage): string {
  if (stage === 'awaiting_wallet') return 'Confirm in wallet';
  if (stage === 'recovering')      return 'Recovering hash';
  if (stage === 'pending')         return 'Pending';
  if (stage === 'confirmed')       return 'Confirmed';
  if (stage === 'failed')          return 'Failed';
  return 'Queued';
}

export function getMetronomeStepStatusClass(stage: MetronomeTxStepStage): string {
  if (stage === 'confirmed')                                                              return 'text-emerald-400';
  if (stage === 'failed')                                                                 return 'text-red-400';
  if (stage === 'pending' || stage === 'awaiting_wallet' || stage === 'recovering')       return 'text-cyan-300';
  return 'text-zinc-500';
}

export function canRetryMetronomeTx(stage: MetronomeTxStage): boolean {
  return stage === 'failed' || stage === 'partial_confirmed';
}
