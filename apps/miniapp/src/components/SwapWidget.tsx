import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftRight } from "lucide-react";
import { 
  X, 
  ArrowDown, 
  Settings, 
  Info, 
  Check, 
  ChevronRight,
  Triangle,
  ArrowLeft
} from "lucide-react";
import * as Switch from '@radix-ui/react-switch';
import { useState, useMemo, useEffect, useRef } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DataInput } from "@/components/ui/DataInput";
import { cn } from "@/lib/utils";
import { TokenSelectionModal } from "@/components/TokenSelectionModal";
import { SettingsPopover } from "@/components/SettingsPopover";

// API Integration
import { swapApi, SwapApiError } from "@/features/swap/api";
import { 
  normalizeToApi, 
  formatAmountHuman, 
  parseAmountToWei,
  getTokenDecimals,
  isNative
} from "@/features/swap/utils";
import { safeExecuteTransactionV2 } from "@/shared/utils/transactionUtilsV2";
import { useActiveAccount } from "thirdweb/react";
import { prepareTransaction, sendTransaction, createThirdwebClient, defineChain } from "thirdweb";
import { THIRDWEB_CLIENT_ID } from "@/shared/config/thirdweb";

interface SwapWidgetProps {
  onClose: () => void;
  initialFromToken?: any;
  initialToToken?: any;
}

type ViewState = 'input' | 'routing' | 'details' | 'confirm';

// Helper to get color based on network/token
const getTokenColor = (token: any) => {
  if (!token?.network) return 'bg-zinc-500';
  if (token.network === 'Avalanche') return 'bg-red-500';
  if (token.network === 'Base') return 'bg-blue-500';
  if (token.network === 'Binance Smart Chain' || token.network === 'BSC') return 'bg-yellow-500';
  if (token.network === 'Optimism') return 'bg-red-500';
  if (token.network === 'Polygon') return 'bg-purple-500';
  if (token.network === 'Arbitrum') return 'bg-blue-600';
  if (token.network === 'World Chain') return 'bg-zinc-500';
  if (token.ticker === 'CONF') return 'bg-orange-500';
  if (token.ticker === 'USDC') return 'bg-blue-400';
  return 'bg-zinc-500';
};

