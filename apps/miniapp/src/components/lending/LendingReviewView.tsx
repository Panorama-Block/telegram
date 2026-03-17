import { motion } from "framer-motion";
import { AlertCircle, Check, Info, Loader2 } from "lucide-react";
import { NeonButton } from "@/components/ui/NeonButton";

interface LendingReviewViewProps {
  actionLabel: string;
  amount: string;
  secondaryLabel: string;
  previewHuman: string;
  symbol: string;
  txError: string | null;
  isRateLimited: boolean;
  rateLimitRemaining: number;
  txStage: "idle" | "awaiting_wallet" | "pending" | "confirmed" | "failed" | "timeout";
  riskHint: string | null;
  onOpenFlowInfo: () => void;
  onOpenRiskInfo: () => void;
  onConfirm: () => void;
}

export function LendingReviewView({
  actionLabel,
  amount,
  secondaryLabel,
  previewHuman,
  symbol,
  txError,
  isRateLimited,
  rateLimitRemaining,
  txStage,
  riskHint,
  onOpenFlowInfo,
  onOpenRiskInfo,
  onConfirm,
}: LendingReviewViewProps) {
  const isBusy = txStage === "awaiting_wallet" || txStage === "pending";

  return (
    <motion.div
      key="review"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <div className="px-4 sm:px-6 pb-6 space-y-3 relative z-10 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
        {/* Action badge */}
        <div className="flex items-center justify-between pt-1">
          <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-[10px] font-bold rounded border border-cyan-500/20 flex items-center gap-1">
            <Check className="w-3 h-3" />
            {actionLabel}
          </span>
          <button
            type="button"
            onClick={onOpenFlowInfo}
            className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            How it works
          </button>
        </div>

        {/* Summary card */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
          <div className="text-zinc-400 text-sm mb-1">You will {actionLabel.toLowerCase()}</div>
          <div className="text-3xl font-bold text-white font-display mb-2">
            {amount || "0"} {symbol}
          </div>
        </div>

        {/* Details card */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Amount</span>
            <span className="text-white font-mono font-medium">
              {amount || "0"} {symbol}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">{secondaryLabel}</span>
            <span className="text-white font-mono font-medium">
              {previewHuman || "--"} {symbol}
            </span>
          </div>
        </div>

        {/* Risk hint */}
        {riskHint && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-100 text-xs flex items-start justify-between gap-3">
            <div className="min-w-0 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{riskHint}</span>
            </div>
            <button
              type="button"
              onClick={onOpenRiskInfo}
              className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-amber-200 hover:text-amber-100 hover:bg-amber-500/10 transition-colors"
            >
              Details
            </button>
          </div>
        )}

        {/* Errors */}
        {txError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div className="min-w-0">{txError}</div>
          </div>
        )}

        {isRateLimited && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              Rate limited. Retry in <span className="font-mono font-medium">{rateLimitRemaining}s</span>
            </span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* CTA */}
        <NeonButton
          onClick={onConfirm}
          disabled={isBusy || isRateLimited}
        >
          {isBusy ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {txStage === "awaiting_wallet" ? "Confirming in wallet…" : "Submitting…"}
            </span>
          ) : isRateLimited
            ? `Wait ${rateLimitRemaining}s…`
            : `Confirm ${actionLabel.toLowerCase()}`}
        </NeonButton>
      </div>
    </motion.div>
  );
}
