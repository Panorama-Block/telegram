import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, TrendingUp, Gift, Wallet } from 'lucide-react';
import { TOKEN_ICONS, AERO_ICON } from '@/features/yield/config';
import type { YieldPoolWithAPR, UserPosition, Portfolio } from '@/features/yield/types';

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
    if (num >= 0.000001) return num.toFixed(6);
    if (num > 0) return '< 0.000001';
    return '0';
  } catch {
    return '0';
  }
}

const STABLECOINS = new Set(['USDC', 'USDbC', 'USDT', 'DAI', 'LUSD', 'crvUSD']);

function estimatePositionUsd(
  tokenASymbol: string, tokenABalance: string,
  tokenBSymbol: string, tokenBBalance: string,
): string | null {
  const a = parseFloat(tokenABalance);
  const b = parseFloat(tokenBBalance);
  if (!isFinite(a) || !isFinite(b)) return null;
  const aIsStable = STABLECOINS.has(tokenASymbol);
  const bIsStable = STABLECOINS.has(tokenBSymbol);
  // For volatile pools, each side is ~50% of value
  if (aIsStable && !bIsStable) return `~$${(a * 2).toFixed(2)}`;
  if (bIsStable && !aIsStable) return `~$${(b * 2).toFixed(2)}`;
  if (aIsStable && bIsStable) return `~$${(a + b).toFixed(2)}`;
  return null;
}

function estimatePositionUsdFromShare(
  stakedBalance: string,
  totalStaked: string,
  totalLiquidityUsd: string | null,
): string | null {
  if (!totalLiquidityUsd) return null;
  const staked = parseFloat(stakedBalance);
  const total = parseFloat(totalStaked);
  const tvl = parseFloat(totalLiquidityUsd);
  if (!isFinite(staked) || !isFinite(total) || !isFinite(tvl) || total <= 0) return null;
  const usd = (staked / total) * tvl;
  if (usd >= 0.01) return `~$${usd.toFixed(2)}`;
  if (usd > 0) return '< $0.01';
  return null;
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
  portfolio?: Portfolio | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSelectPool: (poolId: string) => void;
  onQuickClaim: (poolId: string) => void;
  onQuickExit: (poolId: string) => void;
  initialTab?: 'pools' | 'positions';
}

export function YieldSelectView({
  pools,
  userPositions,
  portfolio,
  loading,
  error,
  onRetry,
  onSelectPool,
  onQuickClaim,
  onQuickExit,
  initialTab,
}: YieldSelectViewProps) {
  const hasPositions = userPositions.length > 0;
  const [tab, setTab] = useState<'pools' | 'positions'>(initialTab ?? (hasPositions ? 'positions' : 'pools'));

  return (
    <motion.div
      key="select"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      {/* Tabs */}
      <div className="px-4 sm:px-6 pt-1 pb-3 flex gap-1 border-b border-white/5">
        <button
          type="button"
          onClick={() => setTab('pools')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            tab === 'pools'
              ? 'bg-white/10 text-white'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <TrendingUp className="w-3 h-3" />
          Pools
        </button>
        <button
          type="button"
          onClick={() => setTab('positions')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            tab === 'positions'
              ? 'bg-white/10 text-white'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Wallet className="w-3 h-3" />
          Positions
          {hasPositions && (
            <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-cyan-500 text-white text-[9px] font-bold flex items-center justify-center">
              {userPositions.length}
            </span>
          )}
        </button>
      </div>

      <div className="px-4 sm:px-6 pb-6 pt-3 space-y-2 relative z-10 flex-1 overflow-y-auto custom-scrollbar">

        {/* ── POOLS TAB ── */}
        {tab === 'pools' && (
          <>
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
              pools.map((pool) => {
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
                        <span className="text-sm font-medium text-white">
                          {pool.tokenA.symbol} / {pool.tokenB.symbol}
                        </span>
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
                      {pool.rewardToken && (
                        <div className="flex items-center gap-1">
                          <img src={AERO_ICON} alt="" className="w-3 h-3 rounded-full" />
                          <span className="text-zinc-500">{pool.rewardToken.symbol}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </>
        )}

        {/* ── POSITIONS TAB ── */}
        {tab === 'positions' && (
          <>
            {loading && !hasPositions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
              </div>
            ) : !hasPositions ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                <Wallet className="w-8 h-8 text-zinc-600" />
                <p className="text-sm text-zinc-500">No active positions</p>
                <button
                  type="button"
                  onClick={() => setTab('pools')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Browse pools →
                </button>
              </div>
            ) : (
              userPositions.map((pos) => {
                const hasRewards = parseFloat(pos.earnedRewards) > 0;
                const portfolioAsset = portfolio?.assets.find((a) => a.poolId === pos.poolId);
                const matchingPool = pools.find((p) => p.id === pos.poolId);
                const stakedWei = BigInt(pos.stakedBalance || '0');
                const walletWei = BigInt(pos.walletLpBalance || '0');
                const totalLpWei = stakedWei + walletWei;
                const totalLpStr = totalLpWei.toString();
                const usdEstimate = portfolioAsset
                  ? estimatePositionUsd(
                      portfolioAsset.tokenA.symbol, portfolioAsset.tokenA.balance,
                      portfolioAsset.tokenB.symbol, portfolioAsset.tokenB.balance,
                    )
                  : estimatePositionUsdFromShare(
                      totalLpStr,
                      matchingPool?.totalStaked ?? '0',
                      matchingPool?.totalLiquidityUsd ?? null,
                    );
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
                      <div className="flex items-center gap-2">
                        {usdEstimate && (
                          <span className="text-sm font-semibold text-cyan-300">{usdEstimate}</span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                          pos.stable
                            ? 'text-blue-300 bg-blue-500/10 border-blue-500/20'
                            : 'text-orange-300 bg-orange-500/10 border-orange-500/20'
                        }`}>
                          {pos.stable ? 'Stable' : 'Volatile'}
                        </span>
                      </div>
                    </div>

                    {portfolioAsset ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500">Position</span>
                        <span className="text-white font-mono">
                          {parseFloat(portfolioAsset.tokenA.balance).toFixed(4)} {portfolioAsset.tokenA.symbol}
                          {' + '}
                          {parseFloat(portfolioAsset.tokenB.balance).toFixed(2)} {portfolioAsset.tokenB.symbol}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500">
                          {stakedWei > 0n && walletWei > 0n ? 'LP (Staked + Wallet)' : stakedWei > 0n ? 'Staked LP' : 'LP (Wallet)'}
                        </span>
                        <span className="text-white font-mono">{formatStakedLP(totalLpStr)}</span>
                      </div>
                    )}

                    {hasRewards && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 flex items-center gap-1">
                          <Gift className="w-3 h-3" /> Rewards
                        </span>
                        <span className="text-cyan-400 font-mono">
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
              })
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
