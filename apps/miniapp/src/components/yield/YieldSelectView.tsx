import { motion } from 'framer-motion';
import { Loader2, TrendingUp, Gift } from 'lucide-react';
import { TOKEN_ICONS, AERO_ICON } from '@/features/yield/config';
import type { YieldPoolWithAPR, UserPosition } from '@/features/yield/types';

function formatAPR(apr: string | null): string {
  if (!apr) return '--';
  const raw = apr.trim();
  const num = parseFloat(raw.replace('%', ''));
  if (isNaN(num)) return '--';
  const pct = raw.includes('%') ? num : num <= 1 ? num * 100 : num;
  return `${pct.toFixed(1)}%`;
}

function formatStakedLP(wei: string): string {
  try {
    const num = parseFloat(wei) / 1e18;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    if (num >= 1) return num.toFixed(2);
    return num.toFixed(6);
  } catch {
    return '0';
  }
}

function formatUsd(value: string | null | undefined): string {
  if (!value) return '--';
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num < 0) return '--';
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num > 0) return '< $1';
  return '$0';
}

function formatRewards(wei: string, decimals = 18): string {
  try {
    const num = parseFloat(wei) / 10 ** decimals;
    if (num < 0.0001) return '< 0.0001';
    return num.toFixed(4);
  } catch {
    return '0';
  }
}

function getTokenIcon(symbol: string): string | undefined {
  return TOKEN_ICONS[symbol];
}

interface YieldSelectViewProps {
  pools: YieldPoolWithAPR[];
  userPositions: UserPosition[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSelectPool: (poolId: string) => void;
  onQuickClaim: (poolId: string) => void;
  onQuickExit: (poolId: string) => void;
}

export function YieldSelectView({
  pools,
  userPositions,
  loading,
  error,
  onRetry,
  onSelectPool,
  onQuickClaim,
  onQuickExit,
}: YieldSelectViewProps) {
  const hasPositions = userPositions.length > 0;

  return (
    <motion.div
      key="select"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <div className="px-4 sm:px-6 pb-6 space-y-4 relative z-10 flex-1 overflow-y-auto custom-scrollbar">
        {/* Your Positions */}
        {hasPositions && (
          <div>
            <span className="text-xs text-zinc-500 font-medium mb-2 block px-1">Your Positions</span>
            <div className="space-y-2">
              {userPositions.map((pos) => {
                const hasRewards = parseFloat(pos.earnedRewards) > 0;
                return (
                  <div
                    key={pos.poolId}
                    className="bg-white/5 border border-cyan-500/20 rounded-xl p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5">
                          {getTokenIcon(pos.tokenA.symbol) && (
                            <img src={getTokenIcon(pos.tokenA.symbol)} alt="" className="w-5 h-5 rounded-full ring-1 ring-black" />
                          )}
                          {getTokenIcon(pos.tokenB.symbol) && (
                            <img src={getTokenIcon(pos.tokenB.symbol)} alt="" className="w-5 h-5 rounded-full ring-1 ring-black" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-white">
                          {pos.tokenA.symbol} / {pos.tokenB.symbol}
                        </span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                        pos.stable
                          ? 'text-blue-300 bg-blue-500/10 border-blue-500/20'
                          : 'text-orange-300 bg-orange-500/10 border-orange-500/20'
                      }`}>
                        {pos.stable ? 'Stable' : 'Volatile'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Staked LP</span>
                      <span className="text-white font-mono">{formatStakedLP(pos.stakedBalance)}</span>
                    </div>

                    {hasRewards && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 flex items-center gap-1">
                          <Gift className="w-3 h-3" /> Rewards
                        </span>
                        <span className="text-cyan-400 font-mono flex items-center gap-1">
                          {formatRewards(pos.earnedRewards, pos.rewardToken.decimals)} {pos.rewardToken.symbol}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      {hasRewards && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onQuickClaim(pos.poolId); }}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                        >
                          Claim
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onQuickExit(pos.poolId); }}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        Exit
                      </button>
                      <button
                        onClick={() => onSelectPool(pos.poolId)}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pools */}
        <div>
          <span className="text-xs text-zinc-500 font-medium mb-2 block px-1">
            {hasPositions ? 'All Pools' : 'Available Pools'}
          </span>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : error ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm text-red-400">{error}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-3 py-1.5 text-xs rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          ) : pools.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">
              No pools available
            </div>
          ) : (
            <div className="space-y-2">
              {pools.map((pool) => {
                const userPos = userPositions.find((p) => p.poolId === pool.id);
                const hasPosition = !!userPos;

                return (
                  <button
                    key={pool.id}
                    type="button"
                    onClick={() => onSelectPool(pool.id)}
                    className="w-full rounded-xl border bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 transition-all p-3 sm:p-4 text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex -space-x-2">
                          {getTokenIcon(pool.tokenA.symbol) ? (
                            <img src={getTokenIcon(pool.tokenA.symbol)} alt="" className="w-7 h-7 rounded-full ring-2 ring-[#0b0d0f]" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-zinc-700 ring-2 ring-[#0b0d0f] flex items-center justify-center text-[9px] text-white font-bold">
                              {pool.tokenA.symbol.slice(0, 2)}
                            </div>
                          )}
                          {getTokenIcon(pool.tokenB.symbol) ? (
                            <img src={getTokenIcon(pool.tokenB.symbol)} alt="" className="w-7 h-7 rounded-full ring-2 ring-[#0b0d0f]" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-zinc-700 ring-2 ring-[#0b0d0f] flex items-center justify-center text-[9px] text-white font-bold">
                              {pool.tokenB.symbol.slice(0, 2)}
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-white block">
                            {pool.tokenA.symbol} / {pool.tokenB.symbol}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {hasPosition && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                            Active
                          </span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                          pool.stable
                            ? 'text-blue-300 bg-blue-500/10 border-blue-500/20'
                            : 'text-orange-300 bg-orange-500/10 border-orange-500/20'
                        }`}>
                          {pool.stable ? 'Stable' : 'Volatile'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs flex-wrap">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-cyan-400" />
                        <span className="text-zinc-500">APR</span>
                        <span className="text-cyan-400 font-semibold">{formatAPR(pool.estimatedAPR)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">TVL </span>
                        <span className="text-zinc-300 font-mono">{formatUsd(pool.totalLiquidityUsd)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Staked LP </span>
                        <span className="text-zinc-300 font-mono">{formatStakedLP(pool.totalStaked)}</span>
                      </div>
                      {pool.rewardToken && (
                        <div className="flex items-center gap-1">
                          <img src={AERO_ICON} alt="" className="w-3 h-3 rounded-full" />
                          <span className="text-zinc-500">{pool.rewardToken.symbol}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
