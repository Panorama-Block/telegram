import { motion } from "framer-motion";
import { AlertCircle, Check, ExternalLink, Info, Loader2 } from "lucide-react";
import { NeonButton } from "@/components/ui/NeonButton";
import { canRetryLendingTx, getLendingStepStatusClass, getLendingStepStatusLabel, type LendingTxStage, type LendingTxStepStage } from "@/components/lending/lendingTxState";

interface TxStep {
  id: string;
  label: string;
  stage: LendingTxStepStage;
  txHash: string | null;
}

interface LendingStatusViewProps {
  txStage: LendingTxStage;
  txError: string | null;
  txWarning: string | null;
  latestTxHash: string | null;
  txHashes: string[];
  txSteps: TxStep[];
  getExplorerTxUrl: (chainId: number, txHash: string) => string;
  onOpenPendingInfo: () => void;
  onOpenStepsInfo: () => void;
  onClose: () => void;
  onRetry: () => void;
}

export function LendingStatusView({
  txStage,
  txError,
  txWarning,
  latestTxHash,
  txHashes,
  txSteps,
  getExplorerTxUrl,
  onOpenPendingInfo,
  onOpenStepsInfo,
  onClose,
  onRetry,
}: LendingStatusViewProps) {
  const isSuccess = txStage === "confirmed";
  const isFailed = txStage === "failed";
  const isTimeout = txStage === "timeout";
  const isExecuting = txStage === "awaiting_wallet" || txStage === "pending";

  const completedSteps = txSteps.filter((step) => step.stage === "confirmed").length;
  const totalSteps = txSteps.length;

  const heading = isSuccess
    ? "Transaction Confirmed"
    : isFailed
      ? "Transaction Failed"
      : isTimeout
        ? "Transaction Submitted"
        : txStage === "awaiting_wallet"
          ? "Confirm in wallet"
          : txStage === "pending"
            ? "Pending confirmation"
            : "Processing transaction";

  const subheading = isSuccess
    ? "Position will refresh automatically."
    : isFailed
      ? (txError ?? "Something went wrong.")
      : isTimeout
        ? "Transaction was submitted, but confirmation is still pending."
        : txStage === "awaiting_wallet"
          ? "Approve the transaction in your wallet."
          : txStage === "pending"
            ? "Waiting for on-chain confirmation…"
            : "Preparing transaction…";

  return (
    <motion.div
      key="status"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col h-full"
    >
      <div className="px-4 sm:px-6 pb-6 flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        {/* Status icon + heading */}
        <div className="pt-2 flex flex-col items-center text-center gap-2">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center border ${
            isSuccess
              ? "bg-cyan-500/20 border-cyan-500/30"
              : isFailed
                ? "bg-red-500/20 border-red-500/30"
                : isTimeout
                  ? "bg-amber-500/20 border-amber-500/30"
                  : "bg-cyan-500/10 border-cyan-500/20"
          }`}>
            {isSuccess ? (
              <Check className="w-8 h-8 text-cyan-300" />
            ) : isFailed ? (
              <AlertCircle className="w-8 h-8 text-red-400" />
            ) : isTimeout ? (
              <AlertCircle className="w-8 h-8 text-amber-300" />
            ) : (
              <Loader2 className="w-7 h-7 text-cyan-300 animate-spin" />
            )}
          </div>

          <p className="text-lg font-medium text-white">{heading}</p>
          <p className="text-sm text-zinc-500">{subheading}</p>

          {totalSteps > 0 && (
            <p className="text-xs text-zinc-400">
              {completedSteps}/{totalSteps} steps completed
            </p>
          )}

          {(isExecuting || isTimeout) && (
            <button
              type="button"
              onClick={onOpenPendingInfo}
              className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              Why is this taking time?
            </button>
          )}
        </div>

        {/* Warning alert */}
        {txWarning && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">{txWarning}</div>
          </div>
        )}

        {/* Transaction hash card */}
        {latestTxHash && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
            <div className="text-xs text-zinc-500 uppercase">Transaction</div>
            <a
              href={getExplorerTxUrl(43114, latestTxHash)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
            >
              <span className="font-mono truncate">{latestTxHash}</span>
              <ExternalLink className="w-4 h-4 shrink-0" />
            </a>
            {txHashes.length > 1 && (
              <div className="text-[11px] text-zinc-500">Includes {txHashes.length} on-chain steps (validation + action).</div>
            )}
          </div>
        )}

        {/* Steps breakdown */}
        {txSteps.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="text-xs text-zinc-500 uppercase">Steps</div>
              <button
                type="button"
                onClick={onOpenStepsInfo}
                className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
                Explain
              </button>
            </div>
            {txSteps.map((step, index) => (
              <div key={step.id} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-300">
                    {index + 1}/{totalSteps} {step.label}
                  </span>
                  <span className={`text-[11px] font-medium ${getLendingStepStatusClass(step.stage)}`}>
                    {getLendingStepStatusLabel(step.stage)}
                  </span>
                </div>
                {step.txHash && (
                  <a
                    href={getExplorerTxUrl(43114, step.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-[11px] text-cyan-300 hover:text-cyan-200 transition-colors"
                  >
                    <span className="font-mono truncate flex-1">{step.txHash}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        {isSuccess ? (
          <NeonButton onClick={onClose}>Done</NeonButton>
        ) : isExecuting ? (
          <NeonButton onClick={onClose} className="bg-white/10 hover:bg-white/15 shadow-none text-white">
            Close
          </NeonButton>
        ) : (
          <div className="space-y-2">
            {canRetryLendingTx(txStage) && (
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
