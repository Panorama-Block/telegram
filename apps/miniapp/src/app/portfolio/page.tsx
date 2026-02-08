'use client';

import { useMemo, useState } from 'react';
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
  Clock,
  Droplets,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { usePortfolioData } from "@/features/portfolio/usePortfolioData";
import { useSmartWalletPortfolio } from "@/features/portfolio/useSmartWalletPortfolio";
import { useStakingData } from "@/features/staking/useStakingData";
import { SmartWalletCard, SmartWalletIndicator } from "@/features/portfolio/SmartWalletCard";
import { CreateSmartWalletModal } from "@/features/portfolio/CreateSmartWalletModal";
import { DeleteWalletModal } from "@/features/portfolio/DeleteWalletModal";
import DepositModal from "@/features/dca/DepositModal";
import WithdrawModal from "@/features/dca/WithdrawModal";
import { deleteSmartAccount, deleteStrategy, toggleStrategy, DCAStrategy } from "@/features/dca/api";
import { useActiveAccount } from "thirdweb/react";
import { shortenAddress } from "thirdweb/utils";

type ViewMode = 'main' | 'smart';

function formatAPY(apy: number | null | undefined): string {
  if (apy == null || !Number.isFinite(apy)) return '--';
  return `${apy.toFixed(4)}%`;
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

  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // DCA Strategy management
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
  const [strategyActionLoading, setStrategyActionLoading] = useState<string | null>(null);

  const { tokens: stakingTokens } = useStakingData();
  const lidoApy = useMemo(() => {
    const eth = stakingTokens.find((t) => t.symbol === 'ETH') || stakingTokens.find((t) => t.symbol === 'stETH');
    return eth?.stakingAPY ?? null;
  }, [stakingTokens]);

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

        {/* Section 2: Allocation Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
             <h3 className="text-lg font-medium text-white">Allocation</h3>
             <div className="flex flex-wrap gap-2 sm:gap-4 text-xs">
                {currentStats.allocation.map(item => (
                   <div key={item.label} className="flex items-center gap-1.5 sm:gap-2">
                      <div className={cn("w-2 h-2 rounded-full", item.color)} />
                      <span className="text-zinc-400">{item.label} ({item.value.toFixed(0)}%)</span>
                   </div>
                ))}
             </div>
          </div>
          <div className="h-4 w-full rounded-full flex overflow-hidden bg-white/5">
             {currentStats.allocation.map(item => (
                <div
                   key={item.label}
                   className={cn("h-full transition-all duration-500", item.color)}
                   style={{ width: `${item.value}%` }}
                />
             ))}
          </div>
        </motion.div>

        {/* Section 3: Detailed Positions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Active Positions</h2>
          </div>

          {/* Empty/Loading States */}
          {currentAssets.length === 0 && !currentLoading && (
            <GlassCard className="p-8 text-center text-zinc-500 text-sm bg-[#0A0A0A]/60">
              {isSmartWalletView
                ? 'No assets in Smart Wallet. Deposit funds to get started.'
                : account
                  ? 'No assets found. Try creating a wallet or bridging funds.'
                  : 'Connect wallet to view portfolio.'
              }
              {isSmartWalletView && selectedAccount && (
                <button
                  onClick={() => setShowDepositModal(true)}
                  className="block mt-4 mx-auto text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Deposit Funds
                </button>
              )}
            </GlassCard>
          )}
          {currentLoading && currentAssets.length === 0 && (
            <GlassCard className="p-8 text-center text-zinc-500 text-sm bg-[#0A0A0A]/60">
              Scanning blockchain...
            </GlassCard>
          )}

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {currentAssets.map((asset) => (
              <GlassCard
                key={`mobile-${asset.network}-${asset.symbol}-${asset.address}`}
                className="p-4 bg-[#0A0A0A]/60"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-inner",
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
                  <div className="text-right">
                    <div className="text-white font-mono font-semibold">{asset.value}</div>
                    <div className="text-xs text-zinc-500">{asset.price}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
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
                  <div className="text-zinc-300 font-mono text-sm">{asset.balance}</div>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Desktop Table View */}
          <GlassCard className="overflow-hidden bg-[#0A0A0A]/60 hidden md:block">
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