const DEFAULT_SELL_TOKEN = { ticker: "CONF", name: "Confraria", network: "World Chain", address: "0xf1e7adc9c1743cd2c6cea47d0ca43fad57190616", balance: "0.00" };
const DEFAULT_BUY_TOKEN = { ticker: "ETH", name: "Ethereum", network: "Base", address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", balance: "0.00" };

const getBaseChainId = (networkName: string): number => {
  switch (networkName) {
    case 'Avalanche': return 43114;
    case 'Base': return 8453;
    case 'Binance Smart Chain': return 56;
    case 'BSC': return 56;
    case 'Optimism': return 10;
    case 'Polygon': return 137;
    case 'Arbitrum': return 42161;
    case 'Ethereum': return 1;
    case 'World Chain': return 480;
    default: return 8453; // Default Base
  }
};

export function SwapWidget({ onClose, initialFromToken, initialToToken }: SwapWidgetProps) {
  const account = useActiveAccount();
  const clientId = THIRDWEB_CLIENT_ID;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);

  const [viewState, setViewState] = useState<ViewState>('input');
  const [showTokenList, setShowTokenList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  
  // Token State
  const [activeSlot, setActiveSlot] = useState<'sell' | 'buy'>('sell');
  const [sellToken, setSellToken] = useState(initialFromToken || DEFAULT_SELL_TOKEN);
  const [buyToken, setBuyToken] = useState(initialToToken || DEFAULT_BUY_TOKEN);
  const [amount, setAmount] = useState<string>("10"); // Default small amount
  
  // Quote State
  const [quote, setQuote] = useState<any>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const quoteRequestRef = useRef(0);

  // Execution State
  const [preparing, setPreparing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [txHashes, setTxHashes] = useState<Array<{ hash: string; chainId: number }>>([]);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const isCrossChain = sellToken.network !== buyToken.network;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Effects
  useEffect(() => {
    if (initialFromToken) setSellToken(initialFromToken);
    if (initialToToken) setBuyToken(initialToToken);
  }, [initialFromToken, initialToToken]);

  const canQuote = useMemo(() => {
    return Boolean(sellToken && buyToken && amount && Number(amount) > 0);
  }, [sellToken, buyToken, amount]);

  // Quote Logic
  useEffect(() => {
    const requestId = ++quoteRequestRef.current;
    
    if (!canQuote) {
      setQuote(null);
      setQuoting(false);
      return;
    }

    setQuote(null);
    setQuoteError(null);

    const timer = setTimeout(() => {
       void performQuote(requestId);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [canQuote, sellToken, buyToken, amount, account]);

  async function performQuote(requestId: number) {
     if (!canQuote) return;
     
     try {
       setQuoting(true);
       const fromChainId = getBaseChainId(sellToken.network);
       const toChainId = getBaseChainId(buyToken.network);
       const userAddress = account?.address || localStorage.getItem('userAddress') || '';

       const body = {
         fromChainId,
         toChainId,
         fromToken: normalizeToApi(sellToken.address || 'native'),
         toToken: normalizeToApi(buyToken.address || 'native'),
         amount: amount.trim(),
         smartAccountAddress: userAddress,
       };

       console.log("Fetching quote...", body);
       const res = await swapApi.quote(body);
       
       if (quoteRequestRef.current !== requestId) return;

       if (!res.success || !res.quote) {
         throw new Error(res.message || 'Failed to get quote');
       }

       setQuote(res.quote);
       // Navigate to routing if not already there, but usually we just show price
       // Maybe we just show preview in input state first
     } catch (e: any) {
        if (quoteRequestRef.current !== requestId) return;
        console.error("Quote error:", e);
        setQuoteError(e.message || "Unable to fetch quote");
     } finally {
        if (quoteRequestRef.current === requestId) {
          setQuoting(false);
        }
     }
  }

  // Execution Logic
  async function handleSwap() {
    if (!quote || !client || !account) return;
    
    setPreparing(true);
    setExecutionError(null);
    setTxHashes([]);

    try {
      const fromChainId = getBaseChainId(sellToken.network);
      const toChainId = getBaseChainId(buyToken.network);
      
      // Get decimals to convert amount to wei
      const decimals = await getTokenDecimals({ 
        client, 
        chainId: fromChainId, 
        token: sellToken.address 
      }).catch(() => 18);

      const wei = parseAmountToWei(amount, decimals);

      // Prepare tx
      const prep = await swapApi.prepare({
         fromChainId,
         toChainId,
         fromToken: normalizeToApi(sellToken.address),
         toToken: normalizeToApi(buyToken.address),
         amount: wei.toString(),
         sender: account.address
      });

      if (!prep.prepared || (!prep.prepared.transactions && !prep.prepared.steps)) {
        throw new Error("No transactions returned by prepare");
      }

      setPreparing(false);
      setExecuting(true);

      // Flatten transactions
      const txs: any[] = [];
      if (prep.prepared.transactions) txs.push(...prep.prepared.transactions);
      if (prep.prepared.steps) {
        for (const s of prep.prepared.steps) {
          txs.push(...s.transactions);
        }
      }

      const hashes: Array<{ hash: string, chainId: number }> = [];

      for (const t of txs) {
        if (t.chainId !== fromChainId) {
             // If multi-chain execution needed (not supported by simple flow yet)
             console.warn("Cross-chain execution step mismatch", t);
        }
        
        const transaction = prepareTransaction({
          to: t.to,
          chain: defineChain(t.chainId),
          client,
          data: t.data,
          value: t.value ? BigInt(t.value) : 0n,
          gas: t.gasLimit ? BigInt(t.gasLimit) : undefined,
        });

        const result = await safeExecuteTransactionV2(async () => {
           return await sendTransaction({ account, transaction });
        });

        if (!result.success || !result.transactionHash) {
          throw new Error(result.error || "Transaction failed");
        }

        hashes.push({ hash: result.transactionHash, chainId: t.chainId });
      }

      setTxHashes(hashes);
      // Success handled by UI showing hashes

    } catch (e: any) {
      console.error("Swap execution error:", e);
      setExecutionError(e.message || "Swap failed");
    } finally {
      setPreparing(false);
      setExecuting(false);
    }
  }

  // Formatting View Data
  const estimatedOutput = useMemo(() => {
    if (!quote) return "0.00";
    try {
       // We don't know output decimals yet easily, usually 18 or 6. 
       // Ideally we fetch it or use the one from quote if provided (backend often parses it)
       // The backend quote returns estimatedReceiveAmount in wei.
       return formatAmountHuman(BigInt(quote.estimatedReceiveAmount), 18, 5); // Assuming 18 for now or backend adjusted
    } catch {
       return "0.00";
    }
  }, [quote]);

  // Handlers
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
  };

  const modalVariants = {
    initial: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
    animate: isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 },
    exit: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
  };

  const needsApproval = false; // TODO: Check allowence if ERC20

  const primaryLabel = executing ? "Swapping..." : preparing ? "Preparing..." : "Confirm Swap";

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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                {/* Header */}
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
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    rightElement={
                      <button 
                        onClick={() => openTokenList('sell')}
                        className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-1.5 hover:bg-zinc-900 transition-colors group"
                      >
                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold", getTokenColor(sellToken))}>
                          {sellToken.ticker?.[0]}
                        </div>
                        <span className="text-white font-medium">{sellToken.ticker}</span>
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </button>
                    }
                  />

                  <div className="flex justify-center -my-3 relative z-20">
                    <button 
                      onClick={() => {
                        const temp = sellToken;
                        setSellToken(buyToken);
                        setBuyToken(temp);
                        setQuote(null);
                      }}
                      className="bg-[#0A0A0A] border border-white/10 p-2 rounded-xl text-zinc-400 hover:text-primary hover:border-primary/50 transition-all"
                    >
                      <ArrowDown className="w-5 h-5" />
                    </button>
                  </div>

                  <DataInput
                    label="Buy"
                    balance={`${buyToken.balance} ${buyToken.ticker}`}
                    value={quoting ? "..." : estimatedOutput}
                    readOnly
                    rightElement={
                      <button 
                        onClick={() => openTokenList('buy')}
                        className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-1.5 hover:bg-zinc-900 transition-colors group"
                      >
                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold", getTokenColor(buyToken))}>
                           {buyToken.ticker?.[0]}
                        </div>
                        <span className="text-white font-medium">{buyToken.ticker}</span>
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </button>
                    }
                  />

                  {/* Quote Error */}
                  {quoteError && (
                    <div className="text-red-400 text-xs px-2 mt-2">
                       {quoteError}
                    </div>
                  )}

                  <div className="mt-auto pt-6 space-y-4">
                    <NeonButton 
                      onClick={() => setViewState('routing')} 
                      disabled={!quote || quoting}
                    >
                      {quoting ? "Fetching best price..." : "Review Swap"}
                    </NeonButton>

                    <div className="text-center text-[10px] text-zinc-500 leading-relaxed">
                      Buy and sell crypto on 15+ networks including Ethereum, Base, and Arbitrum
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- 2. ROUTING / DETAILS STATE --- */}
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
                              <span className="text-zinc-300 font-mono">{amount} {sellToken.ticker}</span>
                           </div>
                           <div className="flex justify-between">
                              <span className="text-zinc-500">Expected Amount Out</span>
                              <span className="text-white font-mono font-medium">{estimatedOutput} {buyToken.ticker}</span>
                           </div>
                           <div className="flex justify-between">
                              <span className="text-zinc-500">Network Fee</span>
                              <span className="text-zinc-300 font-mono">
                                 {quote?.fees?.totalFee ? formatAmountHuman(BigInt(quote.fees.totalFee), 18, 6) : '~ $0.05'}
                              </span>
                           </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto flex gap-3">
                       <button 
                         onClick={() => setViewState('input')}
                         className="flex-1 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors"
                       >
                         Back
                       </button>
                       <NeonButton onClick={() => setViewState('confirm')} className="flex-1 bg-white text-black hover:bg-zinc-200 shadow-none">
                         Continue
                       </NeonButton>
                    </div>
                 </div>
              </motion.div>
            )}

            {viewState === 'confirm' && (
               <motion.div 
                key="confirm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                 <div className="p-6 flex items-center justify-between relative z-10">
                   <h2 className="text-lg font-display font-bold text-white">Confirm Swap</h2>
                   <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                 </div>

                 <div className="px-6 pb-8 flex-1 flex flex-col relative z-10">
                    
                    {txHashes.length > 0 ? (
                       <div className="flex flex-col items-center justify-center flex-1 space-y-4">
                          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                             <Check className="w-8 h-8 text-green-500" />
                          </div>
                          <h3 className="text-xl font-bold text-white">Swap Submitted!</h3>
                          <div className="text-zinc-400 text-center text-sm max-w-xs">
                             Your transaction has been submitted to the blockchain.
                          </div>
                          <div className="space-y-2 w-full pt-4">
                             {txHashes.map((h, i) => (
                               <a 
                                 key={i}
                                 href={`https://basescan.org/tx/${h.hash}`} 
                                 target="_blank" 
                                 rel="noreferrer"
                                 className="block w-full text-center py-2 bg-white/5 rounded-lg text-primary text-xs hover:bg-white/10 truncate px-4"
                               >
                                 View TX: {h.hash.slice(0, 10)}...
                               </a>
                             ))}
                          </div>
                          <button onClick={onClose} className="mt-8 text-zinc-400 hover:text-white">
                             Close
                          </button>
                       </div>
                    ) : (
                      <>
                        <p className="text-sm text-zinc-400 mb-6">
                            Please review the final details before executing.
                        </p>

                        <div className="space-y-4 mb-8">
                             <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                <span className="text-sm text-zinc-300">I agree to <span className="text-white underline decoration-zinc-500">Terms of Service</span></span>
                                <Switch.Root 
                                    checked={tosAccepted}
                                    onCheckedChange={setTosAccepted}
                                    className={cn("w-10 h-6 rounded-full relative transition-colors", tosAccepted ? 'bg-primary' : 'bg-zinc-700')}
                                >
                                    <Switch.Thumb className={cn("block w-4 h-4 bg-white rounded-full transition-transform translate-x-1 will-change-transform", tosAccepted ? 'translate-x-5' : 'translate-x-1')} />
                                </Switch.Root>
                            </div>
                        </div>

                        {executionError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-xs mb-4">
                                {executionError}
                            </div>
                        )}

                        <div className="mt-auto">
                            {!account ? (
                                <div className="text-center p-4 bg-orange-500/10 rounded-xl border border-orange-500/20 text-orange-200 mb-2">
                                    Wallet not connected
                                </div>
                            ) : (
                                <NeonButton 
                                    onClick={handleSwap}
                                    className={cn("bg-white text-black hover:bg-zinc-200 shadow-none", (!tosAccepted) && "opacity-50 cursor-not-allowed")}
                                    disabled={!tosAccepted || executing || preparing}
                                >
                                    {primaryLabel}
                                </NeonButton>
                            )}
                            <button 
                                onClick={() => setViewState('routing')}
                                className="w-full mt-3 text-sm text-zinc-500 hover:text-white"
                                disabled={executing}
                            >
                                Cancel
                            </button>
                        </div>
                      </>
                    )}
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
