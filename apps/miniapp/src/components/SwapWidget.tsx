import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftRight } from "lucide-react";
import { 
  X, 
  ArrowDown, 
  ArrowRightLeft,
  Settings, 
  Info, 
  Search, 
  ArrowLeft, 
  Fuel, 
  Check, 
  ChevronRight,
  Zap,
  ExternalLink,
  ShieldCheck,
  Triangle,
  ArrowUpRight
} from "lucide-react";
import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DataInput } from "@/components/ui/DataInput";
import { cn } from "@/lib/utils";
import * as Switch from '@radix-ui/react-switch';
import { TokenSelectionModal } from "@/components/TokenSelectionModal";

interface SwapWidgetProps {
  onClose: () => void;
}

type ViewState = 'input' | 'routing' | 'details' | 'confirm';

// Helper to get color based on network/token (simplified version of modal logic)
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

import { SettingsPopover } from "@/components/SettingsPopover";

export function SwapWidget({ onClose }: SwapWidgetProps) {
  const [viewState, setViewState] = useState<ViewState>('input');
  const [showTokenList, setShowTokenList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isCrossChain, setIsCrossChain] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  
  // Token State
  const [activeSlot, setActiveSlot] = useState<'sell' | 'buy'>('sell');
  const [sellToken, setSellToken] = useState({ ticker: "CONF", name: "Confraria", network: "World Chain", balance: "500000" });
  const [buyToken, setBuyToken] = useState({ ticker: "ETH", name: "Ethereum", network: "Base", balance: "0.00" });

  // Navigation handlers
  const goToRouting = () => setViewState('routing');
  const goToDetails = () => setViewState('details');
  const goToConfirm = () => setViewState('confirm');
  const goBack = () => {
    if (viewState === 'routing') setViewState('input');
    if (viewState === 'details') setViewState('routing');
    if (viewState === 'confirm') setViewState('details');
  };

  const openTokenList = (slot: 'sell' | 'buy') => {
    setActiveSlot(slot);
    setShowTokenList(true);
  };

  const handleTokenSelect = (token: any) => {
    if (activeSlot === 'sell') {
      setSellToken(token);
    } else {
      setBuyToken(token);
    }
    // Check if cross chain
    const newSell = activeSlot === 'sell' ? token : sellToken;
    const newBuy = activeSlot === 'buy' ? token : buyToken;
    setIsCrossChain(newSell.network !== newBuy.network);
  };

  // Determine animation variants based on screen size (handled via className for simplicity/perf, 
  // but framer needs values. Using a simple heuristic or generic slide-up/fade)
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
        className="relative w-full md:max-w-[480px]" 
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard className="w-full shadow-2xl overflow-hidden relative bg-[#0A0A0A] border-white/10 h-[85vh] md:h-auto md:min-h-[540px] flex flex-col rounded-t-3xl rounded-b-none md:rounded-2xl border-b-0 md:border-b pb-safe">
          {/* Gradient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-primary/10 blur-[60px] pointer-events-none" />

          {/* Mobile Drag Handle */}
          <div className="md:hidden w-full flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
          </div>

          {/* --- 1. INPUT STATE --- */}
          <AnimatePresence mode="wait">
            {viewState === 'input' && (
              <motion.div 
                key="input"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                {/* Header - Increased z-index to 20 to fix overlap issue */}
                <div className="p-6 flex items-center justify-between relative z-20">
                  <div className="flex items-center gap-3">
                    <ArrowLeftRight className="w-6 h-6 text-cyan-400" />
                    <h2 className="text-xl font-display font-bold text-white">Swap</h2>
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

                {/* Content */}
                <div className="px-6 pb-8 space-y-2 relative z-10 flex-1 flex flex-col">
                  <DataInput
                    label="Sell"
                    balance={`${sellToken.balance} ${sellToken.ticker}`}
                    defaultValue={activeSlot === 'sell' ? "500000" : "0.00"}
                    rightElement={
                      <button 
                        onClick={() => openTokenList('sell')}
                        className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-1.5 hover:bg-zinc-900 transition-colors group"
                      >
                        <div className={cn("w-6 h-6 rounded-full", getTokenColor(sellToken))} />
                        <span className="text-white font-medium">{sellToken.ticker}</span>
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </button>
                    }
                  />

                  <div className="flex justify-center -my-3 relative z-20">
                    <button 
                      onClick={() => {
                        // Swap tokens
                        const temp = sellToken;
                        setSellToken(buyToken);
                        setBuyToken(temp);
                      }}
                      className="bg-[#0A0A0A] border border-white/10 p-2 rounded-xl text-zinc-400 hover:text-primary hover:border-primary/50 transition-all"
                    >
                      <ArrowDown className="w-5 h-5" />
                    </button>
                  </div>

                  <DataInput
                    label="Buy"
                    balance={`${buyToken.balance} ${buyToken.ticker}`}
                    defaultValue={activeSlot === 'buy' ? "1.00" : "0.00"} // Just placeholder logic
                    rightElement={
                      <button 
                        onClick={() => openTokenList('buy')}
                        className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-1.5 hover:bg-zinc-900 transition-colors group"
                      >
                        <div className={cn("w-6 h-6 rounded-full", getTokenColor(buyToken))} />
                        <span className="text-white font-medium">{buyToken.ticker}</span>
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </button>
                    }
                  />

                  <div className="mt-auto pt-6 space-y-4">
                    <NeonButton onClick={goToRouting}>
                      Get started
                    </NeonButton>

                    <div className="text-center text-[10px] text-zinc-500 leading-relaxed">
                      Buy and sell crypto on 15+ networks including Ethereum, Base, and Arbitrum
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- 2. ORDER ROUTING STATE --- */}
            {viewState === 'routing' && (
              <motion.div 
                key="routing"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                 <div className="p-6 flex items-center justify-between relative z-10">
                   <h2 className="text-lg font-display font-bold text-white">Order Routing</h2>
                   <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                 </div>

                 <div className="px-6 pb-8 flex-1 flex flex-col relative z-10">
                    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-6">
                      <div className="bg-primary/10 px-4 py-3 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary font-medium text-sm">
                           <Check className="w-4 h-4" />
                           Best price route
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                           <span className="font-medium text-white">Swap {sellToken.ticker} to {buyToken.ticker}</span>
                           <span className="bg-cyan-500/20 text-cyan-400 text-[10px] font-bold px-2 py-0.5 rounded border border-cyan-500/30">+ FAST</span>
                        </div>
                        <div className="space-y-2 text-sm">
                           <div className="flex justify-between">
                              <span className="text-zinc-500">Amount in</span>
                              <span className="text-zinc-300 font-mono">500000 {sellToken.ticker}</span>
                           </div>
                           <div className="flex justify-between">
                              <span className="text-zinc-500">Expected Amount Out</span>
                              <span className="text-white font-mono font-medium">0.001152 {buyToken.ticker}</span>
                           </div>
                           <div className="flex justify-between">
                              <span className="text-zinc-500">Min. Out After Slippage</span>
                              <span className="text-zinc-300 font-mono">0.001140 {buyToken.ticker}</span>
                           </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto">
                       <NeonButton onClick={goToDetails} className="bg-white text-black hover:bg-zinc-200 shadow-none">
                         Continue
                       </NeonButton>
                    </div>
                 </div>
              </motion.div>
            )}

            {/* --- 3. SWAP DETAILS STATE --- */}
            {viewState === 'details' && (
              <motion.div 
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                 <div className="p-6 flex items-center justify-between relative z-10">
                   <h2 className="text-lg font-display font-bold text-white">Swap Details</h2>
                   <button onClick={() => setViewState('input')} className="text-zinc-500 hover:text-white">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                 </div>

                 <div className="px-6 pb-8 flex-1 flex flex-col relative z-10 overflow-y-auto custom-scrollbar">
                    {/* API Selection */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-white">Select Swap API</span>
                      <button className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-zinc-300 border border-white/10 transition-colors">
                        Change API
                      </button>
                    </div>

                    {/* Routing */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-zinc-400">Routing</span>
                      <div className="flex items-center gap-2 text-white font-medium text-sm">
                        <div className="w-2 h-2 rounded-full bg-white" />
                        UNI V3
                        <Info className="w-3 h-3 text-zinc-600" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-6">
                       <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[10px] font-bold rounded border border-cyan-500/30 flex items-center gap-1">
                         <Check className="w-3 h-3" /> Suggested
                       </span>
                       <span className="text-xs text-zinc-500">Est. Price Impact 1.1%</span>
                    </div>

                    {/* Details Card */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 mb-4">
                       <div className="font-medium text-white text-sm mb-2">Swap {sellToken.ticker} to {buyToken.ticker}</div>
                       <div className="space-y-2 text-sm">
                           <div className="flex justify-between">
                              <span className="text-zinc-500">Amount in</span>
                              <span className="text-zinc-300 font-mono">500000 {sellToken.ticker}</span>
                           </div>
                           <div className="flex justify-between">
                              <span className="text-zinc-500">Expected Amount Out</span>
                              <span className="text-white font-mono font-medium">0.001152 {buyToken.ticker}</span>
                           </div>
                           <div className="flex justify-between">
                              <span className="text-zinc-500">Min. Out After Slippage</span>
                              <span className="text-zinc-300 font-mono">0.001140 {buyToken.ticker}</span>
                           </div>
                        </div>
                    </div>

                    {/* Fees */}
                    <div className="space-y-3 mb-6">
                       <div className="flex justify-between text-sm">
                          <span className="text-zinc-400">Aperture Fee</span>
                          <span className="text-white font-mono">0.9% (&lt;$0.01)</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-zinc-400">Transaction Setting</span>
                          <button className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-zinc-300 border border-white/10 transition-colors">
                            Change Settings
                          </button>
                       </div>
                    </div>

                    <div className="mt-auto">
                       <NeonButton onClick={goToConfirm} className="bg-white text-black hover:bg-zinc-200 shadow-none">
                         Continue
                       </NeonButton>
                    </div>
                 </div>
              </motion.div>
            )}

            {/* --- 4. CONFIRM DETAILS STATE --- */}
            {viewState === 'confirm' && (
               <motion.div 
                key="confirm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                 <div className="p-6 flex items-center justify-between relative z-10">
                   <h2 className="text-lg font-display font-bold text-white">Confirm details</h2>
                   <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                 </div>

                 <div className="px-6 pb-8 flex-1 flex flex-col relative z-10">
                    <p className="text-sm text-zinc-400 mb-6">
                      Review and accept Uniswap Labs Terms of Service & Privacy Policy to get started
                    </p>

                    <div className="space-y-4 mb-8">
                       <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                          <span className="text-sm text-zinc-300">I have read and agreed with <span className="text-white underline decoration-zinc-500">Uniswap Labs Terms of Service</span></span>
                          <Switch.Root 
                            checked={tosAccepted}
                            onCheckedChange={setTosAccepted}
                            className={cn("w-10 h-6 rounded-full relative transition-colors", tosAccepted ? 'bg-primary' : 'bg-zinc-700')}
                          >
                            <Switch.Thumb className={cn("block w-4 h-4 bg-white rounded-full transition-transform translate-x-1 will-change-transform", tosAccepted ? 'translate-x-5' : 'translate-x-1')} />
                          </Switch.Root>
                       </div>

                       <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                          <span className="text-sm text-zinc-300">I have read and agreed with <span className="text-white underline decoration-zinc-500">Uniswap Labs Privacy Policy</span></span>
                          <Switch.Root 
                            checked={privacyAccepted}
                            onCheckedChange={setPrivacyAccepted}
                            className={cn("w-10 h-6 rounded-full relative transition-colors", privacyAccepted ? 'bg-primary' : 'bg-zinc-700')}
                          >
                            <Switch.Thumb className={cn("block w-4 h-4 bg-white rounded-full transition-transform translate-x-1 will-change-transform", privacyAccepted ? 'translate-x-5' : 'translate-x-1')} />
                          </Switch.Root>
                       </div>
                    </div>

                    <div className="mt-auto">
                       <NeonButton 
                         className={cn("bg-white text-black hover:bg-zinc-200 shadow-none transition-opacity", (!tosAccepted || !privacyAccepted) && "opacity-50 cursor-not-allowed")}
                         disabled={!tosAccepted || !privacyAccepted}
                       >
                         Confirm
                       </NeonButton>
                    </div>
                 </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* FOOTER POWERED BY */}
          <div className="py-8 relative z-10 flex items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
            {isCrossChain ? (
               <>
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shadow-lg shadow-black/50 border border-white/5">
                    <Triangle className="w-4 h-4 text-white fill-white rotate-180" />
                  </div>
                  <span className="text-sm font-medium text-zinc-400">Powered by Thirdweb</span>
               </>
            ) : (
               <>
                  <div className="w-8 h-8 rounded-full bg-[#ff007a]/10 flex items-center justify-center shadow-lg shadow-[#ff007a]/20 border border-[#ff007a]/20">
                    <div className="text-[#ff007a] font-bold text-sm">🦄</div>
                  </div>
                  <span className="text-sm font-medium text-zinc-400">Powered by Uniswap</span>
               </>
            )}
          </div>

          {/* TOKEN SELECTION MODAL */}
          <TokenSelectionModal 
            isOpen={showTokenList} 
            onClose={() => setShowTokenList(false)}
            onSelect={handleTokenSelect}
          />

        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
