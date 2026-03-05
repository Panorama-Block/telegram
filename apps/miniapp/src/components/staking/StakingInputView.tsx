import { motion } from "framer-motion";
import { AlertCircle, ArrowDown, Info, RefreshCcw } from "lucide-react";
import { DataInput } from "@/components/ui/DataInput";
import { NeonButton } from "@/components/ui/NeonButton";

type ActionMode = "stake" | "unstake";
type UnstakePath = "queue" | "instant";
type InfoKind = "apy" | "queue" | "instant";
type ApyUiState = "syncing" | "fresh" | "stale" | "unavailable";

interface StakingInputViewProps {
  mode: ActionMode;
  setMode: (value: ActionMode) => void;
  unstakePath: UnstakePath;
  setUnstakePath: (value: UnstakePath) => void;
  stakeAmount: string;
  setStakeAmount: (value: string) => void;
  unstakeAmount: string;
  setUnstakeAmount: (value: string) => void;
  loadingEthBalance: boolean;
  ethBalanceHuman: string | null;
  maxStakeAmountHuman: string | null;
  stEthBalanceHuman: string | null;
  stakeReceiveAmount: string;
  unstakeReceiveAmount: string;
  protocolAPY: number | null;
  formatAPY: (value: number | null | undefined) => string;
  apyUiState: ApyUiState;
  apyUpdatedAt?: string | null;
  apySource?: string | null;
  claimableRequestIds: string[];
  pendingWithdrawalsCount: number;
  isRateLimited: boolean;
  rateLimitRemaining: number;
  coreError: string | null;
  extrasError: string | null;
  loadingCore: boolean;
  loadingExtras: boolean;
  onRefreshAll: () => void;
  formatWei: (wei: string | null | undefined, decimals?: number) => string;
  stEthBalanceWei: string | null | undefined;
  wstEthBalanceWei: string | null | undefined;
  onClaimAll: () => void;
  isStaking: boolean;
  onContinue: () => void;
  onOpenInfo: (kind: InfoKind) => void;
  onOpenInstantSwap?: () => void;
  ethIcon: string;
  stEthIcon: string;
  stakeSymbol: string;
}

