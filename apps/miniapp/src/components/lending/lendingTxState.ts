export type LendingTxStage = 'idle' | 'awaiting_wallet' | 'pending' | 'confirmed' | 'failed' | 'timeout';
export type LendingTxStepStage = 'queued' | 'awaiting_wallet' | 'pending' | 'confirmed' | 'failed' | 'timeout';

export function getLendingStepStatusLabel(stage: LendingTxStepStage): string {
  if (stage === 'awaiting_wallet') return 'Confirm in wallet';
  if (stage === 'pending') return 'Pending';
  if (stage === 'confirmed') return 'Confirmed';
  if (stage === 'timeout') return 'Submitted';
  if (stage === 'failed') return 'Failed';
  return 'Queued';
}

export function getLendingStepStatusClass(stage: LendingTxStepStage): string {
  if (stage === 'confirmed') return 'text-emerald-400';
  if (stage === 'timeout') return 'text-amber-300';
  if (stage === 'failed') return 'text-red-300';
  if (stage === 'pending' || stage === 'awaiting_wallet') return 'text-cyan-300';
  return 'text-zinc-500';
}

export function canRetryLendingTx(stage: LendingTxStage): boolean {
  return stage === 'failed' || stage === 'timeout';
}
