'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis } from 'recharts';
import { GlassCard } from "@/components/ui/GlassCard";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  Wallet,
  ArrowLeft,
  Scan,
  Loader2,
  Zap,
  Trash2,
  Pause,
  Play,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  Calendar,
  Clock,
  Landmark,
  Droplets,
  ExternalLink,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { usePortfolioData } from "@/features/portfolio/usePortfolioData";
import { usePortfolioHistory, type TimeRange } from "@/features/portfolio/usePortfolioHistory";
import { useSmartWalletPortfolio } from "@/features/portfolio/useSmartWalletPortfolio";
import { useStakingApi, type WithdrawalRequest } from "@/features/staking/api";
import { useStakingData } from "@/features/staking/useStakingData";
import { useAvaxStakingApi, type AvaxStakingPosition } from "@/features/staking/avaxStakingApi";
import { useLendingData } from "@/features/lending/useLendingData";
import { SmartWalletCard } from "@/features/portfolio/SmartWalletCard";
import { CreateSmartWalletModal } from "@/features/portfolio/CreateSmartWalletModal";
import { DeleteWalletModal } from "@/features/portfolio/DeleteWalletModal";
import DepositModal from "@/features/dca/DepositModal";
import WithdrawModal from "@/features/dca/WithdrawModal";
import { deleteSmartAccount, deleteStrategy, toggleStrategy, DCAStrategy } from "@/features/dca/api";
import { useActiveAccount } from "thirdweb/react";
import { shortenAddress } from "thirdweb/utils";
import { isGatewayUnavailableError, useTransactionHistory } from "@/features/gateway";
import { formatAmountHuman } from "@/features/swap/utils";

type ViewMode = 'main' | 'smart';
type TabMode = 'assets' | 'staking' | 'lending' | 'dca' | 'history';

const ALLOCATION_COLORS: Record<string, string> = {
  'Blue Chips':  '#6366f1',  // indigo-500
  'Stablecoins': '#10b981',  // emerald-500
  'Altcoins':    '#f97316',  // orange-500
};

function getExplorerUrl(chainId: number, hash: string): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io/tx',
    43114: 'https://snowtrace.io/tx',
    137: 'https://polygonscan.com/tx',
    56: 'https://bscscan.com/tx',
    42161: 'https://arbiscan.io/tx',
    10: 'https://optimistic.etherscan.io/tx',
    8453: 'https://basescan.org/tx',
    59144: 'https://lineascan.build/tx',
  };
  const base = explorers[chainId] ?? `https://blockscan.com/tx`;
  return `${base}/${hash}`;
}

function formatAPY(apy: number | null | undefined): string {
  if (apy == null || !Number.isFinite(apy)) return '--';
  return `${apy.toFixed(4)}%`;
}

