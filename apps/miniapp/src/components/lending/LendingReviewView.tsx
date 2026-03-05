import { motion } from "framer-motion";
import { AlertCircle, Info, Loader2 } from "lucide-react";
import { NeonButton } from "@/components/ui/NeonButton";
import { cn } from "@/lib/utils";

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
  return (
    <motion.div
      key="review"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <div className="px-6 pb-6 flex-1 flex flex-col relative z-10 justify-center gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="font-medium text-white text-sm sm:text-base">
              {actionLabel} {symbol}
            </span>
            <button
              type="button"
              onClick={onOpenFlowInfo}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              How it works
            </button>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2">
              <span className="text-zinc-500">Amount</span>
              <span className="text-white font-mono font-medium text-base sm:text-lg">
                {amount || "0"} {symbol}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-zinc-500">{secondaryLabel}</span>
              <span className="text-white font-mono font-medium">
                {previewHuman || "--"} {symbol}
              </span>
            </div>
          </div>
        </div>

        {riskHint && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-100 text-xs flex items-start justify-between gap-3">
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

        {txError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div className="min-w-0">{txError}</div>
          </div>
        )}

        {isRateLimited && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              Rate limited. Retry in <span className="font-mono font-medium">{rateLimitRemaining}s</span>
            </span>
          </div>
        )}

        <div className="pt-2 relative">
          <NeonButton
            onClick={onConfirm}
            className={cn("w-full bg-white text-black hover:bg-zinc-200 shadow-none")}
            disabled={txStage === "awaiting_wallet" || txStage === "pending" || isRateLimited}
          >
            {isRateLimited
              ? `Wait ${rateLimitRemaining}s…`
              : txStage === "awaiting_wallet"
                ? "Confirming in wallet…"
                : txStage === "pending"
                  ? "Submitting…"
                  : `Confirm ${actionLabel.toLowerCase()}`}
          </NeonButton>
          {(txStage === "awaiting_wallet" || txStage === "pending") && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
