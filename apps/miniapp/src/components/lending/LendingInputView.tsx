import { motion } from "framer-motion";
import { AlertCircle, ChevronDown, Clock, Loader2, RefreshCcw } from "lucide-react";
import { DataInput } from "@/components/ui/DataInput";
import { NeonButton } from "@/components/ui/NeonButton";
import { cn } from "@/lib/utils";

interface LendingHistoryItem {
  txId?: string;
  action?: string;
  status?: string;
  createdAt?: string;
  txHash?: string;
  chainId?: number;
}

type LendingActionKey = "supply" | "withdraw" | "borrow" | "repay";

type HealthTone = "green" | "yellow" | "red" | "zinc";

interface LendingInputViewProps {
  activeAction: LendingActionKey;
  onSelectAction: (action: LendingActionKey) => void;
  inputLabel: string;
  amount: string;
  balanceLabel: string;
  maxHuman: string | null;
  onSetAmount: (value: string) => void;
  onOpenTokenList: () => void;
  secondaryLabel: string;
  previewHuman: string;
  actionLabel: string;
  mode: "supply" | "borrow";
  formatAPY: (apy: number | null | undefined) => string;
  supplyApy?: number | null;
  borrowApy?: number | null;
  isRateLimited: boolean;
  rateLimitRemaining: number;
  dataError: string | null;
  positionWarning: string | null;
  hasAccount: boolean;
  onRefreshPosition: () => void;
  suppliedAmount: string;
  borrowedAmount: string;
  qTokenAmount: string;
  qTokenSymbol: string;
  healthTone: HealthTone;
  healthText: string;
  showHistory: boolean;
  onToggleHistory: () => void;
  historyLoading: boolean;
  txHistory: LendingHistoryItem[];
  getExplorerTxUrl: (chainId: number, txHash: string) => string;
  canReview: boolean;
  loadingData: boolean;
  hasActiveMarket: boolean;
  onContinue: () => void;
  tokenSymbol: string;
  tokenIcon?: string;
}

const ACTIONS: Array<{ key: LendingActionKey; label: string }> = [
  { key: "supply", label: "Supply" },
  { key: "withdraw", label: "Withdraw" },
  { key: "borrow", label: "Borrow" },
  { key: "repay", label: "Repay" },
];

