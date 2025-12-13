import { motion, AnimatePresence } from "framer-motion";
import { 
  Landmark, 
  ChevronDown, 
  Info, 
  Settings,
  X,
  ArrowLeft,
  Check,
  ChevronRight,
  Triangle,
  Loader2
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DataInput } from "@/components/ui/DataInput";
import { cn } from "@/lib/utils";
import * as Switch from '@radix-ui/react-switch';
import { TokenSelectionModal } from "@/components/TokenSelectionModal";
import { SettingsPopover } from "@/components/SettingsPopover";

// Lending Hook
import { useLendingData } from "@/features/lending/useLendingData";
import { useLendingApi } from "@/features/lending/api";
import { LendingToken } from "@/features/lending/types";
import { useActiveAccount } from "thirdweb/react";

interface LendingProps {
  onClose: () => void;
}

type ViewState = 'input' | 'review' | 'success';

// Helper to get color based on network/token
const getTokenColor = (token: any) => {
  if (!token?.network) return 'bg-zinc-500';
  if (token.network === 'Avalanche') return 'bg-red-500';
  if (token.network === 'Base') return 'bg-blue-500';
  if (token.network === 'Binance Smart Chain' || token.network === 'BSC') return 'bg-yellow-500';
  if (token.network === 'Optimism') return 'bg-red-500';
  if (token.network === 'Polygon') return 'bg-purple-500';
  if (token.network === 'Arbitrum') return 'bg-blue-600';
  return 'bg-zinc-500';
};