function safeParseBigInt(value: string | null | undefined): bigint | null {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function formatWei(wei: string | null | undefined, decimals = 18): string {
  const parsed = safeParseBigInt(wei);
  if (parsed == null) return '--';
  // For very small values (e.g. tiny LP positions), show enough decimals
  let frac = 6;
  if (parsed > 0n && parsed < 10n ** BigInt(decimals - 6)) {
    const valueDigits = parsed.toString().length;
    const leadingZeros = decimals - valueDigits;
    frac = Math.min(leadingZeros + 2, decimals);
    frac = Math.max(frac, 6);
  }
  const human = formatAmountHuman(parsed, decimals, frac);
  return human === '0' ? '0.00' : human;
}

function formatLastUpdated(tsMs: number | null | undefined): string {
  if (!tsMs || tsMs <= 0) return '--';
  const delta = Date.now() - tsMs;
  if (delta < 15_000) return 'just now';
  const mins = Math.floor(delta / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function PortfolioPage() {
  const account = useActiveAccount();
  const { assets: mainAssets, stats: mainStats, loading: mainLoading, refresh: refreshMain } = usePortfolioData();
  const {
    smartAccounts,
    selectedAccount,
    assets: smartAssets,
    stats: smartStats,
    strategies,
    loading: smartLoading,
    loadingAssets: smartAssetsLoading,
    hasSmartWallet,
    selectAccount,
    refresh: refreshSmartAccounts,
    refreshAssets: refreshSmartAssets,
  } = useSmartWalletPortfolio();

  // Transaction History
  const {
    transactions,
    loading: txLoading,
    error: txError,
    refresh: refreshTx,
    loadMore: loadMoreTx,
    hasMore: hasMoreTx,
  } = useTransactionHistory({
    userId: account?.address?.toLowerCase() || '',
    limit: 10,
  });
  const isGatewayHistoryUnavailable = isGatewayUnavailableError(txError);

  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [activeTab, setActiveTab] = useState<TabMode>('assets');
  const [historyRange, setHistoryRange] = useState<TimeRange>('1W');
  const [stakingSlide, setStakingSlide] = useState(0);
  const [lendingSlide, setLendingSlide] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // DCA Strategy management
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
  const [strategyActionLoading, setStrategyActionLoading] = useState<string | null>(null);

  const stakingApi = useStakingApi();
  const {
    tokens: stakingTokens,
    userPosition: stakingPosition,
    loading: stakingLoading,
    error: stakingError,
    refresh: refreshStaking,
    lastFetchTime: stakingLastFetchTime,
  } = useStakingData();
  const {
    tokens: lendingTokens,
    userPosition: lendingPosition,
    loading: lendingLoading,
    error: lendingError,
    fetchPosition: refreshLendingPosition,
    lastFetchTime: lendingLastFetchTime,
  } = useLendingData();

  // AVAX Liquid Staking
  const avaxStakingApi = useAvaxStakingApi();
  const [avaxPosition, setAvaxPosition] = useState<AvaxStakingPosition | null>(null);
  const [avaxLoading, setAvaxLoading] = useState(false);

  const refreshAvaxPosition = useCallback(async () => {
    setAvaxLoading(true);
    try {
      const pos = await avaxStakingApi.getPosition();
      setAvaxPosition(pos);
    } catch {
      // silently ignore — user may not have AVAX position
    } finally {
      setAvaxLoading(false);
    }
  }, [avaxStakingApi]);

  const [stakingWithdrawals, setStakingWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [stakingWithdrawalsLoading, setStakingWithdrawalsLoading] = useState(false);
  const [stakingWithdrawalsError, setStakingWithdrawalsError] = useState<string | null>(null);
  const [stakingWithdrawalsLastFetchTime, setStakingWithdrawalsLastFetchTime] = useState<number>(0);

  const refreshStakingWithdrawals = useCallback(async (force = false) => {
    const now = Date.now();
    const MIN_INTERVAL = 2 * 60 * 1000;
    if (!force && stakingWithdrawalsLastFetchTime > 0 && (now - stakingWithdrawalsLastFetchTime) < MIN_INTERVAL) {
      return;
    }

    setStakingWithdrawalsLoading(true);
    setStakingWithdrawalsError(null);
    try {
      const w = await stakingApi.getWithdrawals();
      setStakingWithdrawals(w);
      setStakingWithdrawalsLastFetchTime(now);
    } catch (e) {
      setStakingWithdrawalsError(e instanceof Error ? e.message : 'Failed to load withdrawals');
    } finally {
      setStakingWithdrawalsLoading(false);
    }
  }, [stakingApi, stakingWithdrawalsLastFetchTime]);

  const lidoApy = useMemo(() => {
    const eth = stakingTokens.find((t) => t.symbol === 'ETH') || stakingTokens.find((t) => t.symbol === 'stETH');
    return eth?.stakingAPY ?? null;
  }, [stakingTokens]);

  // Portfolio view wants positions (not just token list); fetch lending + staking withdrawals in the background.
  useEffect(() => {
    if (viewMode !== 'main') return;
    refreshStakingWithdrawals();
    void refreshLendingPosition();
    void refreshAvaxPosition();
  }, [refreshLendingPosition, refreshStakingWithdrawals, refreshAvaxPosition, viewMode]);

  // Determine which data to show based on view mode
  const isSmartWalletView = viewMode === 'smart' && hasSmartWallet;
  const currentAssetsUnsorted = isSmartWalletView ? smartAssets : mainAssets;
  const currentAssets = useMemo(() => [...currentAssetsUnsorted].sort((a, b) => (b.valueRaw || 0) - (a.valueRaw || 0)), [currentAssetsUnsorted]);
  const currentStats = isSmartWalletView ? smartStats : mainStats;
  const currentLoading = isSmartWalletView ? smartAssetsLoading : mainLoading;

  const activeStrategiesCount = strategies.filter(s => s.isActive).length;

  // Portfolio performance history (real prices from CoinGecko × current balances)
  const { history: balanceHistory, loading: historyLoading, pnl: historyPnl } = usePortfolioHistory(mainAssets, historyRange);

  const handleSmartWalletCardClick = () => {
    if (hasSmartWallet) {
      setViewMode(viewMode === 'smart' ? 'main' : 'smart');
    }
  };

  const handleRefresh = () => {
    if (isSmartWalletView) {
      refreshSmartAssets();
    } else {
      refreshMain();
    }
  };

  const handleDeleteWallet = () => {
    if (!selectedAccount || !account?.address) return;
    setShowDeleteModal(true);
  };

  const confirmDeleteWallet = async () => {
    if (!selectedAccount || !account?.address) return;

    setIsDeleting(true);
    try {
      await deleteSmartAccount(selectedAccount.address, account.address);
      await refreshSmartAccounts();
      // If no more wallets, switch back to main view
      if (smartAccounts.length <= 1) {
        setViewMode('main');
      }
    } catch (error) {
      console.error('Error deleting wallet:', error);
      alert('Failed to delete wallet. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle toggling strategy active status
  const handleToggleStrategy = async (strategy: DCAStrategy) => {
    if (!strategy.strategyId || !account?.address) return;

    setStrategyActionLoading(strategy.strategyId);
    try {
      await toggleStrategy(strategy.strategyId, !strategy.isActive, account.address);
      await refreshSmartAccounts();
    } catch (error) {
      console.error('Error toggling strategy:', error);
      alert('Failed to toggle strategy. Please try again.');
    } finally {
      setStrategyActionLoading(null);
    }
  };

  // Handle deleting a strategy
  const handleDeleteStrategy = async (strategy: DCAStrategy) => {
    if (!strategy.strategyId || !account?.address) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this DCA strategy? This action cannot be undone.'
    );
    if (!confirmed) return;

    setStrategyActionLoading(strategy.strategyId);
    try {
      await deleteStrategy(strategy.strategyId, account.address);
      await refreshSmartAccounts();
      setExpandedStrategy(null);
    } catch (error) {
      console.error('Error deleting strategy:', error);
      alert('Failed to delete strategy. Please try again.');
    } finally {
      setStrategyActionLoading(null);
    }
  };

  // Get token symbol from address
  const getTokenSymbol = (address: string) => {
    const tokenMap: Record<string, string> = {
      '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE': 'ETH',
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 'WETH',
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 'USDC',
      '0xdAC17F958D2ee523a2206206994597C13D831ec7': 'USDT',
      '0x6B175474E89094C44Da98b954EescdeCB5147d6dc': 'DAI',
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': 'WBTC',
      '0x514910771AF9Ca656af840dff83E8264EcF986CA': 'LINK',
      '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984': 'UNI',
    };
    return tokenMap[address] || address.slice(0, 6) + '...';
  };

  const stakingClaimable = useMemo(() => {
    const claimable = stakingWithdrawals.filter((w) => w.isFinalized && !w.isClaimed);
    const amountWei = claimable.reduce((acc, w) => {
      const v = safeParseBigInt(w.amountOfStETHWei);
      return v != null ? acc + v : acc;
    }, 0n);
    return { count: claimable.length, amountWei: amountWei.toString() };
  }, [stakingWithdrawals]);

  const stakingPending = useMemo(() => {
    const pending = stakingWithdrawals.filter((w) => !w.isFinalized && !w.isClaimed);
    const amountWei = pending.reduce((acc, w) => {
      const v = safeParseBigInt(w.amountOfStETHWei);
      return v != null ? acc + v : acc;
    }, 0n);
    return { count: pending.length, amountWei: amountWei.toString() };
  }, [stakingWithdrawals]);

  const stakingLastUpdated = useMemo(() => {
    return Math.max(stakingLastFetchTime || 0, stakingWithdrawalsLastFetchTime || 0);
  }, [stakingLastFetchTime, stakingWithdrawalsLastFetchTime]);

  const lendingSuppliedRows = useMemo(() => {
    const rows = lendingPosition?.positions || [];
    return rows
      .filter((r) => safeParseBigInt(r.suppliedWei) && BigInt(r.suppliedWei) > 0n)
      .map((r) => ({
        symbol: r.underlyingSymbol,
        amount: formatAmountHuman(BigInt(r.suppliedWei), r.underlyingDecimals, 4),
      }));
  }, [lendingPosition?.positions]);

  const lendingBorrowedRows = useMemo(() => {
    const rows = lendingPosition?.positions || [];
    return rows
      .filter((r) => safeParseBigInt(r.borrowedWei) && BigInt(r.borrowedWei) > 0n)
      .map((r) => ({
        symbol: r.underlyingSymbol,
        amount: formatAmountHuman(BigInt(r.borrowedWei), r.underlyingDecimals, 4),
      }));
  }, [lendingPosition?.positions]);

  const lendingHealthLabel = useMemo(() => {
    const liq = lendingPosition?.liquidity;
    if (!liq) return { text: '--', tone: 'zinc' as const };
    const shortfall = safeParseBigInt(liq.shortfall) || 0n;
    if (shortfall > 0n) return { text: 'Shortfall', tone: 'red' as const };
    return liq.isHealthy ? { text: 'Healthy', tone: 'green' as const } : { text: 'At risk', tone: 'yellow' as const };
  }, [lendingPosition?.liquidity]);

  const lendingPositionApy = useMemo(() => {
    if (!lendingPosition?.positions?.length || !lendingTokens.length) return null;

    const suppliedPositions = lendingPosition.positions.filter((position) => {
      const supplied = safeParseBigInt(position.suppliedWei);
      return supplied != null && supplied > 0n;
    });
    if (suppliedPositions.length === 0) return null;

    const normalizeAddressLower = (value: unknown) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed ? trimmed.toLowerCase() : null;
    };

    const normalizeSymbolUpper = (value: unknown) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed ? trimmed.toUpperCase() : null;
    };

    const normalizedTokens = lendingTokens.map((token) => ({
      ...token,
      addressLower: normalizeAddressLower(token.address),
      symbolUpper: normalizeSymbolUpper(token.symbol),
    }));

    const collectedApy: number[] = [];
    for (const position of suppliedPositions) {
      const addressLower = normalizeAddressLower(position.underlyingAddress);
      const symbolUpper = normalizeSymbolUpper(position.underlyingSymbol);
      const market =
        (addressLower
          ? normalizedTokens.find((token) => token.addressLower === addressLower)
          : undefined) ??
        (symbolUpper
          ? normalizedTokens.find((token) => token.symbolUpper === symbolUpper)
          : undefined);
      if (market && Number.isFinite(market.supplyAPY)) {
        collectedApy.push(market.supplyAPY);
      }
    }

    if (collectedApy.length === 0) return null;
    return collectedApy.reduce((sum, apy) => sum + apy, 0) / collectedApy.length;
  }, [lendingPosition?.positions, lendingTokens]);

  return (
    <ProtectedRoute>
    <div className="min-h-[100dvh] bg-[#050505] relative overflow-x-hidden flex flex-col text-foreground font-sans safe-area-pb">
      {/* Ambient gradient */}
      <div className="absolute top-0 inset-x-0 h-[400px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/8 via-transparent to-transparent blur-3xl pointer-events-none z-0" />

      {/* Navigation Header */}
      <div className="relative z-20 px-4 py-4 flex justify-between items-center max-w-2xl mx-auto w-full">
        <Link href="/chat?new=true" className="flex items-center gap-2 text-zinc-400 hover:text-white active:text-white transition-colors group">
          <div className="p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full bg-white/5 border border-white/10 group-hover:bg-white/10 group-active:bg-white/15 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="font-medium text-sm hidden xs:inline">Back to Chat</span>
        </Link>
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <Link href="/portfolio/profile" className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-500 shadow-inner" />
        </div>
      </div>

      <div className="relative z-10 flex-1 px-4 pb-12 max-w-2xl mx-auto w-full space-y-4">


        {/* ─── 1. UNIFIED HERO CARD ────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl p-6">
            <div className="absolute -top-16 -right-16 w-52 h-52 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-purple-500/6 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">

              {/* Label + Refresh */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-zinc-500 uppercase tracking-widest font-medium">Total Portfolio</span>
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-cyan-400 transition-colors"
                >
                  {currentLoading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Scan className="w-3.5 h-3.5" />
                  }
                  {currentLoading ? 'Scanning...' : 'Refresh'}
                </button>
              </div>

              {/* Net Worth Value */}
              <div className="mb-1">
                <span className="text-4xl font-bold text-white tracking-tight">
                  {currentLoading && currentStats.netWorthRaw === 0
                    ? <span className="text-zinc-600 animate-pulse">$-,---.--</span>
                    : currentStats.netWorth
                  }
                </span>
              </div>

              {/* P&L from history (real) or fallback */}
              <div className="flex items-center gap-2 mb-5">
                {historyPnl ? (
                  <>
                    <span className={cn(
                      "text-sm font-medium flex items-center gap-1",
                      historyPnl.isPositive ? "text-emerald-400" : "text-red-400"
                    )}>
                      {historyPnl.isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {historyPnl.amountStr}
                    </span>
                    <span className={cn(
                      "text-xs font-mono px-1.5 py-0.5 rounded-md",
                      historyPnl.isPositive
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                    )}>
                      {historyPnl.percentStr}
                    </span>
                    <span className="text-[11px] text-zinc-600">{historyRange === '1W' ? '7d' : '30d'}</span>
                  </>
                ) : historyLoading ? (
                  <span className="text-xs text-zinc-600 flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading performance...
                  </span>
                ) : (
                  <span className="text-xs text-zinc-600">-- performance</span>
                )}
              </div>

              {/* Performance Chart */}
              <div className="mb-2">
                {balanceHistory.length >= 2 ? (
                  <div className="h-[120px] w-full -mx-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={balanceHistory}
                        margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"
                              stopColor={historyPnl?.isPositive === false ? '#ef4444' : '#06b6d4'}
                              stopOpacity={0.3}
                            />
                            <stop offset="100%"
                              stopColor={historyPnl?.isPositive === false ? '#ef4444' : '#06b6d4'}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <YAxis domain={['auto', 'auto']} hide />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: '#52525b', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const pt = payload[0].payload as { date: string; value: number };
                            return (
                              <div className="bg-zinc-900/95 border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
                                <div className="text-zinc-400 mb-0.5">{pt.date}</div>
                                <div className="text-white font-semibold font-mono">
                                  ${pt.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={historyPnl?.isPositive === false ? '#ef4444' : '#06b6d4'}
                          strokeWidth={2}
                          fill="url(#perfGrad)"
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 0, fill: historyPnl?.isPositive === false ? '#ef4444' : '#06b6d4' }}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[120px] flex items-center justify-center">
                    {historyLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-zinc-700" />
                    ) : (
                      <span className="text-[11px] text-zinc-700">Connect a wallet to see performance</span>
                    )}
                  </div>
                )}

                {/* Time range selector */}
                <div className="flex gap-1.5 mt-2">
                  {(['1W', '1M'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setHistoryRange(r)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                        historyRange === r
                          ? "bg-white/10 text-white"
                          : "text-zinc-600 hover:text-zinc-400"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/5 my-4" />

              {/* Allocation section */}
              <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-medium mb-3">Allocation</div>

              {currentStats.allocation.every(a => a.value === 0) ? (
                <div className="flex items-center justify-center h-16 text-zinc-600 text-xs">
                  No assets to display
                </div>
              ) : (
                <div className="flex items-center gap-5">
                  {/* Donut */}
                  <div className="w-[88px] h-[88px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={currentStats.allocation.filter(a => a.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={26}
                          outerRadius={40}
                          dataKey="value"
                          strokeWidth={0}
                          paddingAngle={2}
                        >
                          {currentStats.allocation
                            .filter(a => a.value > 0)
                            .map((item) => (
                              <Cell
                                key={item.label}
                                fill={ALLOCATION_COLORS[item.label] ?? '#6b7280'}
                              />
                            ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const item = payload[0].payload as { label: string; value: number };
                            return (
                              <div className="bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs">
                                <span className="text-white font-medium">{item.label}</span>
                                <span className="text-zinc-400 ml-2">{item.value.toFixed(1)}%</span>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {currentStats.allocation.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: ALLOCATION_COLORS[item.label] ?? '#6b7280' }}
                          />
                          <span className="text-xs text-zinc-400 truncate">{item.label}</span>
                        </div>
                        <span className="text-xs font-mono text-white shrink-0">
                          {item.value.toFixed(0)}%
                        </span>
                      </div>
                    ))}

                    {/* Staking / Lending strip */}
                    <div className="flex items-center gap-3 pt-2 border-t border-white/5 mt-1">
                      <div className="flex items-center gap-1.5">
                        <Droplets className="w-3 h-3 text-sky-400" />
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {Number.isFinite(lidoApy) ? `${lidoApy!.toFixed(2)}%` : '--'}
                        </span>
                      </div>
                      <div className="w-px h-3 bg-white/10" />
                      <div className="flex items-center gap-1.5">
                        <Landmark className="w-3 h-3 text-emerald-400" />
                        <span className={cn(
                          "text-[11px] font-mono",
                          lendingHealthLabel.tone === 'green'  && "text-emerald-400",
                          lendingHealthLabel.tone === 'yellow' && "text-yellow-400",
                          lendingHealthLabel.tone === 'red'    && "text-red-400",
                          lendingHealthLabel.tone === 'zinc'   && "text-zinc-500",
                        )}>
                          {lendingHealthLabel.text}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ─── 3. TAB NAVIGATION ──────────────────────────────────── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <div className="flex gap-1 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {(
              [
                { key: 'assets',  label: 'Assets',  icon: <Wallet className="w-3.5 h-3.5" /> },
                { key: 'staking', label: 'Staking', icon: <Droplets className="w-3.5 h-3.5" /> },
                { key: 'lending', label: 'Lending', icon: <Landmark className="w-3.5 h-3.5" /> },
                { key: 'dca',     label: 'DCA',     icon: <Zap className="w-3.5 h-3.5" /> },
                { key: 'history', label: 'History', icon: <Clock className="w-3.5 h-3.5" /> },
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0",
                  activeTab === tab.key
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                )}
              >
                {tab.icon}
                {tab.label}
                {tab.key === 'dca' && activeStrategiesCount > 0 && (
                  <span className="ml-0.5 text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full font-medium">
                    {activeStrategiesCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ─── 4. TAB CONTENT ─────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >

            {/* ══ ASSETS TAB ════════════════════════════════════════ */}
            {activeTab === 'assets' && (
              <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl p-5 space-y-1">
                {currentLoading && currentAssets.length === 0 && (
                  <div className="py-14 text-center text-zinc-600 text-sm flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Scanning wallets...
                  </div>
                )}
                {currentAssets.length === 0 && !currentLoading && (
                  <div className="py-14 text-center text-zinc-600 text-sm">
                    {isSmartWalletView
                      ? 'No assets in Smart Wallet.'
                      : account
                        ? 'No assets found. Try refreshing.'
                        : 'Connect a wallet to see your assets.'}
                  </div>
                )}
                {currentAssets.map((asset) => (
                  <div
                    key={`${asset.network}-${asset.symbol}-${asset.address}`}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 shrink-0">
                      {asset.icon
                        ? <img src={asset.icon} alt={asset.symbol} className="w-full h-full rounded-full object-cover" />
                        : asset.symbol[0]
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm text-white font-medium">{asset.symbol}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/5 text-zinc-500">
                          {asset.network}
                        </span>
                        {asset.protocol !== 'Wallet' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/10 text-cyan-500/80">
                            {asset.protocol}
                            {asset.protocol === 'Lido' && Number.isFinite(lidoApy) && ` · ${lidoApy!.toFixed(2)}%`}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500 font-mono">{asset.balance}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm text-white font-mono">{asset.value}</div>
                      <div className="text-[11px] text-zinc-600 font-mono">{asset.price}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ══ STAKING TAB ═══════════════════════════════════════ */}
            {activeTab === 'staking' && (
              <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Updated {formatLastUpdated(stakingLastUpdated)}</span>
                  <button
                    type="button"
                    onClick={() => { void refreshStaking(); void refreshStakingWithdrawals(true); void refreshAvaxPosition(); }}
                    disabled={stakingLoading || stakingWithdrawalsLoading}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors disabled:opacity-50"
                  >
                    {(stakingLoading || stakingWithdrawalsLoading)
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Scan className="w-3 h-3" />
                    }
                    Refresh
                  </button>
                </div>

                {/* Lido */}
                <GlassCard className="p-5 bg-white/[0.03] border-white/5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img src="https://assets.coingecko.com/coins/images/13442/small/steth_logo.png" alt="Lido" className="w-9 h-9 rounded-lg" />
                        <img src="https://assets.coingecko.com/coins/images/279/small/ethereum.png" alt="ETH" className="w-4 h-4 rounded-full absolute -bottom-1 -right-1 ring-2 ring-[#0A0A0A]" />
                      </div>
                      <div>
                        <div className="text-white font-medium">Lido</div>
                        <div className="text-xs text-zinc-500">Ethereum</div>
                      </div>
                    </div>
                    <div className={cn(
                      "text-[11px] px-2 py-1 rounded-lg border shrink-0",
                      stakingClaimable.count > 0
                        ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                        : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                    )}>
                      {stakingClaimable.count > 0
                        ? `${stakingClaimable.count} Claimable`
                        : stakingPending.count > 0 ? `${stakingPending.count} Pending` : 'Active'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-3.5 h-3.5 text-sky-400" />
                      <span className="text-xs font-medium text-white">Liquid Staking</span>
                      {Number.isFinite(lidoApy) && (
                        <span className="text-xs font-medium ml-auto text-emerald-400">{lidoApy!.toFixed(2)}% APY</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">stETH</div>
                        <div className="text-sm font-mono text-white">{formatWei(stakingPosition?.stETHBalance)}</div>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">wstETH</div>
                        <div className="text-sm font-mono text-white">{formatWei(stakingPosition?.wstETHBalance)}</div>
                      </div>
                    </div>
                    {stakingPending.count > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Pending Withdrawals</span>
                        <span className="text-xs font-mono text-amber-400">{stakingPending.count}</span>
                      </div>
                    )}
                  </div>
                  {(stakingError || stakingWithdrawalsError) && (
                    <div className="mt-3 text-xs text-red-400">{stakingError || stakingWithdrawalsError}</div>
                  )}
                  <Link href="/chat?open=staking" className="inline-flex items-center gap-1.5 mt-4 text-xs px-3 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/15 border border-sky-500/20 text-sky-400 transition-colors">
                    Manage Position <Droplets className="w-3 h-3" />
                  </Link>
                </GlassCard>

                {/* AVAX / sAVAX */}
                <GlassCard className="p-5 bg-white/[0.03] border-white/5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img
                          src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/assets/0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE/logo.png"
                          alt="sAVAX"
                          className="w-9 h-9 rounded-full"
                        />
                        <img
                          src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png"
                          alt="AVAX"
                          className="w-4 h-4 rounded-full absolute -bottom-1 -right-1 ring-2 ring-[#0A0A0A]"
                        />
                      </div>
                      <div>
                        <div className="text-white font-medium">BenQi · sAVAX</div>
                        <div className="text-xs text-zinc-500">Avalanche</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {avaxLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />}
                      {avaxPosition && (
                        <div className={cn(
                          "text-[11px] px-2 py-1 rounded-lg border shrink-0",
                          avaxPosition.pendingUnlocks.some(u => u.redeemable)
                            ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                            : avaxPosition.pendingUnlocks.length > 0
                              ? "text-blue-400 border-blue-500/30 bg-blue-500/10"
                              : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                        )}>
                          {avaxPosition.pendingUnlocks.some(u => u.redeemable)
                            ? `${avaxPosition.pendingUnlocks.filter(u => u.redeemable).length} Redeemable`
                            : avaxPosition.pendingUnlocks.length > 0
                              ? `${avaxPosition.pendingUnlocks.length} Pending`
                              : 'Active'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-xs font-medium text-white">Liquid Staking (sAVAX)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">sAVAX Balance</div>
                        <div className="text-sm font-mono text-white">{avaxPosition ? formatWei(avaxPosition.sAvaxBalance) : '--'}</div>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Pending Unlocks</div>
                        <div className="text-sm font-mono text-white">{avaxPosition ? avaxPosition.pendingUnlocks.length : '--'}</div>
                      </div>
                    </div>
                    {avaxPosition?.pendingUnlocks.some(u => u.redeemable) && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Ready to Redeem</span>
                        <span className="text-xs font-mono text-amber-400">
                          {avaxPosition.pendingUnlocks.filter(u => u.redeemable).length}
                        </span>
                      </div>
                    )}
                  </div>
                  <Link href="/chat?open=staking" className="inline-flex items-center gap-1.5 mt-4 text-xs px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 transition-colors">
                    Manage Position <Droplets className="w-3 h-3" />
                  </Link>
                </GlassCard>
              </div>
            )}

            {/* ══ LENDING TAB ═══════════════════════════════════════ */}
            {activeTab === 'lending' && (
              <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Updated {formatLastUpdated(lendingLastFetchTime)}</span>
                  <button
                    type="button"
                    onClick={() => void refreshLendingPosition()}
                    disabled={lendingLoading}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors disabled:opacity-50"
                  >
                    {lendingLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scan className="w-3 h-3" />}
                    Refresh
                  </button>
                </div>

                {/* Benqi */}
                <GlassCard className="p-5 bg-white/[0.03] border-white/5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/9288.png" alt="Benqi" className="w-9 h-9 rounded-lg" />
                        <img src="https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png" alt="AVAX" className="w-4 h-4 rounded-full absolute -bottom-1 -right-1 ring-2 ring-[#0A0A0A]" />
                      </div>
                      <div>
                        <div className="text-white font-medium">Benqi</div>
                        <div className="text-xs text-zinc-500">Avalanche</div>
                      </div>
                    </div>
                    <div className={cn(
                      "text-[11px] px-2 py-1 rounded-lg border shrink-0",
                      lendingHealthLabel.tone === 'green' && "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                      lendingHealthLabel.tone === 'yellow' && "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
                      lendingHealthLabel.tone === 'red' && "text-red-400 border-red-500/30 bg-red-500/10",
                      lendingHealthLabel.tone === 'zinc' && "text-zinc-400 border-white/10 bg-white/5",
                    )}>
                      {lendingHealthLabel.text}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-medium text-white">Lending</span>
                      {Number.isFinite(lendingPositionApy) && (
                        <span className="text-xs font-medium ml-auto text-emerald-400">{lendingPositionApy!.toFixed(2)}% APY</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Supplied</div>
                        <div className="text-sm font-mono text-white">
                          {lendingSuppliedRows.length === 0
                            ? '–'
                            : lendingSuppliedRows.slice(0, 2).map(r => `${r.amount} ${r.symbol}`).join(', ')}
                          {lendingSuppliedRows.length > 2 ? ` +${lendingSuppliedRows.length - 2}` : ''}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Borrowed</div>
                        <div className="text-sm font-mono text-white">
                          {lendingBorrowedRows.length === 0
                            ? '–'
                            : lendingBorrowedRows.slice(0, 2).map(r => `${r.amount} ${r.symbol}`).join(', ')}
                          {lendingBorrowedRows.length > 2 ? ` +${lendingBorrowedRows.length - 2}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Health Factor</span>
                      <span className={cn(
                        "text-xs font-medium",
                        lendingHealthLabel.tone === 'green' && "text-emerald-400",
                        lendingHealthLabel.tone === 'yellow' && "text-yellow-400",
                        lendingHealthLabel.tone === 'red' && "text-red-400",
                        lendingHealthLabel.tone === 'zinc' && "text-zinc-400",
                      )}>
                        {lendingHealthLabel.text}
                      </span>
                    </div>
                  </div>
                  {lendingError && <div className="mt-3 text-xs text-red-400">{lendingError}</div>}
                  <Link href="/chat?open=lending" className="inline-flex items-center gap-1.5 mt-4 text-xs px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 transition-colors">
                    Manage Position <Landmark className="w-3 h-3" />
                  </Link>
                </GlassCard>
              </div>
            )}

            {/* ══ DCA TAB ═══════════════════════════════════════════ */}
            {activeTab === 'dca' && (
              <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl p-5 space-y-3">
                <SmartWalletCard
                  smartAccount={selectedAccount}
                  smartAccounts={smartAccounts}
                  hasSmartWallet={hasSmartWallet}
                  loading={smartLoading || isDeleting}
                  isSelected={isSmartWalletView}
                  balance={smartStats.netWorth}
                  activeStrategies={activeStrategiesCount}
                  onSelect={handleSmartWalletCardClick}
                  onCreateWallet={() => setShowCreateModal(true)}
                  onDeposit={() => setShowDepositModal(true)}
                  onWithdraw={() => setShowWithdrawModal(true)}
                  onDelete={handleDeleteWallet}
                  onSelectAccount={selectAccount}
                />
                {!hasSmartWallet && (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                      <Zap className="w-5 h-5 text-zinc-600" />
                    </div>
                    <p className="text-sm text-zinc-500 mb-4">Create a Smart Wallet to enable DCA strategies</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm hover:bg-cyan-500/15 transition-colors"
                    >
                      Create Smart Wallet
                    </button>
                  </div>
                )}
                {hasSmartWallet && strategies.length === 0 && (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                      <Zap className="w-5 h-5 text-zinc-600" />
                    </div>
                    <p className="text-sm text-zinc-500">No DCA strategies yet.</p>
                    <p className="text-xs text-zinc-600 mt-1">Ask Zico to set one up for you.</p>
                  </div>
                )}
                {hasSmartWallet && strategies.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">
                        {strategies.filter(s => s.isActive).length} active · {strategies.length} total
                      </span>
                    </div>
                    {strategies.map((strategy, i) => {
                      const isExpanded = expandedStrategy === strategy.strategyId;
                      const isLoading = strategyActionLoading === strategy.strategyId;
                      const fromSymbol = getTokenSymbol(strategy.fromToken);
                      const toSymbol = getTokenSymbol(strategy.toToken);
                      return (
                        <GlassCard
                          key={strategy.strategyId || i}
                          className={cn("p-4 bg-[#0A0A0A]/60 transition-all", isExpanded && "ring-1 ring-cyan-500/30")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-xs font-bold text-cyan-400 border border-cyan-500/20 shrink-0">
                                {fromSymbol.slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-white truncate">
                                  {strategy.amount} {fromSymbol} → {toSymbol}
                                </div>
                                <div className="text-xs text-zinc-500 flex items-center gap-2 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    <span className="capitalize">{strategy.interval}</span>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(strategy.nextExecution * 1000).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                                strategy.isActive
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
                              )}>
                                {strategy.isActive ? 'Active' : 'Paused'}
                              </div>
                              <button
                                onClick={() => setExpandedStrategy(isExpanded ? null : strategy.strategyId || null)}
                                className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-4 pt-4 border-t border-white/5"
                            >
                              <div className="grid grid-cols-2 gap-3 mb-4">
                                {[
                                  { label: 'Amount',         value: `${strategy.amount} ${fromSymbol}`,                                                                       cls: '' },
                                  { label: 'Frequency',      value: strategy.interval,                                                                                         cls: 'capitalize' },
                                  { label: 'Last Executed',  value: strategy.lastExecuted > 0 ? new Date(strategy.lastExecuted * 1000).toLocaleDateString() : 'Never',        cls: '' },
                                  { label: 'Next Execution', value: new Date(strategy.nextExecution * 1000).toLocaleDateString(),                                               cls: '' },
                                ].map(({ label, value, cls }) => (
                                  <div key={label}>
                                    <div className="text-[10px] text-zinc-500 uppercase mb-1">{label}</div>
                                    <div className={cn("text-sm text-white", cls)}>{value}</div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleToggleStrategy(strategy)}
                                  disabled={isLoading}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                                    strategy.isActive
                                      ? "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20"
                                      : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20",
                                    isLoading && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : strategy.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                  {strategy.isActive ? 'Pause' : 'Resume'}
                                </button>
                                <button
                                  onClick={() => handleDeleteStrategy(strategy)}
                                  disabled={isLoading}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs font-medium transition-colors",
                                    isLoading && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  Delete
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </GlassCard>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* ══ HISTORY TAB ═══════════════════════════════════════ */}
            {activeTab === 'history' && (
              <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl p-5 space-y-1">
                {txLoading && transactions.length === 0 && (
                  <div className="py-14 text-center text-zinc-600 text-sm flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                )}
                {!txLoading && transactions.length === 0 && (
                  <div className="py-14 text-center text-zinc-600 text-sm">
                    {isGatewayHistoryUnavailable
                      ? 'History unavailable (gateway offline).'
                      : txError
                        ? <span className="text-red-400/70">{txError.message}</span>
                        : 'No activity yet.'}
                  </div>
                )}
                {transactions.map((tx) => {
                  const primaryHash = tx.txHashes?.[0];
                  const explorerUrl = primaryHash
                    ? getExplorerUrl(primaryHash.chainId, primaryHash.hash)
                    : null;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        tx.status === 'confirmed' ? "bg-emerald-500/10 text-emerald-400" :
                        tx.status === 'failed'    ? "bg-red-500/10 text-red-400" :
                                                    "bg-yellow-500/10 text-yellow-400"
                      )}>
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white">
                          {tx.fromAmountDisplay} {tx.fromAssetSymbol}
                          <span className="text-zinc-600 mx-1">&rarr;</span>
                          {tx.toAmountDisplay ? `${tx.toAmountDisplay} ` : ''}{tx.toAssetSymbol || ''}
                        </div>
                        <div className="text-[11px] text-zinc-600">
                          <span className="capitalize">{tx.action}</span>
                          <span className="mx-1">&middot;</span>
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-medium",
                          tx.status === 'confirmed' ? "bg-emerald-500/10 text-emerald-400" :
                          tx.status === 'failed'    ? "bg-red-500/10 text-red-400" :
                                                      "bg-yellow-500/10 text-yellow-400"
                        )}>
                          {tx.status}
                        </div>
                        {explorerUrl && (
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-zinc-600 hover:text-zinc-300 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
                {hasMoreTx && transactions.length > 0 && (
                  <button
                    onClick={loadMoreTx}
                    disabled={txLoading}
                    className="w-full mt-2 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {txLoading ? 'Loading...' : 'Load more'}
                  </button>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>

      </div>
    </div>

    {/* ── Modals ──────────────────────────────────────────────────── */}
    <CreateSmartWalletModal
      isOpen={showCreateModal}
      onClose={() => setShowCreateModal(false)}
      onSuccess={() => { refreshSmartAccounts(); setViewMode('smart'); }}
    />
    {selectedAccount && (
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => { setShowDepositModal(false); refreshSmartAssets(); }}
        smartAccountAddress={selectedAccount.address}
        smartAccountName={selectedAccount.name}
      />
    )}
    {selectedAccount && (
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => { setShowWithdrawModal(false); refreshSmartAssets(); }}
        smartAccountAddress={selectedAccount.address}
        smartAccountName={selectedAccount.name}
      />
    )}
    {selectedAccount && (
      <DeleteWalletModal
        isOpen={showDeleteModal}
        walletName={selectedAccount.name}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteWallet}
      />
    )}
    </ProtectedRoute>
  );
}
