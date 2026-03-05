import { motion } from "framer-motion";
import { AlertCircle, Check, ExternalLink, Info, Landmark } from "lucide-react";
import { NeonButton } from "@/components/ui/NeonButton";
import { cn } from "@/lib/utils";
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
  return (
    <motion.div
      key="status"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col h-full items-center justify-center p-6 text-center gap-4"
    >
      <div
        className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center",
          txStage === "confirmed"
            ? "bg-green-500/20"
            : txStage === "failed"
              ? "bg-red-500/20"
              : txStage === "timeout"
                ? "bg-amber-500/20"
                : "bg-primary/15",
        )}
      >
        {txStage === "confirmed" ? (
          <Check className="w-8 h-8 text-green-500" />
        ) : txStage === "failed" ? (
          <AlertCircle className="w-8 h-8 text-red-400" />
        ) : txStage === "timeout" ? (
          <AlertCircle className="w-8 h-8 text-amber-400" />
        ) : (
          <Landmark className="w-8 h-8 text-primary" />
        )}
      </div>

      <div className="space-y-1">
        <div className="text-xl font-bold text-white">
          {txStage === "awaiting_wallet"
            ? "Confirm in wallet"
            : txStage === "pending"
              ? "Pending confirmation"
              : txStage === "confirmed"
                ? "Confirmed"
                : txStage === "timeout"
                  ? "Submitted"
                  : txStage === "failed"
                    ? "Transaction issue"
                    : "Transaction"}
        </div>
        <div className="text-zinc-400 text-sm">
          {txStage === "awaiting_wallet"
            ? "Approve the transaction in your wallet."
            : txStage === "pending"
              ? "Waiting for on-chain confirmation…"
              : txStage === "confirmed"
                ? "Position will refresh automatically."
                : txStage === "timeout"
                  ? "Transaction was submitted, but confirmation is still pending."
                  : txStage === "failed"
                    ? (txError ?? "Something went wrong.")
                    : "Preparing transaction…"}
        </div>
        {(txStage === "awaiting_wallet" || txStage === "pending" || txStage === "timeout") && (
          <button
            type="button"
            onClick={onOpenPendingInfo}
            className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            Why is this taking time?
          </button>
        )}
      </div>

      {txWarning && (
        <div className="w-full p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">{txWarning}</div>
        </div>
      )}

      {latestTxHash && (
        <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-left space-y-2">
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

      {txSteps.length > 0 && (
        <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-left space-y-2">
          <div className="flex items-center justify-between gap-2">
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
            <div key={step.id} className="rounded-lg border border-white/10 bg-black/20 p-2.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-white">
                  {index + 1}. {step.label}
                </div>
                <div className={cn("text-[11px] font-medium", getLendingStepStatusClass(step.stage))}>
                  {getLendingStepStatusLabel(step.stage)}
                </div>
              </div>
              {step.txHash && (
                <a
                  href={getExplorerTxUrl(43114, step.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 text-[11px] text-cyan-300 hover:text-cyan-200 transition-colors"
                >
                  <span className="font-mono truncate">{step.txHash}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="w-full space-y-3">
        <NeonButton onClick={onClose}>{txStage === "confirmed" ? "Done" : "Close"}</NeonButton>

        {canRetryLendingTx(txStage) && (
          <button onClick={onRetry} className="w-full py-3 text-zinc-400 hover:text-white transition-colors">
            Try again
          </button>
        )}
      </div>
    </motion.div>
  );
}
