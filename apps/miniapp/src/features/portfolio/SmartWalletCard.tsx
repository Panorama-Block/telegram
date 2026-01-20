/**
 * Smart Wallet Card Component
 * Displays in the Portfolio Analytics header when user has a Smart Wallet
 * Includes actions: Deposit, Withdraw, Delete, Create New
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { SmartAccount } from '@/features/dca/api';
import {
  Wallet,
  Plus,
  Zap,
  ChevronRight,
  Loader2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Trash2,
  MoreVertical,
  ChevronDown
} from 'lucide-react';
import { shortenAddress } from 'thirdweb/utils';

interface SmartWalletCardProps {
  smartAccount: SmartAccount | null;
  smartAccounts: SmartAccount[];
  hasSmartWallet: boolean;
  loading: boolean;
  isSelected: boolean;
  balance?: string;
  activeStrategies?: number;
  onSelect: () => void;
  onCreateWallet: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onDelete: () => void;
  onSelectAccount: (account: SmartAccount) => void;
}

export function SmartWalletCard({
  smartAccount,
  smartAccounts,
  hasSmartWallet,
  loading,
  isSelected,
  balance = '$0.00',
  activeStrategies = 0,
  onSelect,
  onCreateWallet,
  onDeposit,
  onWithdraw,
  onDelete,
  onSelectAccount,
}: SmartWalletCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showAccountSelector, setShowAccountSelector] = useState(false);

  // Loading state
  if (loading) {
    return (
      <GlassCard className="h-full p-6 flex flex-col justify-center bg-[#0A0A0A]/60 relative overflow-hidden">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
          <span className="text-sm text-zinc-400">Loading Smart Wallet...</span>
        </div>
      </GlassCard>
    );
  }

  // No Smart Wallet - Show create button
  if (!hasSmartWallet) {
    return (
      <GlassCard
        className="h-full p-6 flex flex-col justify-center bg-[#0A0A0A]/60 relative overflow-hidden group hover:bg-[#0A0A0A]/80 transition-colors cursor-pointer"
        onClick={onCreateWallet}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="relative z-10">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-white mb-1">Create Smart Wallet</div>
              <div className="text-xs text-zinc-500">Enable automated DCA strategies</div>
            </div>
            <div className="flex items-center gap-1 text-xs text-cyan-400 group-hover:gap-2 transition-all">
              <span>Get Started</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  // Has Smart Wallet - Show wallet card with actions
  return (
    <GlassCard
      className={`h-full p-4 flex flex-col justify-between transition-all relative overflow-hidden ${
        isSelected
          ? 'bg-cyan-500/10 border-cyan-500/30'
          : 'bg-[#0A0A0A]/60 hover:bg-[#0A0A0A]/80'
      }`}
    >
      {/* Header with wallet selector and menu */}
      <div className="flex items-start justify-between mb-2">
        {/* Wallet selector dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowAccountSelector(!showAccountSelector)}
            className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-cyan-500/20' : 'bg-cyan-500/10'} text-cyan-400`}>
              <Wallet className="w-3 h-3" />
            </div>
            <span className="font-medium">{smartAccount?.name || 'Smart Wallet'}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showAccountSelector ? 'rotate-180' : ''}`} />
          </button>

          {/* Account selector dropdown */}
          <AnimatePresence>
            {showAccountSelector && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute top-full left-0 mt-2 w-48 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden"
              >
                {smartAccounts.map((acc) => (
                  <button
                    key={acc.address}
                    onClick={() => {
                      onSelectAccount(acc);
                      setShowAccountSelector(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors flex items-center justify-between ${
                      smartAccount?.address === acc.address ? 'bg-cyan-500/10 text-cyan-400' : 'text-zinc-300'
                    }`}
                  >
                    <span className="truncate">{acc.name}</span>
                    <span className="text-zinc-500 font-mono">{shortenAddress(acc.address)}</span>
                  </button>
                ))}
                <div className="border-t border-white/5">
                  <button
                    onClick={() => {
                      onCreateWallet();
                      setShowAccountSelector(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-cyan-400 hover:bg-cyan-500/10 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-3 h-3" />
                    Create New Wallet
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 w-40 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden"
                >
                  <button
                    onClick={() => {
                      onDeposit();
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2.5 text-left text-xs text-zinc-300 hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                    Deposit
                  </button>
                  <button
                    onClick={() => {
                      onWithdraw();
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2.5 text-left text-xs text-zinc-300 hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <ArrowUpFromLine className="w-3.5 h-3.5 text-orange-400" />
                    Withdraw
                  </button>
                  <div className="border-t border-white/5">
                    <button
                      onClick={() => {
                        onDelete();
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Wallet
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Balance */}
      <div
        className="cursor-pointer flex-1 flex flex-col justify-center"
        onClick={onSelect}
      >
        <div className="text-2xl font-bold font-display text-white mb-1">
          {balance}
        </div>

        {smartAccount && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="font-mono">{shortenAddress(smartAccount.address)}</span>
            {activeStrategies > 0 && (
              <>
                <span className="text-zinc-600">|</span>
                <div className="flex items-center gap-1 text-cyan-400">
                  <Zap className="w-3 h-3" />
                  <span>{activeStrategies} active</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Quick action buttons */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={onDeposit}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-medium transition-colors"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Deposit
        </button>
        <button
          onClick={onWithdraw}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 text-xs font-medium transition-colors"
        >
          <ArrowUpFromLine className="w-3.5 h-3.5" />
          Withdraw
        </button>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-2 right-12"
        >
          <div className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-[10px] font-medium text-cyan-400">
            Viewing
          </div>
        </motion.div>
      )}
    </GlassCard>
  );
}

/**
 * Compact Smart Wallet indicator for mobile view
 */
export function SmartWalletIndicator({
  hasSmartWallet,
  isSelected,
  onToggle,
}: {
  hasSmartWallet: boolean;
  isSelected: boolean;
  onToggle: () => void;
}) {
  if (!hasSmartWallet) return null;

  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        isSelected
          ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400'
          : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white'
      }`}
    >
      <Wallet className="w-3 h-3" />
      <span>{isSelected ? 'Smart Wallet' : 'Main Wallet'}</span>
    </button>
  );
}
