/**
 * Delete Wallet Confirmation Modal
 * Styled to match Portfolio Analytics page aesthetics
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  Trash2,
  X,
  AlertTriangle,
  Loader2
} from 'lucide-react';

interface DeleteWalletModalProps {
  isOpen: boolean;
  walletName: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function DeleteWalletModal({
  isOpen,
  walletName,
  onClose,
  onConfirm,
}: DeleteWalletModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error deleting wallet:', error);
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
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[9999] sm:inset-x-0 sm:flex sm:items-center sm:justify-center"
          >
            <GlassCard className="w-full max-w-md mx-auto bg-[#0A0A0A]/95 border-red-500/20 overflow-hidden">
              {/* Header */}
              <div className="relative p-4 sm:p-6 border-b border-white/5">
                {/* Background glow */}
                <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-red-500/10 to-transparent pointer-events-none" />

                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="p-2.5 sm:p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold text-white">Delete Wallet</h2>
                      <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                        This action cannot be undone
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    disabled={loading}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 disabled:opacity-50"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6">
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 mb-4">
                  <p className="text-sm text-zinc-300">
                    Are you sure you want to delete{' '}
                    <span className="font-semibold text-white">&quot;{walletName}&quot;</span>?
                  </p>
                  <p className="text-xs text-zinc-500 mt-2">
                    All associated strategies will be stopped and any remaining funds should be withdrawn first.
                  </p>
                </div>

                {/* Warning badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Irreversible</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400">
                    <Trash2 className="w-3 h-3" />
                    <span>Strategies will stop</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 pt-0 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 font-medium text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-medium transition-all flex items-center justify-center gap-2 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Wallet
                    </>
                  )}
                </button>
              </div>
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
