import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, TrendingUp, Gift, Layers, BarChart3, Tractor } from 'lucide-react';
import { TOKEN_ICONS, JOE_ICON } from '@/features/avax-lp/config';
import type { AvaxLpPool, AvaxLpUserPosition } from '@/features/avax-lp/types';

type Tab = 'positions' | 'pools';

function formatAPR(apr: string | null): string {
  if (!apr) return '--';
  const num = parseFloat(apr.replace('%', ''));
  if (isNaN(num)) return '--';
  const pct = apr.includes('%') ? num : num <= 1 ? num * 100 : num;
  return `${pct.toFixed(1)}%`;
}

function formatLpBalance(wei: string): string {
  try {
    const num = parseFloat(wei) / 1e18;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    if (num >= 1) return num.toFixed(4);
    if (num >= 0.000001) return num.toFixed(6);
    if (num > 0) return '< 0.000001';
    return '0';
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

interface AvaxLpSelectViewProps {
  pools: AvaxLpPool[];
  userPositions: AvaxLpUserPosition[];
  loading: boolean;
  userLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSelectPool: (poolId: number) => void;
  onQuickClaim: (poolId: number) => void;
  onQuickRemove: (poolId: number) => void;
  initialTab?: Tab;
}

export function AvaxLpSelectView({
  pools,
  userPositions,
  loading,
  userLoading = false,
  error,
  onRetry,
  onSelectPool,
  onQuickClaim,
  onQuickRemove,
  initialTab,
}: AvaxLpSelectViewProps) {
  const hasPositions = userPositions.length > 0;
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? (hasPositions ? 'positions' : 'pools'));

  return (
    <motion.div
      key="select"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <div className="px-4 sm:px-6 pt-1 pb-3">
        <div className="flex bg-white/5 rounded-xl p-1 border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('positions')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'positions'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Positions
            {hasPositions && (
              <span className="ml-0.5 text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-px rounded-full">
                {userPositions.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pools')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'pools'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            All Pools
            <span className="ml-0.5 text-[10px] bg-white/10 text-zinc-400 px-1.5 py-px rounded-full">
              {pools.length}
            </span>
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-6 flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'positions' ? (
            <motion.div
              key="positions-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {userLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                </div>
              ) : !hasPositions ? (
                <div className="text-center py-16 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-zinc-600" />
                  </div>
                  <p className="text-sm text-zinc-500">No active positions</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('pools')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Browse pools to get started
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {userPositions.map((pos) => {
                    const hasRewards = parseFloat(pos.pendingRewards) > 0;
                    const hasStaked = parseFloat(pos.stakedBalance) > 0;
                    const hasWallet = parseFloat(pos.walletLpBalance) > 0;
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
                          {pos.farmAddress ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium text-cyan-300 bg-cyan-500/10 border-cyan-500/20">
                              Farm
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium text-zinc-500 bg-zinc-500/10 border-zinc-500/20">
                              No Farm
                            </span>
                          )}
                        </div>

                        {hasWallet && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-500">Wallet LP</span>
                            <span className="text-white font-mono">{formatLpBalance(pos.walletLpBalance)}</span>
                          </div>
                        )}

                        {hasStaked && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-500 flex items-center gap-1">
                              <Tractor className="w-3 h-3" /> Staked LP
                            </span>
                            <span className="text-white font-mono">{formatLpBalance(pos.stakedBalance)}</span>
                          </div>
                        )}

                        {hasRewards && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-500 flex items-center gap-1">
                              <Gift className="w-3 h-3" /> Rewards
                            </span>
                            <span className="text-cyan-400 font-mono flex items-center gap-1">
                              <img src={JOE_ICON} alt="" className="w-3 h-3 rounded-full" />
                              {formatRewards(pos.pendingRewards, pos.rewardToken?.decimals ?? 18)} {pos.rewardToken?.symbol}
                            </span>
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          {hasRewards && pos.farmAddress && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onQuickClaim(pos.poolId); }}
                              className="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                            >
                              Claim
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); onQuickRemove(pos.poolId); }}
                            className="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                          >
                            Remove
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
              )}
            </motion.div>
          ) : (
            <motion.div
              key="pools-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
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
                <div className="text-center py-12 text-zinc-500 text-sm">No pools available</div>
              ) : (
                <div className="space-y-2">
                  {pools.map((pool) => {
                    const userPos = userPositions.find((p) => p.poolId === pool.poolId);
                    const hasPosition = !!userPos;
                    const hasFarm = pool.farmAddress !== null;

                    return (
                      <button
                        key={pool.poolId}
                        type="button"
                        onClick={() => onSelectPool(pool.poolId)}
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
                            <span className="text-sm font-medium text-white">
                              {pool.tokenA.symbol} / {pool.tokenB.symbol}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {hasPosition && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                                Active
                              </span>
                            )}
                            {hasFarm ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium text-cyan-300 bg-cyan-500/10 border-cyan-500/20">
                                Farm
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium text-zinc-500 bg-zinc-500/10 border-zinc-500/20">
                                LP only
                              </span>
                            )}
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
                          {hasFarm && (
                            <div className="flex items-center gap-1">
                              <img src={JOE_ICON} alt="" className="w-3 h-3 rounded-full" />
                              <span className="text-zinc-500">{pool.rewardToken?.symbol}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