export function StakingInputView({
  mode,
  setMode,
  unstakePath,
  setUnstakePath,
  stakeAmount,
  setStakeAmount,
  unstakeAmount,
  setUnstakeAmount,
  loadingEthBalance,
  ethBalanceHuman,
  maxStakeAmountHuman,
  stEthBalanceHuman,
  stakeReceiveAmount,
  unstakeReceiveAmount,
  protocolAPY,
  formatAPY,
  apyUiState,
  claimableRequestIds,
  pendingWithdrawalsCount,
  isRateLimited,
  rateLimitRemaining,
  coreError,
  extrasError,
  loadingCore,
  loadingExtras,
  onRefreshAll,
  formatWei,
  stEthBalanceWei,
  wstEthBalanceWei,
  onClaimAll,
  isStaking,
  onContinue,
  onOpenInfo,
  ethIcon,
  stEthIcon,
  stakeSymbol,
}: StakingInputViewProps) {
  const isUnstake = mode === "unstake";
  const apyLabel =
    apyUiState === "syncing"
      ? "—"
      : apyUiState === "unavailable"
        ? "—"
        : apyUiState === "stale"
          ? formatAPY(protocolAPY)
          : formatAPY(protocolAPY);
  const continueLabel = isUnstake
    ? unstakePath === "queue"
      ? "Request withdrawal"
      : "Swap stETH to ETH"
    : "Stake ETH";

  return (
    <motion.div
      key="input"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <div className="px-6 pb-8 space-y-4 relative z-10 flex-1 flex flex-col">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("stake")}
            className={`py-2 rounded-xl border transition-colors text-xs font-medium ${
              mode === "stake"
                ? "bg-primary/15 border-primary/30 text-white"
                : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
            }`}
          >
            Stake
          </button>
          <button
            type="button"
            onClick={() => setMode("unstake")}
            className={`py-2 rounded-xl border transition-colors text-xs font-medium ${
              mode === "unstake"
                ? "bg-primary/15 border-primary/30 text-white"
                : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
            }`}
          >
            Unstake
          </button>
        </div>

        {isUnstake && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUnstakePath("queue")}
                className={`py-2 rounded-xl border transition-colors text-xs font-medium ${
                  unstakePath === "queue"
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  Queue
                  <Info
                    className="w-3.5 h-3.5 text-zinc-400"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenInfo("queue");
                    }}
                  />
                </span>
              </button>
              <button
                type="button"
                onClick={() => setUnstakePath("instant")}
                className={`py-2 rounded-xl border transition-colors text-xs font-medium ${
                  unstakePath === "instant"
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  Instant
                  <Info
                    className="w-3.5 h-3.5 text-zinc-400"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenInfo("instant");
                    }}
                  />
                </span>
              </button>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-400 leading-relaxed">
              {unstakePath === "queue" ? (
                <>
                  Queue: better execution reference (~1:1), but ETH is received later on claim after finalization.
                </>
              ) : (
                <>
                  Instant: faster ETH via market swap now, but final amount changes with price impact and slippage.
                </>
              )}
            </div>
          </div>
        )}

        {mode === "stake" && (
          <div className="rounded-xl border border-white/10 bg-blue-500/5 px-3 py-2 text-[11px] text-zinc-400 leading-relaxed">
            Stake uses direct Lido deposit. You receive stETH at reference 1:1 now; rewards accrue over time in stETH balance.
          </div>
        )}

        {mode === "stake" ? (
          <>
            <DataInput
              label="You stake"
              value={stakeAmount}
              balance={loadingEthBalance ? "Available: ..." : `Available: ${ethBalanceHuman ?? "--"} ETH`}
              onMaxClick={maxStakeAmountHuman ? () => setStakeAmount(maxStakeAmountHuman) : undefined}
              onChange={(event) => {
                const next = event.target.value;
                if (!/^(\d+(\.\d*)?|\.\d*)$/.test(next) && next !== "") return;
                setStakeAmount(next);
              }}
              rightElement={
                <div className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-2 min-h-[40px]">
                  <img src={ethIcon} alt="ETH" className="w-5 h-5 rounded-full" />
                  <span className="text-white font-medium text-sm">{stakeSymbol}</span>
                </div>
              }
            />

            <div className="flex justify-center -my-3 relative z-20">
              <div className="bg-[#0A0A0A] border border-white/10 p-1.5 rounded-xl text-zinc-400">
                <ArrowDown className="w-4 h-4" />
              </div>
            </div>

            <DataInput
              label="You receive"
              value={stakeReceiveAmount}
              placeholder=""
              readOnly
              className="text-zinc-400"
              rightElement={
                <div className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-2 min-h-[40px]">
                  <img src={stEthIcon} alt="stETH" className="w-5 h-5 rounded-full" />
                  <span className="text-white font-medium text-sm">stETH</span>
                </div>
              }
            />
          </>
        ) : (
          <>
            <DataInput
              label="You unstake"
              value={unstakeAmount}
              balance={`Available: ${stEthBalanceHuman ?? "--"} stETH`}
              onMaxClick={stEthBalanceHuman ? () => setUnstakeAmount(stEthBalanceHuman) : undefined}
              onChange={(event) => {
                const next = event.target.value;
                if (!/^(\d+(\.\d*)?|\.\d*)$/.test(next) && next !== "") return;
                setUnstakeAmount(next);
              }}
              placeholder="0.00"
              rightElement={
                <div className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-2 min-h-[40px]">
                  <img src={stEthIcon} alt="stETH" className="w-5 h-5 rounded-full" />
                  <span className="text-white font-medium text-sm">stETH</span>
                </div>
              }
            />

            <DataInput
              label={unstakePath === "queue" ? "Estimated claimable ETH" : "Estimated swap output"}
              value={unstakeReceiveAmount}
              placeholder=""
              readOnly
              className="text-zinc-400"
              rightElement={
                <div className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-2 min-h-[40px]">
                  <img src={ethIcon} alt="ETH" className="w-5 h-5 rounded-full" />
                  <span className="text-white font-medium text-sm">ETH</span>
                </div>
              }
            />
          </>
        )}

        <div className="flex items-center justify-between px-2 text-xs">
          <button
            type="button"
            onClick={() => onOpenInfo("apy")}
            className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Estimated APY {apyLabel}
            <Info className="w-3.5 h-3.5" />
          </button>
          {apyUiState === "syncing" && <span className="text-zinc-500">Syncing...</span>}
          {apyUiState === "stale" && <span className="text-zinc-500">Updating...</span>}
          <button
            onClick={onRefreshAll}
            className="inline-flex items-center gap-2 text-primary/90 hover:text-primary transition-colors"
            disabled={loadingCore || loadingExtras}
            type="button"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loadingCore || loadingExtras ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 px-2">
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">stETH</div>
            <div className="mt-1 text-white font-mono text-sm">{formatWei(stEthBalanceWei)}</div>
          </div>
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">wstETH</div>
            <div className="mt-1 text-white font-mono text-sm">{formatWei(wstEthBalanceWei)}</div>
          </div>
        </div>

        {claimableRequestIds.length > 0 && (
          <div className="px-2">
            <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-center justify-between gap-3">
              <div className="text-xs text-zinc-300">
                <span className="text-white font-medium">Claim ready:</span> {claimableRequestIds.length} request(s)
              </div>
              <button
                type="button"
                onClick={onClaimAll}
                disabled={isStaking}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                Claim
              </button>
            </div>
          </div>
        )}

        {claimableRequestIds.length === 0 && pendingWithdrawalsCount > 0 && (
          <div className="px-2">
            <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-[11px] text-zinc-500">
              Pending withdrawals: <span className="text-white/90 font-mono">{pendingWithdrawalsCount}</span>
            </div>
          </div>
        )}

        {isRateLimited && (
          <div className="px-2">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <p className="text-amber-200 text-xs">
                Rate limited. Retry in <span className="font-mono font-medium">{rateLimitRemaining}s</span>
              </p>
            </div>
          </div>
        )}

        {(coreError || extrasError) && (
          <div className="px-2">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-200 text-xs">{coreError || extrasError}</p>
            </div>
          </div>
        )}

        <div className="mt-auto pt-2">
          <NeonButton onClick={onContinue}>{continueLabel}</NeonButton>
        </div>
      </div>
    </motion.div>
  );
}
