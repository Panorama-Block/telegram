import { motion } from "framer-motion";
import { AlertCircle, Check, ExternalLink, RefreshCcw } from "lucide-react";
import { NeonButton } from "@/components/ui/NeonButton";
import {
  canRetryStakingTx,
  getStakingStatusTitle,
  shouldShowQueueCompletionHint,
  type StakingTxStage,
} from "@/components/staking/stakingTxState";

type ActionMode = "stake" | "unstake";

interface UnstakeStep {
  current: number;
  total: number;
  label: string;
}

type UnstakeStepIndicatorProps = {
  currentStep: number;
  totalSteps: number;
  label: string;
  stage: string;
  hasPendingWithdrawals: boolean;
  hasClaimable: boolean;
};

function UnstakeStepIndicator({
  currentStep,
  totalSteps,
  label,
  stage,
  hasPendingWithdrawals,
  hasClaimable,
}: UnstakeStepIndicatorProps) {
  const steps: { name: string; state: "done" | "active" | "pending" }[] = [];

  const isConfirmed = stage === "confirmed";
  const isFailed = stage === "failed";

  if (totalSteps >= 2) {
    steps.push({
      name: "Approval",
      state: currentStep > 1 || isConfirmed ? "done" : currentStep === 1 ? "active" : "pending",
    });
  }

  const requestDone = isConfirmed || (hasPendingWithdrawals && currentStep >= totalSteps);
  const requestStepNum = totalSteps >= 2 ? 2 : 1;
  steps.push({
    name: "Request",
    state: requestDone ? "done" : currentStep === requestStepNum ? "active" : "pending",
  });

  steps.push({
    name: "Waiting",
    state: hasClaimable ? "done" : requestDone && !hasClaimable ? "active" : "pending",
  });

  steps.push({
    name: "Claimable",
    state: hasClaimable ? "active" : "pending",
  });

  return (
    <div className="w-full mb-4">
      <div className="flex items-center gap-1">
        {steps.map((step, index) => (
          <div key={step.name} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border ${
                  step.state === "done"
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                    : step.state === "active"
                      ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                      : "bg-white/5 border-white/10 text-zinc-600"
                }`}
              >
                {step.state === "done" ? "✓" : index + 1}
              </div>
              <span
                className={`text-[9px] mt-1 ${
                  step.state === "done"
                    ? "text-emerald-400"
                    : step.state === "active"
                      ? "text-white"
                      : "text-zinc-600"
                }`}
              >
                {step.name}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`h-px flex-1 mx-1 ${step.state === "done" ? "bg-emerald-500/30" : "bg-white/10"}`} />
            )}
          </div>
        ))}
      </div>
      {!isFailed && <p className="text-[10px] text-zinc-500 text-center mt-2">{label}</p>}
    </div>
  );
}

interface StakingStatusViewProps {
  txStage: StakingTxStage;
  mode: ActionMode;
  txStep: UnstakeStep | null;
  pendingWithdrawalsCount: number;
  claimableRequestIds: string[];
  txSummary: string | null;
  stakingError: string | null;
  txWarning: string | null;
  txHashes: string[];
  onClose: () => void;
  onRetry: () => void;
  onNewAction: () => void;
}

export function StakingStatusView({
  txStage,
  mode,
  txStep,
  pendingWithdrawalsCount,
  claimableRequestIds,
  txSummary,
  stakingError,
  txWarning,
  txHashes,
  onClose,
  onRetry,
  onNewAction,
}: StakingStatusViewProps) {
  return (
    <motion.div
      key="status"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col h-full items-center justify-center p-6"
    >
      <div
        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-6 ${
          txStage === "confirmed"
            ? "bg-green-500/20"
            : txStage === "timeout"
              ? "bg-amber-500/15"
              : txStage === "failed"
                ? "bg-red-500/15"
                : "bg-white/5"
        }`}
      >
        {txStage === "confirmed" ? (
          <Check className="w-8 h-8 sm:w-10 sm:h-10 text-green-500" />
        ) : txStage === "timeout" ? (
          <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400" />
        ) : txStage === "failed" ? (
          <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-400" />
        ) : (
          <RefreshCcw className="w-8 h-8 sm:w-10 sm:h-10 text-zinc-300 animate-spin" />
        )}
      </div>

      <h2 className="text-xl sm:text-2xl font-display font-bold text-white mb-2">{getStakingStatusTitle(txStage, mode)}</h2>

      {txStage === "awaiting_wallet" && (
        <p className="text-xs text-zinc-500 text-center mb-3">
          If you already approved in wallet and this does not update in ~1 minute, close and reopen to refresh status.
        </p>
      )}

      {txStage === "timeout" && (
        <p className="text-xs text-amber-300 text-center mb-3">Transaction was submitted, but confirmation is still pending on-chain.</p>
      )}

      {shouldShowQueueCompletionHint(txStage, mode) && (
        <p className="text-xs text-zinc-400 text-center mb-3">
          Your withdrawal request is now in the Lido queue. This typically takes 1-5 days. You can claim your ETH once it is finalized.
        </p>
      )}

      {mode === "unstake" && txStage === "confirmed" && (
        <p className="text-xs text-zinc-500 text-center mb-3">
          Wallet may show `value=0` for this request transaction. That is expected for queue requests.
        </p>
      )}

      {txStep && mode === "unstake" ? (
        <UnstakeStepIndicator
          currentStep={txStep.current}
          totalSteps={txStep.total}
          label={txStep.label}
          stage={txStage}
          hasPendingWithdrawals={pendingWithdrawalsCount > 0}
          hasClaimable={claimableRequestIds.length > 0}
        />
      ) : txStep ? (
        <p className="text-xs text-zinc-500 mb-2">
          Step {txStep.current}/{txStep.total} - {txStep.label}
        </p>
      ) : null}

      <p className="text-zinc-400 text-center text-sm sm:text-base mb-4">{txSummary || (mode === "stake" ? "Staking" : "Unstaking")}</p>

      {stakingError && (
        <div className="w-full p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 mb-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-200 text-xs">{stakingError}</p>
        </div>
      )}

      {txWarning && (
        <div className="w-full p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 mb-3">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-amber-200 text-xs">{txWarning}</p>
        </div>
      )}

      {!!txHashes.length && (
        <div className="w-full space-y-2 mb-6">
          {txHashes.slice(-3).map((hash) => (
            <a
              key={hash}
              href={`https://etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-primary text-sm hover:bg-white/10 transition-colors"
            >
              <span className="font-mono truncate">
                {hash.slice(0, 10)}...{hash.slice(-8)}
              </span>
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
            </a>
          ))}
        </div>
      )}

      <div className="w-full space-y-3">
        <NeonButton onClick={onClose}>{txStage === "confirmed" ? "Done" : "Close"}</NeonButton>

        {canRetryStakingTx(txStage) && (
          <button onClick={onRetry} className="w-full py-3 text-zinc-400 hover:text-white transition-colors">
            Try again
          </button>
        )}

        <button onClick={onNewAction} className="w-full py-3 text-zinc-400 hover:text-white transition-colors">
          New Action
        </button>
      </div>
    </motion.div>
  );
}
