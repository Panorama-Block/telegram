import { motion, AnimatePresence } from "framer-motion";
import {
  Landmark,
  X,
  ArrowLeft,
  Check,
  ChevronRight,
  Loader2
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DataInput } from "@/components/ui/DataInput";
import { cn } from "@/lib/utils";
import { TokenSelectionModal } from "@/components/TokenSelectionModal";

// Lending Hook
import { useLendingData } from "@/features/lending/useLendingData";
import { useLendingApi } from "@/features/lending/api";
import { LendingToken } from "@/features/lending/types";
import { useActiveAccount } from "thirdweb/react";

interface LendingProps {
  onClose: () => void;
  initialAmount?: string;
  initialAsset?: string;
  initialAction?: 'supply' | 'borrow';
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

export function Lending({ onClose, initialAmount, initialAsset, initialAction }: LendingProps) {
  const account = useActiveAccount();
  const { tokens, loading: loadingData, error: dataError } = useLendingData();
  const lendingApi = useLendingApi();

  const [viewState, setViewState] = useState<ViewState>('input');
  const [activeTab, setActiveTab] = useState<'supply' | 'borrow'>(initialAction || 'supply');
  const [showTokenList, setShowTokenList] = useState(false);

  const [amount, setAmount] = useState(initialAmount || "10.0");
  const [activeToken, setActiveToken] = useState<any>(null);
  const [initialAssetSet, setInitialAssetSet] = useState(false);

  // Execution State
  const [preparing, setPreparing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Initialize active token when data loads
  useEffect(() => {
    if (tokens.length > 0 && !initialAssetSet) {
      // Try to find the initial asset if specified
      let selectedToken = tokens[0];
      if (initialAsset) {
        const found = tokens.find(t =>
          t.symbol.toUpperCase() === initialAsset.toUpperCase()
        );
        if (found) selectedToken = found;
      }

      // Create UI-friendly token object
      setActiveToken({
        ticker: selectedToken.symbol,
        name: selectedToken.symbol, // API doesn't return name yet
        network: "Avalanche", // API defaults to 43114 (Avalanche) usually
        address: selectedToken.address,
        balance: "0.00", // Need user balance fetch
        decimals: selectedToken.decimals,
        supplyAPY: selectedToken.supplyAPY,
        borrowAPY: selectedToken.borrowAPY,
        collateralFactor: selectedToken.collateralFactor,
        icon: selectedToken.icon
      });
      setInitialAssetSet(true);
    }
  }, [tokens, initialAsset, initialAssetSet]);

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
    if (!activeToken) {
      setExecutionError('Select a token to continue.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setExecutionError('Enter a valid amount to continue.');
      return;
    }
    if (!account) {
      setExecutionError('Connect an EVM wallet to continue.');
      return;
    }

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

      console.log('[LENDING] API Response:', JSON.stringify(txData, null, 2));

      if (!txData || !txData.data) throw new Error("Failed to prepare transaction - no response");

      setPreparing(false);
      setExecuting(true);

      // API returns two transactions: validation (tax) + supply/borrow
      // Structure: { data: { validation: {...}, supply: {...} } }
      const validationTx = txData.data.validation;
      const actionTx = txData.data.supply || txData.data.borrow;

      // Step 1: Execute validation transaction (if exists)
      if (validationTx?.to && validationTx?.data) {
        console.log('[LENDING] Executing validation transaction...');
        await lendingApi.executeTransaction({
          to: validationTx.to,
          data: validationTx.data,
          value: validationTx.value || '0',
          gas: validationTx.gas,
          gasPrice: validationTx.gasPrice
        });
        console.log('[LENDING] Validation transaction completed!');
      }

      // Step 2: Execute the main action (supply/borrow)
      if (actionTx?.to && actionTx?.data) {
        console.log('[LENDING] Executing main transaction...');
        await lendingApi.executeTransaction({
          to: actionTx.to,
          data: actionTx.data,
          value: actionTx.value || '0',
          gas: actionTx.gas,
          gasPrice: actionTx.gasPrice
        });
        console.log('[LENDING] Main transaction completed!');
      } else {
        throw new Error('No valid supply/borrow transaction in API response');
      }

      setExecuting(false);
      setViewState('success');
      setTxHash("0x...");

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center pt-4 md:pt-0 p-4 pb-20 md:pb-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
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
          className="w-full shadow-2xl overflow-hidden relative bg-[#0A0A0A] border-white/10 max-h-[70vh] md:max-h-[85vh] md:h-[520px] flex flex-col rounded-2xl border pb-safe overflow-y-auto"
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
              <div className="px-6 py-4 flex items-center justify-between relative z-10 shrink-0">
                 <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-display font-bold text-white">Lending</h2>
                      <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                        Manage Assets
                      </div>
                    </div>
                 </div>
                 <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                 </button>
              </div>

              <div className="px-6 pb-4 relative z-10 flex-1 flex flex-col justify-center">

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
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    rightElement={
                      <button
                        onClick={() => setShowTokenList(true)}
                        className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2.5 sm:px-3 py-1.5 sm:py-2 min-h-[40px] sm:min-h-[44px] hover:bg-zinc-900 active:bg-zinc-800 transition-colors group"
                      >
                        {activeToken.icon ? (
                          <img src={activeToken.icon} alt={activeToken.ticker} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover" />
                        ) : (
                          <div className={cn("w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-white text-[9px] sm:text-[10px] font-bold", getTokenColor(activeToken))}>
                            {activeToken.ticker[0]}
                          </div>
                        )}
                        <span className="text-white font-medium text-sm sm:text-base">{activeToken.ticker}</span>
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </button>
                    }
                  />
                )}

                {/* Action Button */}
                <div className="pt-6">
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
              <div className="px-6 py-4 flex items-center justify-between relative z-10 shrink-0">
                 <h2 className="text-lg font-display font-bold text-white">Review Transaction</h2>
                 <button onClick={() => setViewState('input')} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
              </div>

              <div className="px-6 pb-4 flex-1 flex flex-col relative z-10 justify-center">

                {/* Main Details Card - Centered */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6 space-y-4">
                   <div className="flex items-center justify-center gap-2 mb-2">
                     {activeToken?.icon ? (
                       <img src={activeToken.icon} alt={activeToken.ticker} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover" />
                     ) : (
                       <div className={cn("w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold", getTokenColor(activeToken))}>
                         {activeToken?.ticker?.[0]}
                       </div>
                     )}
                     <span className="font-medium text-white text-sm sm:text-base">
                       {activeTab === 'supply' ? 'Supply' : 'Borrow'} {activeToken?.ticker}
                     </span>
                   </div>

                   <div className="space-y-3 text-sm">
                       {/* Amount Row */}
                       <div className="flex justify-between items-center py-2">
                          <span className="text-zinc-500">Amount</span>
                          <span className="text-white font-mono font-medium text-base sm:text-lg">{amount} {activeToken?.ticker}</span>
                       </div>
                   </div>
                </div>

                {executionError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-xs mt-4">
                    {executionError}
                  </div>
                )}

                {/* Final Button */}
                <div className="pt-6 relative">
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
          <div className="py-4 relative z-10 flex items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-opacity shrink-0">
             <img src="/miniapp/icons/benqui_logo.png" alt="Benqi" className="w-6 h-6 rounded-full" />
             <span className="text-xs font-medium text-zinc-400">Powered by {poweredBy.text}</span>
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