export function LendingInputView({
  activeAction,
  onSelectAction,
  inputLabel,
  amount,
  balanceLabel,
  maxHuman,
  onSetAmount,
  onOpenTokenList,
  secondaryLabel,
  previewHuman,
  actionLabel,
  mode,
  formatAPY,
  supplyApy,
  borrowApy,
  isRateLimited,
  rateLimitRemaining,
  dataError,
  positionWarning,
  hasAccount,
  onRefreshPosition,
  suppliedAmount,
  borrowedAmount,
  qTokenAmount,
  qTokenSymbol,
  healthTone,
  healthText,
  showHistory,
  onToggleHistory,
  historyLoading,
  txHistory,
  getExplorerTxUrl,
  canReview,
  loadingData,
  hasActiveMarket,
  onContinue,
  tokenSymbol,
  tokenIcon,
}: LendingInputViewProps) {
  return (
    <motion.div
      key="input"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <div className="px-4 sm:px-6 pb-6 space-y-3 relative z-10 flex-1 flex flex-col">
        {/* Action tabs — pill group matching Yield pattern */}
        <div className="grid grid-cols-4 gap-1.5 bg-white/5 rounded-xl p-1">
          {ACTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectAction(item.key)}
              className={`py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                activeAction === item.key
                  ? "bg-cyan-500/15 text-white border border-cyan-500/30"
                  : "text-zinc-400 hover:text-white border border-transparent"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Account health + position */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Account health</div>
              <div
                className={cn(
                  "text-sm font-medium mt-1",
                  healthTone === "green" && "text-emerald-400",
                  healthTone === "yellow" && "text-yellow-400",
                  healthTone === "red" && "text-red-400",
                  healthTone === "zinc" && "text-zinc-400",
                )}
              >
                {healthText}
              </div>
            </div>
            <button
              type="button"
              onClick={onRefreshPosition}
              className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Supplied</div>
              <div className="text-sm font-mono text-white mt-1">{suppliedAmount}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Borrowed</div>
              <div className="text-sm font-mono text-white mt-1">{borrowedAmount}</div>
            </div>
          </div>
        </div>

        {/* Amount input */}
        <DataInput
          label={inputLabel}
          value={amount}
          balance={balanceLabel}
          onMaxClick={maxHuman ? () => onSetAmount(maxHuman) : undefined}
          onChange={(event) => {
            const next = event.target.value;
            if (!/^(\d+(\.\d*)?|\.\d*)$/.test(next) && next !== "") return;
            onSetAmount(next);
          }}
          placeholder="0.00"
          rightElement={
            <button
              type="button"
              onClick={onOpenTokenList}
              className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2.5 sm:px-3 py-1.5 sm:py-2 min-h-[40px] sm:min-h-[44px] hover:bg-zinc-900 active:bg-zinc-800 transition-colors group"
            >
              {tokenIcon ? (
                <img src={tokenIcon} alt={tokenSymbol} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-zinc-700" />
              )}
              <span className="text-white font-medium text-sm sm:text-base">{tokenSymbol}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
            </button>
          }
        />

        {/* Preview */}
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{secondaryLabel}</div>
          <div className="text-white font-mono text-lg">
            {previewHuman || "0"} {tokenSymbol}
          </div>
        </div>

        {/* APY + info hints */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Estimated APY</span>
            <span className="text-cyan-400 font-semibold">
              {mode === "supply" ? formatAPY(supplyApy) : formatAPY(borrowApy)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">qToken balance</span>
            <span className="text-zinc-300 font-mono">
              {qTokenAmount} {qTokenSymbol}
            </span>
          </div>
        </div>

        {/* Alerts */}
        {isRateLimited && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-200 text-[11px] flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              Rate limited. Retry in <span className="font-mono font-medium">{rateLimitRemaining}s</span>
            </span>
          </div>
        )}
        {dataError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {dataError}
          </div>
        )}
        {!dataError && positionWarning && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            {positionWarning}
          </div>
        )}
        {!hasAccount && (
          <div className="rounded-xl border border-white/10 bg-cyan-500/5 px-3 py-2 text-[11px] text-zinc-400 leading-relaxed">
            Connect your wallet in the app to use Lending.
          </div>
        )}

        {/* Recent activity */}
        {hasAccount && (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={onToggleHistory}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-white hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-400" />
                <span className="text-xs">Recent Activity</span>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-zinc-400 transition-transform", showHistory && "rotate-180")} />
            </button>
            {showHistory && (
              <div className="px-3 pb-3 space-y-2">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                  </div>
                ) : txHistory.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 text-center py-3">No transactions yet</div>
                ) : (
                  txHistory.map((tx, index) => {
                    const action = (tx.action || "unknown").toLowerCase();
                    const actionColor =
                      action === "supply"
                        ? "text-emerald-400"
                        : action === "borrow"
                          ? "text-amber-400"
                          : action === "repay"
                            ? "text-blue-400"
                            : action === "redeem" || action === "withdraw"
                              ? "text-purple-400"
                              : "text-zinc-400";
                    const statusDot =
                      tx.status === "confirmed"
                        ? "bg-emerald-500"
                        : tx.status === "pending"
                          ? "bg-amber-500"
                          : "bg-red-500";
                    const date = tx.createdAt
                      ? new Date(tx.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                      : "";

                    return (
                      <div key={tx.txId || index} className="flex items-center justify-between py-1.5 border-t border-white/5 first:border-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-1.5 h-1.5 rounded-full", statusDot)} />
                          <span className={cn("text-xs font-medium capitalize", actionColor)}>{action}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                          {tx.txHash && (
                            <a
                              href={getExplorerTxUrl(tx.chainId || 43114, tx.txHash)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 font-mono"
                            >
                              {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}
                            </a>
                          )}
                          {date && <span>{date}</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* Spacer to push CTA to bottom */}
        <div className="flex-1" />

        {/* CTA */}
        <NeonButton
          onClick={onContinue}
          disabled={!canReview || loadingData || !hasActiveMarket || !hasAccount}
          className={!canReview || loadingData || !hasActiveMarket || !hasAccount ? 'opacity-60 cursor-not-allowed' : ''}
        >
          {actionLabel}
        </NeonButton>
      </div>
    </motion.div>
  );
}
