export type YieldTxStage =
  | 'idle'
  | 'preparing'
  | 'awaiting_wallet'
  | 'recovering'
  | 'pending'
  | 'confirmed'
  | 'partial_confirmed'
  | 'failed';
export type YieldTxStepStage = 'queued' | 'awaiting_wallet' | 'recovering' | 'pending' | 'confirmed' | 'failed';

export interface YieldTxStep {
  id: string;
  label: string;
  stage: YieldTxStepStage;
  txHash: string | null;
}

export function getYieldStepStatusLabel(stage: YieldTxStepStage): string {
  if (stage === 'awaiting_wallet') return 'Confirm in wallet';
  if (stage === 'recovering') return 'Recovering hash';
  if (stage === 'pending') return 'Pending';
  if (stage === 'confirmed') return 'Confirmed';
  if (stage === 'failed') return 'Failed';
  return 'Queued';
}

export function getYieldStepStatusClass(stage: YieldTxStepStage): string {
  if (stage === 'confirmed') return 'text-emerald-400';
  if (stage === 'failed') return 'text-red-400';
  if (stage === 'pending' || stage === 'awaiting_wallet' || stage === 'recovering') return 'text-cyan-300';
  return 'text-zinc-500';
}

export function canRetryYieldTx(stage: YieldTxStage): boolean {
  return stage === 'failed' || stage === 'partial_confirmed';
}
