'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from "framer-motion";
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
  ChevronLeft,
  ChevronRight,
  Clock,
  Landmark,
  Droplets,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { usePortfolioData } from "@/features/portfolio/usePortfolioData";
import { useSmartWalletPortfolio } from "@/features/portfolio/useSmartWalletPortfolio";
import { useStakingApi, type WithdrawalRequest } from "@/features/staking/api";
import { useStakingData } from "@/features/staking/useStakingData";
import { useLendingData } from "@/features/lending/useLendingData";
import { useBaseStakingData } from "@/features/staking/useBaseStakingData";
import { SmartWalletCard, SmartWalletIndicator } from "@/features/portfolio/SmartWalletCard";
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
type TabMode = 'history' | 'assets';

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

  // Base / Aerodrome Staking
  const {
    positions: basePositions,
    portfolioAssets: basePortfolioAssets,
    apr: baseApr,
    loading: baseStakingLoading,
    error: baseStakingError,
    refresh: refreshBaseStaking,
    lastFetchTime: baseStakingLastFetchTime,
  } = useBaseStakingData();

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
    void refreshBaseStaking();
  }, [refreshLendingPosition, refreshStakingWithdrawals, refreshBaseStaking, viewMode]);

  // Determine which data to show based on view mode
  const isSmartWalletView = viewMode === 'smart' && hasSmartWallet;
  const currentAssets = isSmartWalletView ? smartAssets : mainAssets;
  const currentStats = isSmartWalletView ? smartStats : mainStats;
  const currentLoading = isSmartWalletView ? smartAssetsLoading : mainLoading;

  const activeStrategiesCount = strategies.filter(s => s.isActive).length;

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
      {/* Ambient God Ray */}
      <div className={cn(
        "absolute top-0 inset-x-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] blur-3xl pointer-events-none z-0",
        isSmartWalletView
          ? "from-cyan-500/10 via-black/5 to-transparent"
          : "from-green-500/10 via-black/5 to-transparent"
      )} />

      {/* Navigation Header */}
      <div className="relative z-20 px-4 py-4 sm:p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <Link href="/chat?new=true" className="flex items-center gap-2 text-zinc-400 hover:text-white active:text-white transition-colors group">
            <div className="p-2.5 sm:p-3 min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-full bg-white/5 border border-white/10 group-hover:bg-white/10 group-active:bg-white/15 transition-colors">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="font-medium text-sm sm:text-base hidden xs:inline">Back to Chat</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
           <NotificationCenter />
           <div className="text-right hidden sm:block">
             <div className="text-xs text-zinc-500">Connected Wallet</div>
             <div className="font-mono text-sm text-white">{account ? shortenAddress(account.address) : 'Not Connected'}</div>
           </div>
           <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary to-purple-500 shadow-inner" />
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col py-6 sm:py-8 px-4 md:px-8 max-w-7xl mx-auto w-full">

        {/* Page Title & Actions */}
        <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-white">Portfolio</h1>
              {/* View Mode Toggle */}
              <SmartWalletIndicator
                hasSmartWallet={hasSmartWallet}
                isSelected={isSmartWalletView}
                onToggle={handleSmartWalletCardClick}
              />
            </div>
            <p className="text-sm sm:text-base text-zinc-400">
              {isSmartWalletView
                ? 'Track your Smart Wallet performance and DCA strategies.'
                : 'Track your performance across all chains.'
              }
            </p>
          </motion.div>

          <div className="flex items-center gap-2">
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs sm:text-sm font-medium text-white transition-colors"
            >
               {currentLoading ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Scan className="w-4 h-4 text-primary" />}
               {currentLoading ? 'Scanning...' : 'Scan Wallet'}
            </motion.button>
          </div>
        </div>

        {/* Section 1: Bento Grid Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">

          {/* Card 1: Net Worth (Large) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="md:col-span-2"
          >
            <GlassCard className={cn(
              "h-full p-6 flex flex-col justify-between transition-colors group relative overflow-hidden",
              isSmartWalletView
                ? "bg-cyan-500/5 hover:bg-cyan-500/10 border-cyan-500/20"
                : "bg-[#0A0A0A]/60 hover:bg-[#0A0A0A]/80"
            )}>
               {/* Background Chart Effect */}
               <div className="absolute right-0 bottom-0 w-2/3 h-full opacity-10 pointer-events-none">
                 <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                    <path d="M0,100 C50,80 100,90 150,40 L200,20 L200,100 Z" fill={isSmartWalletView ? "url(#gradient-cyan)" : "url(#gradient-green)"} />
                    <defs>
                      <linearGradient id="gradient-green" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="gradient-cyan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                 </svg>
               </div>

              <div className="flex items-start justify-between relative z-10">
                <div className={cn(
                  "p-2 rounded-lg",
                  isSmartWalletView ? "bg-cyan-500/10 text-cyan-400" : "bg-green-500/10 text-green-400"
                )}>
                  <Wallet className="w-5 h-5" />
                </div>
                {isSmartWalletView && selectedAccount && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-mono">{shortenAddress(selectedAccount.address)}</span>
                    {activeStrategiesCount > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-cyan-500/10 rounded-full text-cyan-400">
                        <Zap className="w-3 h-3" />
                        <span>{activeStrategiesCount} DCA Active</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="relative z-10">
                <div className="text-zinc-400 text-sm mb-1">
                  {isSmartWalletView ? 'Smart Wallet Balance' : 'Total Balance'}
                </div>
                <div className="text-4xl md:text-5xl font-bold font-display text-white tracking-tight">
                  {currentStats.netWorth}
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Card 2: Smart Wallet Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
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
          </motion.div>
	        </div>

        {/* Positions (Staking + Lending) */}
        {!isSmartWalletView && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.23 }}
            className="mb-12"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-medium text-white">Positions</h3>
                <div className="text-xs text-zinc-500">
                  Last updated: {formatLastUpdated(Math.max(stakingLastUpdated, lendingLastFetchTime || 0))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  void refreshStaking();
                  void refreshStakingWithdrawals(true);
                  void refreshLendingPosition();
                  void refreshBaseStaking();
                }}
                className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors disabled:opacity-60"
                disabled={stakingLoading || stakingWithdrawalsLoading || lendingLoading || baseStakingLoading}
              >
                {(stakingLoading || stakingWithdrawalsLoading || lendingLoading || baseStakingLoading) ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Scan className="w-3.5 h-3.5" />
                )}
                Refresh
              </button>
            </div>

            {/* ═══════════ Liquid Staking ═══════════ */}
            {(() => {
              const stakingCards = [
                { id: 'aerodrome', name: 'Aerodrome', chain: 'Base', logo: 'https://assets.coingecko.com/coins/images/31745/small/token.png', chainLogo: 'https://assets.coingecko.com/asset_platforms/images/131/small/base.png', href: '/chat?open=staking', color: 'blue' as const },
                { id: 'lido', name: 'Lido', chain: 'Ethereum', logo: 'https://assets.coingecko.com/coins/images/13442/small/steth_logo.png', chainLogo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png', href: '/chat?open=staking', color: 'sky' as const },
              ];
              const total = stakingCards.length;
              const idx = stakingSlide % total;
              const card = stakingCards[idx];

              return (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-sky-400" />
                      <h4 className="text-sm font-medium text-white">Liquid Staking</h4>
                    </div>
                    {total > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => setStakingSlide((idx - 1 + total) % total)} className="p-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-colors">
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex gap-1">
                          {stakingCards.map((_, i) => (
                            <button key={i} type="button" onClick={() => setStakingSlide(i)} className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === idx ? "bg-sky-400" : "bg-white/20 hover:bg-white/30")} />
                          ))}
                        </div>
                        <button type="button" onClick={() => setStakingSlide((idx + 1) % total)} className="p-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-colors">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <GlassCard className="p-5 bg-[#0A0A0A]/60">
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <img src={card.logo} alt={card.name} className="w-9 h-9 rounded-lg" />
                          <img src={card.chainLogo} alt={card.chain} className="w-4 h-4 rounded-full absolute -bottom-1 -right-1 ring-2 ring-[#0A0A0A]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-white font-medium truncate">{card.name}</div>
                          <div className="text-xs text-zinc-500">{card.chain}</div>
                        </div>
                      </div>

                      {card.id === 'lido' && (
                        <div className={cn(
                          "text-[11px] px-2 py-1 rounded-lg border shrink-0",
                          stakingClaimable.count > 0
                            ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                            : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                        )}>
                          {stakingClaimable.count > 0 ? `${stakingClaimable.count} Claimable` : stakingPending.count > 0 ? `${stakingPending.count} Pending` : 'Active'}
                        </div>
                      )}
                      {card.id === 'aerodrome' && (
                        basePositions.length > 0 ? (
                          <div className="text-[11px] px-2 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shrink-0">{basePositions.length} Active</div>
                        ) : (
                          <div className="text-[11px] px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-zinc-500 shrink-0">No positions</div>
                        )
                      )}
                    </div>

                    {/* ── Lido content ── */}
                    {card.id === 'lido' && (
                      <>
                        <div className="mt-4">
                          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-3">
                            <div className="flex items-center gap-2">
                              <Droplets className="w-3.5 h-3.5 text-sky-400" />
                              <span className="text-xs font-medium text-white">Liquid Staking</span>
                              <span className={cn("text-xs font-medium ml-auto", Number.isFinite(lidoApy) ? "text-emerald-400" : "text-zinc-500")}>
                                {Number.isFinite(lidoApy) ? `${lidoApy!.toFixed(2)}% APY` : ''}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-md bg-white/[0.03] px-2.5 py-2">
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">stETH</div>
                                <div className="text-sm font-mono text-white mt-0.5">{formatWei(stakingPosition?.stETHBalance)}</div>
                              </div>
                              <div className="rounded-md bg-white/[0.03] px-2.5 py-2">
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">wstETH</div>
                                <div className="text-sm font-mono text-white mt-0.5">{formatWei(stakingPosition?.wstETHBalance)}</div>
                              </div>
                            </div>
                            {stakingPending.count > 0 && (
                              <div className="flex items-center justify-between px-0.5">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Pending Withdrawals</span>
                                <span className="text-xs font-mono text-amber-400">{stakingPending.count}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {(stakingError || stakingWithdrawalsError) && <div className="mt-3 text-xs text-red-400">{stakingError || stakingWithdrawalsError}</div>}
                      </>
                    )}

                    {/* ── Aerodrome content ── */}
                    {card.id === 'aerodrome' && (
                      <>
                        {basePositions.length > 0 && (
                          <div className="mt-4 space-y-3">
                            {basePositions.map((pos) => {
                              const portfolio = basePortfolioAssets.find((a) => a.poolId === pos.poolId);
                              const tokenABal = portfolio ? parseFloat(portfolio.tokenA.balance) : 0;
                              const tokenBBal = portfolio ? parseFloat(portfolio.tokenB.balance) : 0;
                              // Use position earnedRewards (raw wei) or fall back to portfolio pendingRewards (formatted)
                              const rewardsBig = safeParseBigInt(pos.earnedRewards);
                              const hasRewardsFromPosition = rewardsBig != null && rewardsBig > 0n;
                              const portfolioRewards = portfolio ? parseFloat(portfolio.pendingRewards) : 0;
                              const hasRewards = hasRewardsFromPosition || portfolioRewards > 0;
                              const rewardsLabel = hasRewardsFromPosition
                                ? `${formatWei(pos.earnedRewards, pos.rewardToken.decimals)} ${pos.rewardToken.symbol}`
                                : portfolioRewards > 0
                                  ? `${portfolioRewards.toFixed(portfolioRewards < 0.001 ? 6 : 4)} ${portfolio!.rewardTokenSymbol}`
                                  : '';
                              const poolTokens = pos.poolName.match(/^(\w+)\/(\w+)/);
                              const tA = poolTokens?.[1] ?? pos.tokenA.symbol;
                              const tB = poolTokens?.[2] ?? pos.tokenB.symbol;
                              return (
                                <div key={pos.poolId} className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Droplets className="w-3.5 h-3.5 text-blue-400" />
                                      <span className="text-xs font-medium text-white">{pos.poolName}</span>
                                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", pos.stable ? "text-cyan-400 border-cyan-500/20 bg-cyan-500/5" : "text-amber-400 border-amber-500/20 bg-amber-500/5")}>{pos.stable ? 'Stable' : 'Volatile'}</span>
                                    </div>
                                    <span className={cn("text-xs font-medium", Number.isFinite(baseApr) && baseApr! > 0 ? "text-emerald-400" : "text-zinc-500")}>
                                      {Number.isFinite(baseApr) && baseApr! > 0 ? `${baseApr!.toFixed(2)}% APR` : ''}
                                    </span>
                                  </div>
                                  {tokenABal > 0 || tokenBBal > 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="rounded-md bg-white/[0.03] px-2.5 py-2">
                                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{tA}</div>
                                        <div className="text-sm font-mono text-white mt-0.5">{tokenABal.toFixed(tokenABal < 0.01 ? 6 : 4)}</div>
                                      </div>
                                      <div className="rounded-md bg-white/[0.03] px-2.5 py-2">
                                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{tB}</div>
                                        <div className="text-sm font-mono text-white mt-0.5">{tokenBBal.toFixed(tokenBBal < 0.01 ? 6 : 2)}</div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-zinc-500">Staked LP</span>
                                      <span className="text-sm font-mono text-white">{formatWei(pos.stakedBalance)}</span>
                                    </div>
                                  )}
                                  {hasRewards && (
                                    <div className="flex items-center justify-between px-0.5">
                                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Pending Rewards</span>
                                      <span className="text-xs font-mono text-amber-400">{rewardsLabel}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {basePositions.length === 0 && !baseStakingLoading && (
                          <div className="mt-4 text-center py-3">
                            <p className="text-xs text-zinc-500">No active liquidity positions</p>
                            <p className="text-[10px] text-zinc-600 mt-1">Stake in a pool to start earning AERO rewards</p>
                          </div>
                        )}
                        {baseStakingLoading && basePositions.length === 0 && (
                          <div className="mt-4 flex items-center justify-center gap-2 py-3 text-zinc-500 text-xs">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Loading...
                          </div>
                        )}
                        {baseStakingError && <div className="mt-3 text-xs text-red-400">{baseStakingError}</div>}
                      </>
                    )}

                    {/* Manage button */}
                    <div className="mt-4">
                      <Link
                        href={card.href}
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-colors",
                          card.color === 'sky' && "bg-sky-500/10 hover:bg-sky-500/15 border-sky-500/20 text-sky-400",
                          card.color === 'blue' && "bg-blue-500/10 hover:bg-blue-500/15 border-blue-500/20 text-blue-400",
                        )}
                      >
                        Manage Position <Droplets className="w-3 h-3" />
                      </Link>
                    </div>
                  </GlassCard>
                </div>
              );
            })()}

            {/* ═══════════ Lending ═══════════ */}
            {(() => {
              const lendingCards = [
                { id: 'benqi', name: 'Benqi', chain: 'Avalanche', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/9288.png', chainLogo: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png', href: '/chat?open=lending', color: 'emerald' as const },
              ];
              const total = lendingCards.length;
              const idx = lendingSlide % total;
              const card = lendingCards[idx];

              return (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-medium text-white">Lending</h4>
                    </div>
                    {total > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => setLendingSlide((idx - 1 + total) % total)} className="p-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-colors">
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex gap-1">
                          {lendingCards.map((_, i) => (
                            <button key={i} type="button" onClick={() => setLendingSlide(i)} className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === idx ? "bg-emerald-400" : "bg-white/20 hover:bg-white/30")} />
                          ))}
                        </div>
                        <button type="button" onClick={() => setLendingSlide((idx + 1) % total)} className="p-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-colors">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <GlassCard className="p-5 bg-[#0A0A0A]/60">
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <img src={card.logo} alt={card.name} className="w-9 h-9 rounded-lg" />
                          <img src={card.chainLogo} alt={card.chain} className="w-4 h-4 rounded-full absolute -bottom-1 -right-1 ring-2 ring-[#0A0A0A]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-white font-medium truncate">{card.name}</div>
                          <div className="text-xs text-zinc-500">{card.chain}</div>
                        </div>
                      </div>

                      {card.id === 'benqi' && (
                        <div className={cn(
                          "text-[11px] px-2 py-1 rounded-lg border shrink-0",
                          lendingHealthLabel.tone === 'green' && "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                          lendingHealthLabel.tone === 'yellow' && "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
                          lendingHealthLabel.tone === 'red' && "text-red-400 border-red-500/30 bg-red-500/10",
                          lendingHealthLabel.tone === 'zinc' && "text-zinc-400 border-white/10 bg-white/5",
                        )}>
                          {lendingHealthLabel.text}
                        </div>
                      )}
                    </div>

                    {/* ── Benqi content ── */}
                    {card.id === 'benqi' && (
                      <>
                        <div className="mt-4">
                          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-3">
                            <div className="flex items-center gap-2">
                              <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-xs font-medium text-white">Lending</span>
                              <span className={cn("text-xs font-medium ml-auto", Number.isFinite(lendingPositionApy) ? "text-emerald-400" : "text-zinc-500")}>
                                {Number.isFinite(lendingPositionApy) ? `${lendingPositionApy!.toFixed(2)}% APY` : ''}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-md bg-white/[0.03] px-2.5 py-2">
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Supplied</div>
                                <div className="text-sm font-mono text-white mt-0.5">
                                  {lendingSuppliedRows.length === 0 ? '0' : lendingSuppliedRows.slice(0, 2).map((r) => `${r.amount} ${r.symbol}`).join(', ')}
                                  {lendingSuppliedRows.length > 2 ? ` +${lendingSuppliedRows.length - 2}` : ''}
                                </div>
                              </div>
                              <div className="rounded-md bg-white/[0.03] px-2.5 py-2">
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Borrowed</div>
                                <div className="text-sm font-mono text-white mt-0.5">
                                  {lendingBorrowedRows.length === 0 ? '0' : lendingBorrowedRows.slice(0, 2).map((r) => `${r.amount} ${r.symbol}`).join(', ')}
                                  {lendingBorrowedRows.length > 2 ? ` +${lendingBorrowedRows.length - 2}` : ''}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between px-0.5">
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
                        </div>
                        {lendingError && <div className="mt-3 text-xs text-red-400">{lendingError}</div>}
                      </>
                    )}

                    {/* Manage button */}
                    <div className="mt-4">
                      <Link
                        href={card.href}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 transition-colors"
                      >
                        Manage Position <Landmark className="w-3 h-3" />
                      </Link>
                    </div>
                  </GlassCard>
                </div>
              );
            })()}
          </motion.div>
        )}

        {/* DCA Strategies Section (only when viewing Smart Wallet) */}
        {isSmartWalletView && strategies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-12"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                DCA Strategies
              </h3>
              <span className="text-xs text-zinc-500">
                {strategies.filter(s => s.isActive).length} active / {strategies.length} total
              </span>
            </div>
            <div className="space-y-3">
              {strategies.map((strategy, i) => {
                const isExpanded = expandedStrategy === strategy.strategyId;
                const isLoading = strategyActionLoading === strategy.strategyId;
                const fromSymbol = getTokenSymbol(strategy.fromToken);
                const toSymbol = getTokenSymbol(strategy.toToken);

                return (
                  <GlassCard
                    key={strategy.strategyId || i}
                    className={cn(
                      "p-4 bg-[#0A0A0A]/60 transition-all",
                      isExpanded && "ring-1 ring-cyan-500/30"
                    )}
                  >
                    {/* Main Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        {/* Token Icons */}
                        <div className="relative flex-shrink-0">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-[10px] sm:text-xs font-bold text-cyan-400 border border-cyan-500/20">
                            {fromSymbol.slice(0, 2)}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#0A0A0A] flex items-center justify-center">
                            <ArrowRightLeft className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-zinc-500" />
                          </div>
                        </div>

                        {/* Strategy Info */}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-medium text-white flex items-center gap-1 sm:gap-2 truncate">
                            {strategy.amount} {fromSymbol} → {toSymbol}
                          </div>
                          <div className="text-[10px] sm:text-xs text-zinc-500 flex items-center gap-1 sm:gap-2 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span className="capitalize">{strategy.interval}</span>
                            </span>
                            <span className="text-zinc-600 hidden sm:inline">•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span className="hidden sm:inline">Next: </span>
                              <span>{new Date(strategy.nextExecution * 1000).toLocaleDateString()}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        {/* Status Badge */}
                        <div className={cn(
                          "px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-medium border",
                          strategy.isActive
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
                        )}>
                          {strategy.isActive ? 'Active' : 'Paused'}
                        </div>

                        {/* Expand Button */}
                        <button
                          onClick={() => setExpandedStrategy(isExpanded ? null : strategy.strategyId || null)}
                          className="p-1.5 sm:p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-white/5"
                      >
                        {/* Details Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <div className="text-[10px] text-zinc-500 uppercase mb-1">From Token</div>
                            <div className="text-sm text-white font-mono">{fromSymbol}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-500 uppercase mb-1">To Token</div>
                            <div className="text-sm text-white font-mono">{toSymbol}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-500 uppercase mb-1">Amount</div>
                            <div className="text-sm text-white">{strategy.amount} {fromSymbol}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-500 uppercase mb-1">Frequency</div>
                            <div className="text-sm text-white capitalize">{strategy.interval}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-500 uppercase mb-1">Last Executed</div>
                            <div className="text-sm text-white">
                              {strategy.lastExecuted > 0
                                ? new Date(strategy.lastExecuted * 1000).toLocaleDateString()
                                : 'Never'
                              }
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-500 uppercase mb-1">Next Execution</div>
                            <div className="text-sm text-white">
                              {new Date(strategy.nextExecution * 1000).toLocaleDateString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-500 uppercase mb-1">Chain</div>
                            <div className="text-sm text-white">
                              {strategy.fromChainId === 1 ? 'Ethereum' : `Chain ${strategy.fromChainId}`}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-500 uppercase mb-1">Status</div>
                            <div className={cn(
                              "text-sm",
                              strategy.isActive ? "text-emerald-400" : "text-zinc-400"
                            )}>
                              {strategy.isActive ? 'Active' : 'Paused'}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          {/* Pause/Resume Button */}
                          <button
                            onClick={() => handleToggleStrategy(strategy)}
                            disabled={isLoading}
                            className={cn(
                              "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors",
                              strategy.isActive
                                ? "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20"
                                : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20",
                              isLoading && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {isLoading ? (
                              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                            ) : strategy.isActive ? (
                              <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            ) : (
                              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            )}
                            {strategy.isActive ? 'Pause' : 'Resume'}
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteStrategy(strategy)}
                            disabled={isLoading}
                            className={cn(
                              "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs sm:text-sm font-medium transition-colors",
                              isLoading && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {isLoading ? (
                              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            )}
                            Delete
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Allocation Bar */}
        {currentStats.allocation.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <div className="h-4 w-full rounded-full flex overflow-hidden bg-white/5">
              {currentStats.allocation.map(item => (
                <div
                  key={item.label}
                  className={cn("h-full transition-all duration-500", item.color)}
                  style={{ width: `${item.value}%` }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-4 mt-2">
              {currentStats.allocation.map(item => (
                <div key={item.label} className="flex items-center gap-1.5 sm:gap-2">
                  <div className={cn("w-2 h-2 rounded-full", item.color)} />
                  <span className="text-xs text-zinc-400">{item.label} ({item.value.toFixed(0)}%)</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Tabs: History / Assets */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {/* Tab Switcher */}
          <div className="flex gap-1 mb-4 bg-white/5 rounded-xl p-1 w-fit">
            <button
              onClick={() => setActiveTab('assets')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === 'assets'
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Assets
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === 'history'
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              History
            </button>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Wallet Balances</h2>
          </div>

          {/* Tab Content */}
          {activeTab === 'history' && (
            <div>
              {txLoading && transactions.length === 0 && (
                <div className="py-8 text-center text-zinc-600 text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              )}

              {!txLoading && transactions.length === 0 && (
                <div className="py-8 text-center text-zinc-600 text-sm">
                  {isGatewayHistoryUnavailable
                    ? 'History unavailable (gateway offline).'
                    : txError
                      ? <span className="text-red-400/70">{txError.message}</span>
                      : 'No activity yet.'}
                </div>
              )}

              <div className="space-y-1">
                {transactions.map((tx) => {
                  const primaryHash = tx.txHashes?.[0];
                  const explorerUrl = primaryHash
                    ? getExplorerUrl(primaryHash.chainId, primaryHash.hash)
                    : null;
                  return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors"
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      tx.status === 'confirmed' ? "bg-emerald-500/10 text-emerald-400" :
                      tx.status === 'failed' ? "bg-red-500/10 text-red-400" :
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
                        tx.status === 'failed' ? "bg-red-500/10 text-red-400" :
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
              </div>

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

          {activeTab === 'assets' && (
            <div>
              {currentAssets.length === 0 && !currentLoading && (
                <div className="py-8 text-center text-zinc-600 text-sm">
                  {isSmartWalletView ? 'No assets in Smart Wallet.' : account ? 'No assets found.' : 'Connect wallet.'}
                </div>
              )}
              {currentLoading && currentAssets.length === 0 && (
                <div className="py-8 text-center text-zinc-600 text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Scanning...
                </div>
              )}

              <div className="space-y-1">
                {currentAssets.map((asset) => (
                  <div key={`${asset.network}-${asset.symbol}-${asset.address}`}>
                  <div className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex-shrink-0">
                      {asset.icon ? (
                        <img src={asset.icon} alt={asset.symbol} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        asset.symbol[0]
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-white font-medium">{asset.symbol}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-zinc-500">{asset.network}</span>
                      </div>
                      <span className="text-xs text-zinc-500 font-mono">{asset.balance}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm text-white font-mono">{asset.value}</div>
                      <div className="text-[10px] text-zinc-600 font-mono">{asset.price}</div>
                    </div>
                  </div>
                  {/* Protocol badge */}
                  <div className="flex items-center gap-1 mt-0.5 pl-11">
                    {asset.protocol === 'Wallet' && <Wallet className="w-3 h-3 text-zinc-600" />}
                    {asset.protocol === 'Smart Wallet' && <Zap className="w-3 h-3 text-cyan-500/70" />}
                    {asset.protocol === 'Lido' && <Droplets className="w-3 h-3 text-blue-400/70" />}
                    <span className="text-[10px] text-zinc-600">
                      {asset.protocol}
                      {asset.protocol === 'Lido' && <span> · {formatAPY(lidoApy)}</span>}
                    </span>
                  </div>
                  </div>
                  ))}
              </div>

          {/* Desktop Table View */}
          <GlassCard className="overflow-hidden bg-[#0A0A0A]/60 hidden md:block mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-zinc-500 uppercase tracking-wider">
                    <th className="p-4 font-medium">Asset</th>
                    <th className="p-4 font-medium">Protocol</th>
                    <th className="p-4 font-medium">Balance</th>
                    <th className="p-4 font-medium">Value</th>
                    <th className="p-4 font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {currentAssets.map((asset) => (
                    <tr key={`desktop-${asset.network}-${asset.symbol}-${asset.address}`} className="group hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-inner",
                            "bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10"
                          )}>
                            {asset.icon ? (
                              <img src={asset.icon} alt={asset.symbol} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              asset.symbol[0]
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-white">{asset.name}</div>
                            <div className="flex items-center gap-1.5">
                               <span className="text-xs text-zinc-500">{asset.symbol}</span>
                               <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/5">{asset.network}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-zinc-400 text-sm">
                        <div className="flex items-center gap-2">
                          {asset.protocol === 'Wallet' && <Wallet className="w-3 h-3" />}
                          {asset.protocol === 'Smart Wallet' && <Zap className="w-3 h-3 text-cyan-400" />}
                          {asset.protocol === 'Lido' && <Droplets className="w-3 h-3 text-blue-400" />}
                          <span>
                            {asset.protocol}
                            {asset.protocol === 'Lido' && (
                              <span className="text-zinc-500"> · {formatAPY(lidoApy)}</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-zinc-300 font-mono text-sm">{asset.balance}</td>
                      <td className="p-4 text-white font-mono font-medium text-sm">{asset.value}</td>
                      <td className="p-4 text-zinc-500 font-mono text-sm">{asset.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
            </div>
          )}
        </motion.div>

      </div>
    </div>

    {/* Create Smart Wallet Modal */}
    <CreateSmartWalletModal
      isOpen={showCreateModal}
      onClose={() => setShowCreateModal(false)}
      onSuccess={() => {
        refreshSmartAccounts();
        setViewMode('smart');
      }}
    />

    {/* Deposit Modal */}
    {selectedAccount && (
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => {
          setShowDepositModal(false);
          refreshSmartAssets();
        }}
        smartAccountAddress={selectedAccount.address}
        smartAccountName={selectedAccount.name}
      />
    )}

    {/* Withdraw Modal */}
    {selectedAccount && (
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => {
          setShowWithdrawModal(false);
          refreshSmartAssets();
        }}
        smartAccountAddress={selectedAccount.address}
        smartAccountName={selectedAccount.name}
      />
    )}

    {/* Delete Wallet Modal */}
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
