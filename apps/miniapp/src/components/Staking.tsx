import { motion, AnimatePresence } from "framer-motion";
import {
  Droplets,
  ArrowDown,
  Info,
  X,
  ArrowLeft,
  ArrowRight,
  Receipt,
  Percent,
  TrendingUp,
  Check,
  ChevronRight,
  ExternalLink,
  AlertCircle
} from "lucide-react";
import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DataInput } from "@/components/ui/DataInput";
import { cn } from "@/lib/utils";
import { TokenSelectionModal } from "@/components/TokenSelectionModal";
import { useStakingApi } from "@/features/staking/api";

interface StakingProps {
  onClose: () => void;
  initialAmount?: string;
  initialToken?: string;
}

type ViewState = 'input' | 'review' | 'success';

// Helper to get color based on network/token
const getTokenColor = (token: any) => {
  if (token.network === 'Avalanche') return 'bg-red-500';
  if (token.network === 'Base') return 'bg-blue-500';
  if (token.network === 'BSC') return 'bg-yellow-500';
  if (token.network === 'Optimism') return 'bg-red-500';
  if (token.network === 'Polygon') return 'bg-purple-500';
  if (token.network === 'Arbitrum') return 'bg-blue-600';
  if (token.ticker === 'CONF') return 'bg-orange-500';
  if (token.ticker === 'USDC') return 'bg-blue-400';
  return 'bg-zinc-500';
};

export function Staking({ onClose, initialAmount, initialToken }: StakingProps) {
  const stakingApi = useStakingApi();

  const [viewState, setViewState] = useState<ViewState>('input');
  const [showTokenList, setShowTokenList] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [stakeAmount, setStakeAmount] = useState(initialAmount || "0.01");
  const [stakingError, setStakingError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const [activeToken, setActiveToken] = useState({
    ticker: initialToken || "ETH",
    name: initialToken || "Ethereum",
    network: "Ethereum",
    balance: "0.00"
  });

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
        className="w-full md:max-w-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard 
          className="w-full shadow-2xl overflow-hidden relative bg-[#0A0A0A] border-white/10 h-[85vh] md:h-auto md:min-h-[540px] flex flex-col rounded-t-3xl rounded-b-none md:rounded-2xl border-b-0 md:border-b pb-safe"
        >
          {/* Gradient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-primary/10 blur-[60px] pointer-events-none" />

          {/* Mobile Drag Handle */}
          <div className="md:hidden w-full flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
          </div>

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
                    <button
                      onClick={() => setShowTokenList(true)}
                      className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-1.5 hover:bg-zinc-900 transition-colors group"
                    >
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold", getTokenColor(activeToken))}>
                        {activeToken.ticker[0]}
                      </div>
                      <span className="text-white font-medium">{activeToken.ticker}</span>
                      <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                    </button>
                  }
                />

                {/* Arrow Indicator */}
                <div className="flex justify-center -my-3 relative z-20">
                  <button className="bg-[#0A0A0A] border border-white/10 p-2 rounded-xl text-zinc-400 hover:text-primary hover:border-primary/50 transition-all">
                    <ArrowDown className="w-5 h-5" />
                  </button>
                </div>

                {/* Receive Input (Read Only) */}
                <DataInput
                  label="You Receive"
                  value={(Number(stakeAmount) * 0.998).toFixed(4)}
                  readOnly
                  className="text-zinc-400"
                  rightElement={
                    <button className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-1.5 hover:bg-zinc-900 transition-colors">
                      <div className="w-6 h-6 rounded-full bg-sky-500" />
                      <span className="text-white font-medium">st{activeToken.ticker}</span>
                    </button>
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
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4 mb-4">
                   <div className="font-medium text-white text-sm mb-2">
                     Stake {activeToken.ticker}
                   </div>
                   
                   {/* Visual Swap inside Card */}
                   <div className="flex items-center justify-center gap-4 py-2 bg-black/20 rounded-lg border border-white/5">
                     <div className="text-center">
                       <div className="text-white font-mono text-sm font-bold">{stakeAmount}</div>
                       <div className="text-zinc-500 text-[10px]">{activeToken.ticker}</div>
                     </div>
                     <ArrowRight className="w-4 h-4 text-zinc-600" />
                     <div className="text-center">
                       <div className="text-white font-mono text-sm font-bold">{(Number(stakeAmount) * 0.998).toFixed(4)}</div>
                       <div className="text-zinc-500 text-[10px]">st{activeToken.ticker}</div>
                     </div>
                   </div>

                   <div className="space-y-2 text-sm pt-2">
                       <div className="flex justify-between">
                          <span className="text-zinc-500">Exchange Rate</span>
                          <span className="text-white font-mono text-xs">1 {activeToken.ticker} = 0.998 st{activeToken.ticker}</span>
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
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                <Check className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-display font-bold text-white mb-2">Staking Submitted!</h2>
              <p className="text-zinc-400 text-center mb-2">
                You have staked {stakeAmount} {activeToken.ticker}
              </p>
              <p className="text-zinc-500 text-sm text-center mb-4">
                You will receive ~{(Number(stakeAmount) * 0.998).toFixed(4)} st{activeToken.ticker}
              </p>

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
           <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shadow-lg shadow-black/50 border border-white/5">
             <Droplets className="w-4 h-4 text-blue-400" />
           </div>
           <span className="text-sm font-medium text-zinc-400">Powered by Lido</span>
        </div>

        {/* TOKEN SELECTION MODAL */}
        <TokenSelectionModal 
          isOpen={showTokenList} 
          onClose={() => setShowTokenList(false)}
          onSelect={(token) => {
            setActiveToken({
              ticker: token.symbol,
              name: token.name,
              network: token.network,
              balance: "0.00" // Placeholder until we use usePortfolioData here
            });
            setShowTokenList(false);
          }}
        />

      </GlassCard>
      </motion.div>
    </motion.div>
  );
}
