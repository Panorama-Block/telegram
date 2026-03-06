import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, Check, Receipt } from "lucide-react";
import { NeonButton } from "@/components/ui/NeonButton";

type ActionMode = "stake" | "unstake";

interface StakingReviewViewProps {
  mode: ActionMode;
  stakeAmount: string;
  unstakeAmount: string;
  stakeReceiveAmount: string;
  unstakeReceiveAmount: string;
  stakeSymbol: string;
  ethIcon: string;
  stEthIcon: string;
  stakingError: string | null;
  txWarning: string | null;
  isRateLimited: boolean;
  rateLimitRemaining: number;
  isStaking: boolean;
  onConfirm: () => void;
}

export function StakingReviewView({
  mode,
  stakeAmount,
  unstakeAmount,
  stakeReceiveAmount,
  unstakeReceiveAmount,
  stakeSymbol,
  ethIcon,
  stEthIcon,
  stakingError,
  txWarning,
  isRateLimited,
  rateLimitRemaining,
  isStaking,
  onConfirm,
}: StakingReviewViewProps) {
  return (
    <motion.div
      key="review"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <div className="px-6 pb-8 flex-1 flex flex-col relative z-10 custom-scrollbar">
        <div className="flex items-center justify-between mb-6 pt-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded border border-blue-500/20 flex items-center gap-1">
              <Check className="w-3 h-3" />
              {mode === "stake" ? "Stake" : "Unstake"}
            </span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 space-y-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-white text-sm sm:text-base">
              {mode === "stake" ? "Stake (Lido)" : "Request withdrawal (queue)"}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 sm:gap-4 py-3 bg-black/20 rounded-lg border border-white/5">
            <div className="flex items-center gap-2">
              <img src={mode === "stake" ? ethIcon : stEthIcon} alt="from" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full" />
              <div className="text-left">
                <div className="text-white font-mono text-sm sm:text-base font-bold">{mode === "stake" ? stakeAmount : unstakeAmount || "-"}</div>
                <div className="text-zinc-500 text-[10px] sm:text-xs">{mode === "stake" ? stakeSymbol : "stETH"}</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-600" />
            <div className="flex items-center gap-2">
              <img src={mode === "stake" ? stEthIcon : ethIcon} alt="to" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full" />
              <div className="text-left">
                <div className="text-white font-mono text-sm sm:text-base font-bold">
                  {mode === "stake" ? stakeReceiveAmount || "-" : unstakeReceiveAmount || "-"}
                </div>
                <div className="text-zinc-500 text-[10px] sm:text-xs">{mode === "stake" ? "stETH" : stakeSymbol}</div>
              </div>
            </div>
          </div>

          {mode === "unstake" && (
            <div className="text-[11px] text-zinc-500 space-y-1">
              <p>This transaction creates a withdrawal request in Lido queue.</p>
              <p>`value=0` in wallet confirmation is expected. ETH is received on claim after finalization.</p>
            </div>
          )}
        </div>

        {mode === "stake" && (
          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
              <Receipt className="w-4 h-4 text-blue-400 mt-0.5" />
              <div className="text-xs text-zinc-400 leading-relaxed">stETH balance tracks staking rewards automatically.</div>
            </div>
          </div>
        )}

        {stakingError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-red-200 text-xs">{stakingError}</p>
          </div>
        )}

        {txWarning && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-amber-200 text-xs">{txWarning}</p>
          </div>
        )}

        {isRateLimited && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-amber-200 text-xs">
              Rate limited. Retry in <span className="font-mono font-medium">{rateLimitRemaining}s</span>
            </p>
          </div>
        )}

        <div className="mt-auto">
          <NeonButton
            onClick={onConfirm}
            disabled={isStaking || isRateLimited}
            className="w-full bg-white text-black hover:bg-zinc-200 shadow-none disabled:opacity-50"
          >
            {isRateLimited
              ? `Wait ${rateLimitRemaining}s...`
              : isStaking
                ? "Confirming in Wallet..."
                : mode === "stake"
                  ? "Confirm stake"
                  : "Confirm request (queue)"}
          </NeonButton>
          {isStaking && <p className="text-xs text-zinc-500 text-center mt-2">Please confirm the transaction in your wallet</p>}
        </div>
      </div>
    </motion.div>
  );
}
