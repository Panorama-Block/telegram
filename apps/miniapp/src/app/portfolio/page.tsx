'use client';

import { useState } from 'react';
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  ArrowUpRight,
  Wallet,
  ArrowLeft,
  Scan,
  Loader2,
  Zap
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { usePortfolioData } from "@/features/portfolio/usePortfolioData";
import { useSmartWalletPortfolio } from "@/features/portfolio/useSmartWalletPortfolio";
import { SmartWalletCard, SmartWalletIndicator } from "@/features/portfolio/SmartWalletCard";
import { CreateSmartWalletModal } from "@/features/portfolio/CreateSmartWalletModal";
import DepositModal from "@/features/dca/DepositModal";
import WithdrawModal from "@/features/dca/WithdrawModal";
import { deleteSmartAccount } from "@/features/dca/api";
import { useActiveAccount } from "thirdweb/react";
import { shortenAddress } from "thirdweb/utils";

type ViewMode = 'main' | 'smart';

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
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteWallet = async () => {
    if (!selectedAccount || !account?.address) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${selectedAccount.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

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

  return (
    <ProtectedRoute>
    <div className="min-h-[100dvh] bg-[#050505] relative overflow-x-hidden flex flex-col text-foreground font-sans">
      {/* Ambient God Ray */}
      <div className={cn(
        "absolute top-0 inset-x-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] blur-3xl pointer-events-none z-0",
        isSmartWalletView
          ? "from-cyan-500/10 via-black/5 to-transparent"
          : "from-green-500/10 via-black/5 to-transparent"
      )} />

      {/* Navigation Header */}
      <div className="relative z-20 p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <Link href="/chat?new=true" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group">
            <div className="p-2 rounded-full bg-white/5 border border-white/10 group-hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </div>
            <span className="font-medium">Back to Chat</span>
        </Link>
        <div className="flex items-center gap-3">
           <NotificationCenter />
           <div className="text-right hidden sm:block">
             <div className="text-xs text-zinc-500">Connected Wallet</div>
             <div className="font-mono text-sm text-white">{account ? shortenAddress(account.address) : 'Not Connected'}</div>
           </div>
           <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-500 shadow-inner" />
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col py-8 px-4 md:px-8 max-w-7xl mx-auto w-full">

        {/* Page Title & Actions */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl md:text-4xl font-display font-bold text-white">Portfolio Analytics</h1>
              {/* View Mode Toggle */}
              <SmartWalletIndicator
                hasSmartWallet={hasSmartWallet}
                isSelected={isSmartWalletView}
                onToggle={handleSmartWalletCardClick}
              />
            </div>
            <p className="text-zinc-400">
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
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-colors"
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
                Active DCA Strategies
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {strategies.filter(s => s.isActive).slice(0, 3).map((strategy, i) => (
                <GlassCard key={strategy.strategyId || i} className="p-4 bg-[#0A0A0A]/60">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-xs font-bold text-cyan-400">
                        {strategy.fromToken.slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {strategy.amount} ETH
                        </div>
                        <div className="text-xs text-zinc-500 capitalize">
                          {strategy.interval}
                        </div>
                      </div>
                    </div>
                    <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-medium text-emerald-400">
                      Active
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">
                    Next: {new Date(strategy.nextExecution).toLocaleDateString()}
                  </div>
                </GlassCard>
              ))}
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
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-medium text-white">Allocation</h3>
             <div className="flex gap-4 text-xs">
                {currentStats.allocation.map(item => (
                   <div key={item.label} className="flex items-center gap-2">
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
                    <Wallet className="w-3 h-3" />
                    <span>{asset.protocol}</span>
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
                          {asset.protocol}
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
    </ProtectedRoute>
  );
}
