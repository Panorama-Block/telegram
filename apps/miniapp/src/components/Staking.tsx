import { motion, AnimatePresence } from "framer-motion";
import {
  Droplets,
  ArrowDown,
  X,
  ArrowLeft,
  ArrowRight,
  Receipt,
  Check,
  ExternalLink,
  AlertCircle,
  Clock
} from "lucide-react";
import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DataInput } from "@/components/ui/DataInput";
import { useStakingApi } from "@/features/staking/api";

// Feature flags
import { FEATURE_FLAGS, FEATURE_METADATA } from "@/config/features";

// Token icons from CoinGecko
const ETH_ICON = 'https://assets.coingecko.com/coins/images/279/small/ethereum.png';
const STETH_ICON = 'https://assets.coingecko.com/coins/images/13442/small/steth_logo.png';

interface StakingProps {
  onClose: () => void;
  initialAmount?: string;
}

type ViewState = 'input' | 'review' | 'success';

export function Staking({ onClose, initialAmount }: StakingProps) {
  const stakingApi = useStakingApi();

  const [viewState, setViewState] = useState<ViewState>('input');
  const [isStaking, setIsStaking] = useState(false);
  const [stakeAmount, setStakeAmount] = useState(initialAmount || "0.01");
  const [stakingError, setStakingError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // ETH is the only supported token for Lido staking
  const activeToken = {
    ticker: "ETH",
    name: "Ethereum",
    network: "Ethereum",
    balance: "0.00"
  };

  // Handle staking action - calls the real Lido staking API
  const handleStake = async () => {
    setIsStaking(true);
    setStakingError(null);
    setTxHash(null);

    try {
      // Step 1: Get transaction data from staking API
      console.log('[STAKING] Requesting stake transaction for', stakeAmount, 'ETH');
      const stakeTx = await stakingApi.stake(stakeAmount);

      if (!stakeTx || !stakeTx.transactionData) {
        throw new Error('No transaction data received from staking service');
      }

      console.log('[STAKING] Received transaction data:', stakeTx);

      // Step 2: Execute the transaction (opens MetaMask)
      console.log('[STAKING] Executing transaction...');
      const hash = await stakingApi.executeTransaction(stakeTx.transactionData);

      console.log('[STAKING] Transaction successful! Hash:', hash);
      setTxHash(hash);
      setViewState('success');
    } catch (error) {
      console.error('[STAKING] Error:', error);
      setStakingError(error instanceof Error ? error.message : 'Staking failed. Please try again.');
    } finally {
      setIsStaking(false);
    }
  };

  // Responsive variants
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const modalVariants = {
    initial: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
    animate: isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 },
    exit: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
  };

  // Coming Soon State
  if (!FEATURE_FLAGS.STAKING_ENABLED) {
    const metadata = FEATURE_METADATA.staking;
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          variants={modalVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[340px] md:max-w-[400px]"
          onClick={(e) => e.stopPropagation()}
        >
          <GlassCard className="w-full shadow-2xl overflow-hidden relative bg-[#0A0A0A] border-white/10 flex flex-col rounded-2xl border">
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between relative z-10 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Droplets className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Liquid Staking</h2>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Coming Soon</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Coming Soon Content - Compact */}
            <div className="px-4 py-5 text-center">
              <div className="mb-4 flex justify-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                    <Clock className="w-7 h-7 text-cyan-400" />
                  </div>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-cyan-400 text-xs font-medium">Coming Soon</span>
              </div>

              <h3 className="text-lg font-bold text-white mb-1.5">{metadata?.name || 'Liquid Staking'}</h3>
              <p className="text-zinc-400 text-xs leading-relaxed mb-3">{metadata?.description || 'This feature is under development.'}</p>

              {metadata?.expectedLaunch && (
                <p className="text-zinc-500 text-[10px]">Expected: {metadata.expectedLaunch}</p>
              )}
            </div>

            {/* Footer - Only Go to Chat */}
            <div className="px-4 py-3 border-t border-white/5">
              <NeonButton onClick={onClose} className="w-full text-sm py-2.5">
                Go to Chat
              </NeonButton>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pb-20 md:pb-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        variants={modalVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full md:max-w-[480px] md:my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard
          className="w-full shadow-2xl overflow-hidden relative bg-[#0A0A0A] border-white/10 max-h-[78vh] md:max-h-[85vh] md:h-auto md:min-h-[540px] flex flex-col rounded-2xl border pb-safe overflow-y-auto"
        >
          {/* Gradient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-primary/10 blur-[60px] pointer-events-none" />

          <AnimatePresence mode="wait">
          {/* --- STATE 1: INPUT --- */}
          {viewState === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full"
            >
              {/* Header */}
              <div className="p-6 flex items-center justify-between relative z-10">
                 <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                      <Droplets className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-display font-bold text-white">Liquid Staking</h2>
                      <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                        Mint Derivative
                      </div>
                    </div>
                 </div>
                 <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                 </button>
              </div>

              <div className="px-6 pb-8 space-y-2 relative z-10 flex-1 flex flex-col">
                
                {/* Stake Input */}
                <DataInput
                  label="You Stake"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  rightElement={
                    <div className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2.5 sm:px-3 py-1.5 sm:py-2 min-h-[40px] sm:min-h-[44px]">
                      <img src={ETH_ICON} alt="ETH" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" />
                      <span className="text-white font-medium text-sm sm:text-base">{activeToken.ticker}</span>
                    </div>
                  }
                />

                {/* Arrow Indicator */}
                <div className="flex justify-center -my-3 relative z-20">
                  <button className="bg-[#0A0A0A] border border-white/10 p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-primary hover:border-primary/50 transition-all">
                    <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>

                {/* Receive Input (Read Only) */}
                <DataInput
                  label="You Receive"
                  value={(Number(stakeAmount) * 0.998).toFixed(4)}
                  readOnly
                  className="text-zinc-400"
                  rightElement={
                    <div className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2.5 sm:px-3 py-1.5 sm:py-2 min-h-[40px] sm:min-h-[44px]">
                      <img src={STETH_ICON} alt="stETH" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" />
                      <span className="text-white font-medium text-sm sm:text-base">stETH</span>
                    </div>
                  }
                />

                {/* Info Block */}
                <div className="py-2 flex flex-col gap-2 text-xs px-2 mt-4">
                  <div className="flex items-center gap-1 text-zinc-500">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Ethereum Mainnet via Lido</span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-auto pt-4">
                  <NeonButton onClick={() => setViewState('review')}>
                    Stake {activeToken.ticker}
                  </NeonButton>
                </div>

              </div>
            </motion.div>
          )}

          {/* --- STATE 2: REVIEW (Swap Mold) --- */}
          {viewState === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full"
            >
              {/* Header */}
              <div className="p-6 flex items-center justify-between relative z-10">
                 <h2 className="text-lg font-display font-bold text-white">Confirm Staking</h2>
                 <button onClick={() => setViewState('input')} className="text-zinc-500 hover:text-white">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
              </div>

              <div className="px-6 pb-8 flex-1 flex flex-col relative z-10 overflow-y-auto custom-scrollbar">
                
                {/* Top Highlights */}
                <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded border border-blue-500/20 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Liquid Staking
                      </span>
                   </div>
                </div>

                {/* Main Details Card (Swap Mold) */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 space-y-4 mb-4">
                   <div className="flex items-center gap-2 mb-2">
                     <img src={ETH_ICON} alt="ETH" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" />
                     <span className="font-medium text-white text-sm sm:text-base">
                       Stake {activeToken.ticker}
                     </span>
                   </div>

                   {/* Visual Swap inside Card */}
                   <div className="flex items-center justify-center gap-3 sm:gap-4 py-3 bg-black/20 rounded-lg border border-white/5">
                     <div className="flex items-center gap-2">
                       <img src={ETH_ICON} alt="ETH" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full" />
                       <div className="text-left">
                         <div className="text-white font-mono text-sm sm:text-base font-bold">{stakeAmount}</div>
                         <div className="text-zinc-500 text-[10px] sm:text-xs">{activeToken.ticker}</div>
                       </div>
                     </div>
                     <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-600" />
                     <div className="flex items-center gap-2">
                       <img src={STETH_ICON} alt="stETH" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full" />
                       <div className="text-left">
                         <div className="text-white font-mono text-sm sm:text-base font-bold">{(Number(stakeAmount) * 0.998).toFixed(4)}</div>
                         <div className="text-zinc-500 text-[10px] sm:text-xs">st{activeToken.ticker}</div>
                       </div>
                     </div>
                   </div>

                   <div className="space-y-2 text-sm pt-2">
                       <div className="flex justify-between">
                          <span className="text-zinc-500 text-xs sm:text-sm">Exchange Rate</span>
                          <span className="text-white font-mono text-[10px] sm:text-xs">1 {activeToken.ticker} = 0.998 st{activeToken.ticker}</span>
                       </div>
                   </div>
                </div>

                {/* Secondary Info / Receipt */}
                <div className="space-y-3 mb-6">
                   <div className="flex items-start gap-3 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                      <Receipt className="w-4 h-4 text-blue-400 mt-0.5" />
                      <div className="text-xs text-zinc-400 leading-relaxed">
                        <span className="text-white font-medium">You receive a receipt.</span> Your st{activeToken.ticker} balance tracks your stake + rewards automatically.
                      </div>
                   </div>
                </div>

                {/* Error Message */}
                {stakingError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 mb-4">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-red-200 text-xs">{stakingError}</p>
                  </div>
                )}

                {/* Final Button */}
                <div className="mt-auto">
                  <NeonButton
                    onClick={handleStake}
                    disabled={isStaking}
                    className="w-full bg-white text-black hover:bg-zinc-200 shadow-none disabled:opacity-50"
                  >
                    {isStaking ? 'Confirming in Wallet...' : 'Mint & Stake'}
                  </NeonButton>
                  {isStaking && (
                    <p className="text-xs text-zinc-500 text-center mt-2">
                      Please confirm the transaction in your wallet
                    </p>
                  )}
                </div>

              </div>
            </motion.div>
          )}

          {/* --- STATE 3: SUCCESS --- */}
          {viewState === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col h-full items-center justify-center p-6"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                <Check className="w-8 h-8 sm:w-10 sm:h-10 text-green-500" />
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white mb-2">Staking Submitted!</h2>
              <div className="flex items-center justify-center gap-2 mb-2">
                <img src={ETH_ICON} alt="ETH" className="w-5 h-5 rounded-full" />
                <p className="text-zinc-400 text-center text-sm sm:text-base">
                  You have staked {stakeAmount} {activeToken.ticker}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 mb-4">
                <img src={STETH_ICON} alt="stETH" className="w-5 h-5 rounded-full" />
                <p className="text-zinc-500 text-xs sm:text-sm text-center">
                  You will receive ~{(Number(stakeAmount) * 0.998).toFixed(4)} st{activeToken.ticker}
                </p>
              </div>

              {/* Transaction Link */}
              {txHash && (
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-primary text-sm hover:bg-white/10 transition-colors mb-6"
                >
                  <span className="font-mono truncate max-w-[200px]">{txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              <div className="w-full space-y-3">
                <NeonButton onClick={onClose}>
                  Done
                </NeonButton>
                <button
                  onClick={() => {
                    setViewState('input');
                    setStakeAmount('0.01');
                    setTxHash(null);
                    setStakingError(null);
                  }}
                  className="w-full py-3 text-zinc-400 hover:text-white transition-colors"
                >
                  Stake More
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FOOTER POWERED BY */}
        <div className="py-8 relative z-10 flex items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
           <img src="/miniapp/icons/lido_logo.png" alt="Lido" className="w-8 h-8 rounded-full" />
           <span className="text-sm font-medium text-zinc-400">Powered by Lido</span>
        </div>

      </GlassCard>
      </motion.div>
    </motion.div>
  );
}
