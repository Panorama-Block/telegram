import { motion, AnimatePresence } from "framer-motion";
import { 
  Droplets, 
  ArrowDown, 
  Info, 
  Settings,
  X,
  ArrowLeft,
  ArrowRight,
  Receipt,
  Percent,
  TrendingUp,
  Check,
  ChevronRight
} from "lucide-react";
import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DataInput } from "@/components/ui/DataInput";
import { cn } from "@/lib/utils";
import { TokenSelectionModal } from "@/components/TokenSelectionModal";
import { SettingsPopover } from "@/components/SettingsPopover";

interface StakingProps {
  onClose: () => void;
}

type ViewState = 'input' | 'review';

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

export function Staking({ onClose }: StakingProps) {
  const [viewState, setViewState] = useState<ViewState>('input');
  const [showTokenList, setShowTokenList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [activeToken, setActiveToken] = useState({
    ticker: "ETH",
    name: "Ethereum",
    network: "Base",
    balance: "4.2"
  });

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
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
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
                 <div className="flex items-center gap-2 relative">
                   <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className={cn(
                      "p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors",
                      showSettings && "text-primary bg-primary/10"
                    )}
                   >
                      <Settings className="w-5 h-5" />
                   </button>
                   <SettingsPopover isOpen={showSettings} onClose={() => setShowSettings(false)} />
                   <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-5 h-5" />
                   </button>
                 </div>
              </div>

              <div className="px-6 pb-8 space-y-2 relative z-10 flex-1 flex flex-col">
                
                {/* Stake Input */}
                <DataInput
                  label="You Stake"
                  balance={`Balance: ${activeToken.balance} ${activeToken.ticker}`}
                  defaultValue="1.0"
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
                <div className="mt-2 text-xs text-zinc-600 px-1">
                  $2,400.00
                </div>

                {/* Arrow Indicator */}
                <div className="flex justify-center -my-3 relative z-20">
                  <button className="bg-[#0A0A0A] border border-white/10 p-2 rounded-xl text-zinc-400 hover:text-primary hover:border-primary/50 transition-all">
                    <ArrowDown className="w-5 h-5" />
                  </button>
                </div>

                {/* Receive Input (Read Only) */}
                <DataInput
                  label="You Receive"
                  balance={`1 ${activeToken.ticker} ≈ 1.0003 st${activeToken.ticker}`}
                  defaultValue="0.998"
                  readOnly
                  className="text-zinc-400"
                  rightElement={
                    <button className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-1.5 hover:bg-zinc-900 transition-colors">
                      <div className="w-6 h-6 rounded-full bg-sky-500" />
                      <span className="text-white font-medium">st{activeToken.ticker}</span>
                    </button>
                  }
                />
                <div className="mt-2 text-xs text-zinc-600 px-1">
                  $2,395.20
                </div>

                {/* Info Block */}
                <div className="py-2 flex items-center justify-between text-xs px-2 mt-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500">Staking APY</span>
                      <span className="text-green-400 font-medium">4.2%</span>
                    </div>
                     <div className="flex items-center gap-1">
                      <span className="text-zinc-500">Lock Period</span>
                      <span className="text-white font-medium">None</span>
                    </div>
                  </div>
                  <Info className="w-3 h-3 text-zinc-600" />
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
                   <div className="text-xs text-zinc-500">
                     APY <span className="text-white font-medium">4.2%</span>
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
                       <div className="text-white font-mono text-sm font-bold">1.0</div>
                       <div className="text-zinc-500 text-[10px]">{activeToken.ticker}</div>
                     </div>
                     <ArrowRight className="w-4 h-4 text-zinc-600" />
                     <div className="text-center">
                       <div className="text-white font-mono text-sm font-bold">0.998</div>
                       <div className="text-zinc-500 text-[10px]">st{activeToken.ticker}</div>
                     </div>
                   </div>

                   <div className="space-y-2 text-sm pt-2">
                       <div className="flex justify-between">
                          <span className="text-zinc-500">Exchange Rate</span>
                          <span className="text-white font-mono text-xs">1 {activeToken.ticker} = 0.998 st{activeToken.ticker}</span>
                       </div>
                       <div className="flex justify-between">
                          <span className="text-zinc-500">Rewards Fee</span>
                          <span className="text-white font-mono">10%</span>
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

                {/* Final Button */}
                <div className="mt-auto">
                  <NeonButton className="w-full bg-white text-black hover:bg-zinc-200 shadow-none">
                    Mint & Stake
                  </NeonButton>
                </div>

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
            setActiveToken(token);
            setShowTokenList(false);
          }}
        />

      </GlassCard>
      </motion.div>
    </motion.div>
  );
}