export function Lending({ onClose }: LendingProps) {
  const account = useActiveAccount();
  const { tokens, loading: loadingData, error: dataError } = useLendingData();
  const lendingApi = useLendingApi();
  
  const [viewState, setViewState] = useState<ViewState>('input');
  const [activeTab, setActiveTab] = useState<'supply' | 'borrow'>('supply');
  const [collateralEnabled, setCollateralEnabled] = useState(true);
  const [showTokenList, setShowTokenList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [amount, setAmount] = useState("10.0");
  const [activeToken, setActiveToken] = useState<any>(null);

  // Execution State
  const [preparing, setPreparing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Initialize active token when data loads
  useEffect(() => {
    if (tokens.length > 0 && !activeToken) {
      // Create UI-friendly token object
      setActiveToken({
        ticker: tokens[0].symbol,
        name: tokens[0].symbol, // API doesn't return name yet
        network: "Avalanche", // API defaults to 43114 (Avalanche) usually
        address: tokens[0].address,
        balance: "0.00", // Need user balance fetch
        decimals: tokens[0].decimals,
        supplyAPY: tokens[0].supplyAPY,
        borrowAPY: tokens[0].borrowAPY,
        collateralFactor: tokens[0].collateralFactor
      });
    }
  }, [tokens, activeToken]);

  // Map lending tokens to UI format for modal
  const uiTokens = useMemo(() => {
    return tokens.map(t => ({
      ticker: t.symbol,
      name: t.symbol,
      // Attempt to map chainId but API is single-chain focused currently (Avalanche/Base)
      // Assuming Avalanche for the default lending deployment based on config
      network: "Avalanche", 
      address: t.address,
      balance: "0.00", // Placeholder
      icon: t.icon,
      // Extra props for internal use
      supplyAPY: t.supplyAPY,
      borrowAPY: t.borrowAPY
    }));
  }, [tokens]);

  const getPoweredBy = () => {
    if (activeToken?.ticker === 'AVAX' || activeToken?.network === 'Avalanche') return { text: "Benqi", color: "text-red-400" };
    if (activeToken?.ticker === 'ETH') return { text: "Aave", color: "text-purple-400" };
    if (activeToken?.ticker === 'USDC') return { text: "Compound", color: "text-green-400" };
    return { text: "Lending Protocol", color: "text-zinc-400" };
  };

  const poweredBy = getPoweredBy();

  // Responsive variants
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const modalVariants = {
    initial: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
    animate: isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 },
    exit: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
  };

  const handleAction = async () => {
    if (!activeToken || !account || !amount) return;

    setPreparing(true);
    setExecutionError(null);

    try {
      let txData;
      // 1. Prepare Transaction
      if (activeTab === 'supply') {
         txData = await lendingApi.prepareSupply(activeToken.address, amount);
      } else {
         txData = await lendingApi.prepareBorrow(activeToken.address, amount);
      }

      if (!txData || !txData.data) throw new Error("Failed to prepare transaction");

      setPreparing(false);
      setExecuting(true);

      // 2. Execute Transaction
      // The API returns { data: { to, data, value, ... } }
      // We need to map it to what executeTransaction expects if needed, 
      // but lendingApiClient.executeTransaction handles it.
      
      // Need to normalize the data structure if API returns nested data
      const transactionPayload = txData.data?.transactionData || txData.data; // Handle variance
      
      await lendingApi.executeTransaction(transactionPayload);

      setExecuting(false);
      setViewState('success');
      // Hack: assume success leads to hash eventually or we just show success state
      setTxHash("0x..."); // We might need to capture hash from executeTransaction return

    } catch (e: any) {
      console.error("Lending action failed:", e);
      setExecutionError(e.message || "Transaction failed");
      setPreparing(false);
      setExecuting(false);
    }
  };

  if (!activeToken && loadingData) {
     // Loading State
     return null; // Or show loading spinner modal
  }

  const currentAPY = activeTab === 'supply' ? activeToken?.supplyAPY : activeToken?.borrowAPY;
  const healthFactor = 1.10; // Mock current health
  const nextHealthFactor = activeTab === 'supply' ? 1.25 : 1.05; // Mock impact

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
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-display font-bold text-white">Lending</h2>
                      <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                        Manage Assets
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
                
                {/* Tabs */}
                <div className="flex p-1 bg-zinc-900/80 border border-white/5 rounded-xl mb-4">
                  <button 
                    onClick={() => setActiveTab('supply')}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                      activeTab === 'supply' 
                        ? 'bg-white/10 text-white shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    Supply
                  </button>
                  <button 
                    onClick={() => setActiveTab('borrow')}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                      activeTab === 'borrow' 
                        ? 'bg-white/10 text-white shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    Borrow
                  </button>
                </div>

                {/* Input Area */}
                {activeToken && (
                  <DataInput
                    label="Amount"
                    balance={`Balance: ${activeToken.balance} ${activeToken.ticker}`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
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
                )}
                
                <div className="mt-2 text-xs text-zinc-600 px-1">
                  ~ $--.--
                </div>

                {/* Info Block */}
                <div className="py-2 flex items-center justify-between text-xs px-2 mt-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500">{activeTab === 'supply' ? 'Supply' : 'Borrow'} APY</span>
                      <span className="text-green-400 font-medium">{currentAPY?.toFixed(2)}%</span>
                    </div>
                     <div className="flex items-center gap-1">
                      <span className="text-zinc-500">Max LTV</span>
                      <span className="text-white font-medium">{(activeToken?.collateralFactor * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <Info className="w-3 h-3 text-zinc-600" />
                </div>

                {/* Action Button */}
                <div className="mt-auto pt-4">
                  <NeonButton onClick={() => setViewState('review')} disabled={!activeToken || !amount}>
                    {activeTab === 'supply' ? 'Supply Assets' : 'Borrow Assets'}
                  </NeonButton>
                </div>

              </div>
            </motion.div>
          )}

          {/* --- STATE 2: REVIEW --- */}
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
                 <h2 className="text-lg font-display font-bold text-white">Review Transaction</h2>
                 <button onClick={() => setViewState('input')} className="text-zinc-500 hover:text-white">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
              </div>

              <div className="px-6 pb-8 flex-1 flex flex-col relative z-10 overflow-y-auto custom-scrollbar">
                
                {/* Top Highlights */}
                <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-[10px] font-bold rounded border border-green-500/20 flex items-center gap-1">
                        <Check className="w-3 h-3" /> 
                        {activeTab === 'supply' ? 'Collateralized' : 'Monitoring Risk'}
                      </span>
                   </div>
                   <div className="text-xs text-zinc-500">
                     APY <span className="text-white font-medium">{currentAPY?.toFixed(2)}%</span>
                   </div>
                </div>

                {/* Main Details Card */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4 mb-4">
                   <div className="font-medium text-white text-sm mb-2">
                     {activeTab === 'supply' ? 'Supply' : 'Borrow'} {activeToken?.ticker}
                   </div>
                   
                   <div className="space-y-3 text-sm">
                       {/* Amount Row */}
                       <div className="flex justify-between">
                          <span className="text-zinc-500">Amount</span>
                          <span className="text-white font-mono font-medium">{amount} {activeToken?.ticker}</span>
                       </div>

                       {/* Health Factor Row */}
                       <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                          <div className="flex justify-between items-center">
                            <span className="text-zinc-500">Health Factor</span>
                            <span className={cn("font-mono font-medium", activeTab === 'supply' ? "text-green-400" : "text-orange-400")}>
                              {healthFactor.toFixed(2)} → {nextHealthFactor.toFixed(2)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full rounded-full transition-all", activeTab === 'supply' ? 'bg-green-500 w-[70%]' : 'bg-orange-500 w-[85%]')} 
                            />
                          </div>
                       </div>
                   </div>
                </div>

                {/* Secondary Info / Fees */}
                <div className="space-y-3 mb-6">
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-400">Collateral Enabled</span>
                      <Switch.Root 
                        checked={collateralEnabled}
                        onCheckedChange={setCollateralEnabled}
                        className={cn("w-8 h-5 rounded-full relative transition-colors", collateralEnabled ? 'bg-primary' : 'bg-zinc-700')}
                      >
                        <Switch.Thumb className={cn("block w-3 h-3 bg-white rounded-full transition-transform translate-x-1 translate-y-1 will-change-transform", collateralEnabled ? 'translate-x-4' : 'translate-x-1')} />
                      </Switch.Root>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Network Cost</span>
                      <span className="text-white font-mono">~ $0.15</span>
                   </div>
                </div>

                {executionError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-xs mb-4">
                    {executionError}
                  </div>
                )}

                {/* Final Button */}
                <div className="mt-auto relative">
                  <NeonButton 
                    onClick={handleAction} 
                    className={cn("w-full bg-white text-black hover:bg-zinc-200 shadow-none")}
                    disabled={preparing || executing}
                  >
                    {executing ? 'Executing...' : preparing ? 'Simulating...' : `Confirm ${activeTab === 'supply' ? 'Supply' : 'Borrow'}`}
                  </NeonButton>
                  
                  {(preparing || executing) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                       <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          )}

           {/* --- STATE 3: SUCCESS --- */}
           {viewState === 'success' && (
             <motion.div
               key="success"
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="flex flex-col h-full items-center justify-center p-6 text-center"
             >
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                   <Check className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Success!</h2>
                <p className="text-zinc-400 text-sm mb-8">
                  Your {activeTab} transaction has been processed.
                </p>
                <NeonButton onClick={onClose}>
                   Done
                </NeonButton>
             </motion.div>
           )}

          </AnimatePresence>

          {/* FOOTER POWERED BY */}
          <div className="py-8 relative z-10 flex items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
             <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shadow-lg shadow-black/50 border border-white/5">
               <Landmark className={cn("w-4 h-4", poweredBy.color)} />
             </div>
             <span className="text-sm font-medium text-zinc-400">Powered by {poweredBy.text}</span>
          </div>

          {/* TOKEN SELECTION MODAL */}
          <TokenSelectionModal 
            isOpen={showTokenList} 
            onClose={() => setShowTokenList(false)}
            onSelect={(token) => {
              setActiveToken(token);
              setShowTokenList(false);
            }}
            customTokens={uiTokens}
          />

        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
