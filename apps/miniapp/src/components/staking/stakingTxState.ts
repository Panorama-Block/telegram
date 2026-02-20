type StakingMode = 'stake' | 'unstake';
type UnstakeMethod = 'instant' | 'queue';

export type StakingTxStage = 'idle' | 'awaiting_wallet' | 'pending' | 'confirmed' | 'failed' | 'timeout';

export function getStakingStatusTitle(
  stage: StakingTxStage,
  mode: StakingMode,
  unstakeMethod: UnstakeMethod,
): string {
  if (stage === 'awaiting_wallet') return 'Confirm in wallet';
  if (stage === 'pending') return 'Pending confirmation';
  if (stage === 'confirmed') {
    return mode === 'unstake' && unstakeMethod === 'queue' ? 'Request submitted' : 'Confirmed';
  }
  if (stage === 'timeout') return 'Submitted';
  if (stage === 'failed') return 'Transaction failed';
  return 'Transaction';
}

export function shouldShowQueueCompletionHint(
  stage: StakingTxStage,
  mode: StakingMode,
  unstakeMethod: UnstakeMethod,
): boolean {
  return stage === 'confirmed' && mode === 'unstake' && unstakeMethod === 'queue';
}

export function canRetryStakingTx(stage: StakingTxStage): boolean {
  return stage === 'failed' || stage === 'timeout';
}
