/**
 * Create Smart Wallet Modal
 * Styled to match Portfolio Analytics page aesthetics
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  Wallet,
  X,
  Zap,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';
import { createSmartAccount, CreateAccountRequest, DCAApiError } from '@/features/dca/api';
import { useActiveAccount } from 'thirdweb/react';
import { cn } from '@/lib/utils';

interface CreateSmartWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface SmartWalletConfig {
  name: string;
  approvedTargets: string[];
  nativeTokenLimit: string;
  durationDays: number;
}

export function CreateSmartWalletModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateSmartWalletModalProps) {
  const account = useActiveAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [config, setConfig] = useState<SmartWalletConfig>({
    name: '',
    approvedTargets: ['*'],
    nativeTokenLimit: '0.1',
    durationDays: 30,
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setConfig({
        name: '',
        approvedTargets: ['*'],
        nativeTokenLimit: '0.1',
        durationDays: 30,
      });
      setError(null);
      setSuccess(false);
      setShowAdvanced(false);
    }
  }, [isOpen]);

  const handleCreate = async () => {
    if (!account?.address) {
      setError('Please connect your wallet first');
      return;
    }

    if (!config.name.trim()) {
      setError('Please enter a name for your Smart Wallet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: CreateAccountRequest = {
        userId: account.address,
        name: config.name.trim(),
        permissions: {
          approvedTargets: config.approvedTargets,
          nativeTokenLimit: config.nativeTokenLimit,
          durationDays: config.durationDays,
        },
      };

      await createSmartAccount(request);
      setSuccess(true);

      // Wait a moment to show success, then close
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error creating smart wallet:', err);
      if (err instanceof DCAApiError) {
        setError(err.message);
      } else {
        setError('Failed to create Smart Wallet. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <GlassCard className="w-full max-w-lg bg-[#0A0A0A]/95 border-cyan-500/20 overflow-hidden">
              {/* Header */}
              <div className="relative p-4 sm:p-6 border-b border-white/5">
                {/* Background glow */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-cyan-500/10 to-transparent pointer-events-none" />

                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="p-2.5 sm:p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex-shrink-0">
                      <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold text-white truncate">Create Smart Wallet</h2>
                      <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 sm:mt-1">
                        Enable automated DCA strategies
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Features badges */}
                <div className="relative flex flex-wrap gap-2 mt-3 sm:mt-4">
                  <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] sm:text-xs text-cyan-400">
                    <Zap className="w-3 h-3" />
                    <span>Account Abstraction</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] sm:text-xs text-zinc-400">
                    <Shield className="w-3 h-3" />
                    <span>Secure Session Key</span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Success State */}
                {success ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center py-8"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-4">
                      <Check className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Smart Wallet Created!</h3>
                    <p className="text-sm text-zinc-400 text-center">
                      Your wallet is ready. You can now deposit funds and create DCA strategies.
                    </p>
                  </motion.div>
                ) : (
                  <>
                    {/* Error Message */}
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20"
                      >
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <p className="text-sm text-red-400">{error}</p>
                      </motion.div>
                    )}

                    {/* Name Input */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">
                        Wallet Name
                      </label>
                      <input
                        type="text"
                        value={config.name}
                        onChange={(e) => setConfig({ ...config, name: e.target.value })}
                        placeholder="e.g., Weekly ETH Accumulator"
                        disabled={loading}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all disabled:opacity-50"
                      />
                      <p className="text-xs text-zinc-500">
                        A friendly name to identify this wallet&apos;s purpose
                      </p>
                    </div>

                    {/* Duration & Limit Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-2">
                        <label className="text-xs sm:text-sm font-medium text-zinc-300 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
                          Session Duration
                        </label>
                        <select
                          value={config.durationDays}
                          onChange={(e) => setConfig({ ...config, durationDays: Number(e.target.value) })}
                          disabled={loading}
                          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all disabled:opacity-50 appearance-none cursor-pointer"
                        >
                          <option value={7}>7 days</option>
                          <option value={30}>30 days</option>
                          <option value={90}>90 days</option>
                          <option value={180}>180 days</option>
                          <option value={365}>365 days</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs sm:text-sm font-medium text-zinc-300 flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
                          Limit per TX (ETH)
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={config.nativeTokenLimit}
                          onChange={(e) => setConfig({ ...config, nativeTokenLimit: e.target.value })}
                          disabled={loading}
                          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {/* Advanced Options */}
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                      >
                        {showAdvanced ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        Advanced Options
                      </button>

                      <AnimatePresence>
                        {showAdvanced && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                                Contract Permissions
                              </p>

                              <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                  type="radio"
                                  checked={config.approvedTargets[0] === '*'}
                                  onChange={() => setConfig({ ...config, approvedTargets: ['*'] })}
                                  className="w-4 h-4 text-cyan-500 bg-transparent border-white/20 focus:ring-cyan-500/50"
                                />
                                <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
                                  Allow all contracts (recommended)
                                </span>
                              </label>

                              <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                  type="radio"
                                  checked={config.approvedTargets[0] !== '*'}
                                  onChange={() => setConfig({ ...config, approvedTargets: [] })}
                                  className="w-4 h-4 text-cyan-500 bg-transparent border-white/20 focus:ring-cyan-500/50"
                                />
                                <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
                                  Restrict to specific contracts
                                </span>
                              </label>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Summary Card */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                      <h4 className="text-xs font-medium text-cyan-400 uppercase tracking-wider mb-3">
                        Permissions Summary
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Validity</span>
                          <span className="text-white font-medium">{config.durationDays} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Max per TX</span>
                          <span className="text-white font-medium">{config.nativeTokenLimit} ETH</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Contracts</span>
                          <span className="text-white font-medium">
                            {config.approvedTargets[0] === '*' ? 'All Allowed' : 'Restricted'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              {!success && (
                <div className="p-4 sm:p-6 pt-0 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 font-medium text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={loading || !config.name.trim()}
                    className={cn(
                      "flex-1 px-4 py-2.5 sm:py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm sm:text-base",
                      loading || !config.name.trim()
                        ? "bg-cyan-500/20 text-cyan-400/50 cursor-not-allowed"
                        : "bg-cyan-500 text-white hover:bg-cyan-400"
                    )}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Wallet className="w-4 h-4" />
                        Create Wallet
                      </>
                    )}
                  </button>
                </div>
              )}
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
