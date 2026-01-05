import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList,
  X,
  ChevronDown,
  ArrowLeft,
  Fuel,
  Clock,
  Trash2,
  Power,
  PowerOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Wallet,
  Plus,
  Search
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DataInput } from "@/components/ui/DataInput";
import { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useActiveAccount } from "thirdweb/react";
import Image from "next/image";

// Import DCA API functions
import {
  getUserAccounts,
  createSmartAccount,
  createStrategy,
  getAccountStrategies,
  toggleStrategy as apiToggleStrategy,
  deleteStrategy as apiDeleteStrategy,
  SmartAccount,
  DCAStrategy,
  DCAApiError
} from "@/features/dca/api";
import { swapApi } from "@/features/swap/api";
import { normalizeToApi } from "@/features/swap/utils";
import { TokenSelectionModal } from "@/components/TokenSelectionModal";

// Import token data
import { networks, Token } from "@/features/swap/tokens";

interface DCAProps {
  onClose: () => void;
}

type ViewState = 'input' | 'review' | 'active' | 'confirming-cancel' | 'creating-account' | 'select-from-token' | 'select-to-token';
type FrequencyType = 'Daily' | 'Weekly' | 'Monthly';

// Map frequency to interval for API
const frequencyToInterval: Record<FrequencyType, 'daily' | 'weekly' | 'monthly'> = {
  'Daily': 'daily',
  'Weekly': 'weekly',
  'Monthly': 'monthly'
};

// Frequency descriptions
const frequencyDescriptions: Record<FrequencyType, string> = {
  'Daily': 'Every day',
  'Weekly': 'Every week',
  'Monthly': 'Every month'
};

// Get all tokens from all networks (deduplicated by symbol)
function getAllTokens(): Token[] {
  const tokenMap = new Map<string, Token>();
  
  // Prioritize Ethereum
  const ethereumNetwork = networks.find(n => n.chainId === 1);
  if (ethereumNetwork) {
    ethereumNetwork.tokens.forEach(token => {
      tokenMap.set(token.symbol, { ...token, chainId: 1 });
    });
  }
  
  networks.forEach(network => {
    network.tokens.forEach(token => {
      if (!tokenMap.has(token.symbol)) {
        tokenMap.set(token.symbol, { ...token, chainId: network.chainId });
      }
    });
  });
  
  return Array.from(tokenMap.values());
}

// Token icon component
function TokenIcon({ symbol, icon, size = 24 }: { symbol: string; icon?: string; size?: number }) {
  if (!icon) {
    return (
      <div 
        className="rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ width: size, height: size }}
      >
        {symbol?.charAt(0) || '?'}
      </div>
    );
  }
  
  return (
    <Image
      src={icon}
      alt={symbol}
      width={size}
      height={size}
      className="rounded-full shrink-0"
      unoptimized
    />
  );
}

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
    default: return 1;
  }
};

// Calculate next purchase date (Relative to NOW)
function calculateNextPurchase(frequency: FrequencyType): Date {
  const now = new Date();
  const next = new Date(now);
  
  if (frequency === 'Daily') {
    next.setDate(next.getDate() + 1);
  } else if (frequency === 'Weekly') {
    next.setDate(next.getDate() + 7);
  } else if (frequency === 'Monthly') {
    next.setMonth(next.getMonth() + 1);
  }
  
  return next;
}

// Format date/time for display
function formatDateTime(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const timeStr = `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  
  if (targetDay.getTime() === today.getTime()) {
    return `Today at ${timeStr}`;
  } else if (targetDay.getTime() === tomorrow.getTime()) {
    return `Tomorrow at ${timeStr}`;
  }
  
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()} at ${timeStr}`;
}

function timestampToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

function getTokenBySymbol(symbol: string): Token | undefined {
  return getAllTokens().find(t => t.symbol === symbol);
}

export function DCA({ onClose }: DCAProps) {
  const [viewState, setViewState] = useState<ViewState>('input');
  const [frequency, setFrequency] = useState<FrequencyType>("Daily");
  const [intervalValue, setIntervalValue] = useState<number>(1);
  const [buyAmount, setBuyAmount] = useState<string>("0.1");
  const [payAmount, setPayAmount] = useState<string>("200.00");
  // State for Tokens (Full Objects)
  const [fromToken, setFromToken] = useState<Token>({ 
      symbol: 'ETH', 
      address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 
      decimals: 18, 
      name: 'Ethereum', 
      chainId: 1 
  });
  const [toToken, setToToken] = useState<Token>({ 
      symbol: 'USDC', 
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 
      decimals: 6, 
      name: 'USD Coin', 
      chainId: 1 
  });

  const [showTokenModal, setShowTokenModal] = useState(false);
  const [activeTokenSlot, setActiveTokenSlot] = useState<'from' | 'to'>('from');
  const [activeInput, setActiveInput] = useState<'buy' | 'pay' | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  
  // Smart accounts
  
  // Smart accounts
  const [smartAccounts, setSmartAccounts] = useState<SmartAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SmartAccount | null>(null);
  const [newAccountName, setNewAccountName] = useState("My DCA Wallet");
  
  // Active strategies
  const [strategies, setStrategies] = useState<DCAStrategy[]>([]);
  const [strategyToCancel, setStrategyToCancel] = useState<DCAStrategy | null>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get connected wallet
  const account = useActiveAccount();
  const userId = account?.address?.toLowerCase();

  // Determine effective tokens (Directly from state now)
  const fromTokenData = fromToken;
  const toTokenData = toToken;

  // Responsive variants
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const modalVariants = {
    initial: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
    animate: isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 },
    exit: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
  };

  // Calculate next purchase
  const nextPurchaseDate = useMemo(() => {
    // Basic calculation based on frequency and intervalValue
    const now = new Date();
    const next = new Date();
    next.setHours(9, 0, 0, 0);
    
    // If it's already past 9 AM, start counting from tomorrow
    if (now.getHours() >= 9) {
      next.setDate(next.getDate() + 1);
    }

    // Apply interval multiplier logic (simplified for UI)
    // Note: The backend enforces specific intervals, so this is mostly visual for now
    // unless we update backend to support custom intervals
    
    if (frequency === 'Daily') {
       // e.g. every 3 days
       if (intervalValue > 1) {
         next.setDate(next.getDate() + (intervalValue - 1));
       }
    } else if (frequency === 'Weekly') {
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
      next.setDate(now.getDate() + daysUntilMonday);
      if (intervalValue > 1) {
        next.setDate(next.getDate() + ((intervalValue - 1) * 7));
      }
    } else if (frequency === 'Monthly') {
      next.setMonth(next.getMonth() + intervalValue);
      next.setDate(1);
    }
    
    return next;
  }, [frequency, intervalValue]);
  const nextPurchaseText = useMemo(() => formatDateTime(nextPurchaseDate), [nextPurchaseDate]);

  // Quote Effect
  useEffect(() => {
    const fetchQuote = async () => {
      // Don't quote if missing data or typing
      if (!fromTokenData || !toTokenData || !activeInput) return;
      
      // Source = Paying with (toToken state)
      // Target = Buying (fromToken state)
      const sourceToken = toTokenData; 
      const targetToken = fromTokenData;
      
      // Validate Chain IDs
      if (sourceToken.chainId === undefined || targetToken.chainId === undefined) {
        console.warn("Missing chainId for selected tokens");
        return;
      }
      
      setIsQuoting(true);
      try {
        if (activeInput === 'pay') {
          // User editing Pay Amount (USDC)
          // We want to know how much ETH we get
          if (!payAmount || parseFloat(payAmount) === 0) {
             setBuyAmount("0");
             return;
          }
          
          const res = await swapApi.quote({
            fromToken: normalizeToApi(sourceToken.address),
            toToken: normalizeToApi(targetToken.address),
            amount: payAmount,
            fromChainId: sourceToken.chainId,
            toChainId: targetToken.chainId
          });
          
          if (res.success && res.quote && res.quote.amountHuman) {
            // Update Buy Amount
            setBuyAmount(parseFloat(res.quote.amountHuman).toPrecision(6));
          }
        } else if (activeInput === 'buy') {
          // User editing Buy Amount (ETH)
          // We want to know how much USDC it costs
          if (!buyAmount || parseFloat(buyAmount) === 0) {
             setPayAmount("0");
             return;
          }

          // Estimate price: Sell 1 unit of Target -> Source gives "Price"
          const res = await swapApi.quote({
            fromToken: normalizeToApi(targetToken.address),
            toToken: normalizeToApi(sourceToken.address),
            amount: "1",
            fromChainId: targetToken.chainId,
            toChainId: sourceToken.chainId
          });
          
          if (res.success && res.quote && res.quote.amountHuman) {
             const price = parseFloat(res.quote.amountHuman);
             const cost = parseFloat(buyAmount) * price;
             setPayAmount(cost.toFixed(2));
          }
        }
      } catch (error) {
         console.warn("Quote failed", error);
      } finally {
         setIsQuoting(false);
      }
    };

    const timer = setTimeout(fetchQuote, 600);
    return () => clearTimeout(timer);
  }, [activeInput, buyAmount, payAmount, fromTokenData, toTokenData]);

  // Load smart accounts on mount
  useEffect(() => {
    async function loadAccounts() {
      if (!userId) {
        setIsLoadingAccounts(false);
        return;
      }
      
      try {
        setIsLoadingAccounts(true);
        const accounts = await getUserAccounts(userId);
        setSmartAccounts(accounts);
        
        if (accounts.length > 0) {
          setSelectedAccount(accounts[0]);
        }
      } catch (err: any) {
        console.error('Error loading smart accounts:', err.message);
        // Show user-friendly error
        if (err.message?.includes('not valid JSON') || err.message?.includes('DOCTYPE') || err.message?.includes('unavailable')) {
          setError('DCA Service is starting up. Please try again in a moment.');
        } else {
          setError(err instanceof DCAApiError ? err.message : 'Failed to load accounts');
        }
      } finally {
        setIsLoadingAccounts(false);
      }
    }
    
    loadAccounts();
  }, [userId]);

  // Load strategies when account is selected
  useEffect(() => {
    async function loadStrategies() {
      if (!selectedAccount || !userId) return;
      
      try {
        setIsLoadingStrategies(true);
        const accountStrategies = await getAccountStrategies(selectedAccount.address, userId);
        setStrategies(accountStrategies);
      } catch (err) {
        console.error('Error loading strategies:', err);
      } finally {
        setIsLoadingStrategies(false);
      }
    }
    
    loadStrategies();
  }, [selectedAccount, userId]);

  // Handle token selection
  const handleSelectToken = useCallback((token: any) => {
    // token is UiToken from Modal
    const chainId = getBaseChainId(token.network);
    
    const selectedToken: Token = {
       symbol: token.ticker,
       address: token.address,
       name: token.name,
       decimals: 18, // Default, updated by quote if possible
       chainId: chainId,
       icon: token.icon
    };

    if (activeTokenSlot === 'from') {
       setFromToken(selectedToken);
    } else {
       setToToken(selectedToken);
    }
    // Trigger quote update logic via effect dependencies
    setShowTokenModal(false);
  }, [activeTokenSlot]);

  // Create smart account
  const handleCreateAccount = useCallback(async () => {
    if (!userId) {
      setError('Please connect your wallet first');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await createSmartAccount({
        userId,
        name: newAccountName,
        permissions: {
          approvedTargets: ['*'],
          nativeTokenLimit: '1.0',
          durationDays: 30
        }
      });
      
      const accounts = await getUserAccounts(userId);
      setSmartAccounts(accounts);
      
      const newAccount = accounts.find(a => a.address === result.smartAccountAddress);
      if (newAccount) {
        setSelectedAccount(newAccount);
      }
      
      setViewState('input');
    } catch (err) {
      console.error('Error creating smart account:', err);
      setError(err instanceof DCAApiError ? err.message : 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  }, [userId, newAccountName]);

  // Create strategy
  const handleCreateStrategy = useCallback(async () => {
    if (!selectedAccount || !userId) {
      setError('Please select a smart account first');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // In DCA: source is what we pay (toToken state - USDC)
      // target is what we buy (fromToken state - ETH)
      const sourceAddress = toTokenData?.address || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      const targetAddress = fromTokenData?.address || '0x0000000000000000000000000000000000000000';
      
      const sourceChainId = toTokenData?.chainId;
      const targetChainId = fromTokenData?.chainId;
         
      if (sourceChainId === undefined || targetChainId === undefined) {
         setError("Invalid token configuration: missing chain ID");
         setIsLoading(false);
         return;
      }

      await createStrategy({
        smartAccountId: selectedAccount.address,
        fromToken: sourceAddress, // Source Token (sold)
        toToken: targetAddress,   // Target Token (bought)
        fromChainId: sourceChainId,
        toChainId: targetChainId,
        amount: payAmount, // Amount of Source Token to sell (DCA usually fixed Input)
        interval: frequencyToInterval[frequency]
      }, userId);
      
      const updatedStrategies = await getAccountStrategies(selectedAccount.address, userId);
      setStrategies(updatedStrategies);
      
      setViewState('active');
    } catch (err) {
      console.error('Error creating strategy:', err);
      setError(err instanceof DCAApiError ? err.message : 'Failed to create strategy');
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccount, userId, fromTokenData, toTokenData, payAmount, frequency]);

  // Toggle strategy
  const handleToggleStrategy = useCallback(async (strategy: DCAStrategy) => {
    if (!strategy.strategyId || !userId) return;
    
    setIsLoading(true);
    
    try {
      await apiToggleStrategy(strategy.strategyId, !strategy.isActive, userId);
      
      setStrategies(prev => prev.map(s => 
        s.strategyId === strategy.strategyId ? { ...s, isActive: !s.isActive } : s
      ));
    } catch (err) {
      console.error('Error toggling strategy:', err);
      setError(err instanceof DCAApiError ? err.message : 'Failed to toggle strategy');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Cancel strategy
  const handleCancelStrategy = useCallback(async (strategy: DCAStrategy) => {
    if (!strategy.strategyId || !userId) return;
    
    setIsLoading(true);
    
    try {
      await apiDeleteStrategy(strategy.strategyId, userId);
      
      setStrategies(prev => prev.filter(s => s.strategyId !== strategy.strategyId));
      
      setStrategyToCancel(null);
      setViewState(strategies.length <= 1 ? 'input' : 'active');
    } catch (err) {
      console.error('Error cancelling strategy:', err);
      setError(err instanceof DCAApiError ? err.message : 'Failed to cancel strategy');
    } finally {
      setIsLoading(false);
    }
  }, [userId, strategies.length]);

  // In demo mode or when backend unavailable, don't require account creation
  const needsAccount = !isLoadingAccounts && smartAccounts.length === 0;



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
        className="w-full md:max-w-[480px] fixed bottom-0 md:relative md:bottom-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard className="w-full shadow-2xl overflow-hidden relative bg-[#0A0A0A] border-white/10 h-[92vh] md:max-h-[85vh] md:h-auto md:min-h-[600px] flex flex-col rounded-t-3xl rounded-b-none md:rounded-2xl border-b-0 md:border-b pb-safe">

          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-primary/10 blur-[60px] pointer-events-none" />

          <div className="md:hidden w-full flex justify-center pt-3 pb-1 shrink-0 z-20 relative">
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
          </div>

          {/* Error Toast */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 left-4 right-4 z-50 bg-red-500/20 border border-red-500/30 rounded-xl p-3 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-red-400 text-sm flex-1">{error}</span>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* --- LOADING STATE --- */}




            {/* --- CREATING ACCOUNT --- */}
            {viewState === 'creating-account' && (
              <motion.div
                key="creating-account"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                <div className="p-6 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setViewState('input')}
                      className="p-2 -ml-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-lg font-display font-bold text-white">Create Smart Wallet</h2>
                  </div>
                  <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-6 pb-8 flex-1 flex flex-col space-y-6">
                  <DataInput
                    label="Wallet Name"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="My DCA Wallet"
                  />

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-500">Session Duration</span>
                      <span className="text-white font-medium">30 days</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-500">Max per Transaction</span>
                      <span className="text-white font-medium">1.0 ETH</span>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <NeonButton 
                      onClick={handleCreateAccount}
                      disabled={isLoading || !newAccountName.trim()}
                      className="bg-white text-black hover:bg-zinc-200 shadow-none w-full disabled:opacity-50"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </span>
                      ) : (
                        'Create Wallet'
                      )}
                    </NeonButton>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- TOKEN SELECTION MODAL --- */}
            <TokenSelectionModal 
              isOpen={showTokenModal} 
              onClose={() => setShowTokenModal(false)} 
              onSelect={handleSelectToken}
            />

            {/* --- INPUT STATE --- */}
            {viewState === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                <div className="p-6 flex items-center justify-between relative z-10">
                   <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-display font-bold text-white">DCA Strategy</h2>
                        <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                          Automated buying
                        </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                     {strategies.length > 0 && (
                       <button 
                         onClick={() => setViewState('active')}
                         className="px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded-full hover:bg-cyan-400/20 transition-colors"
                       >
                         {strategies.length} Active
                       </button>
                     )}
                     <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                     </button>
                   </div>
                </div>

                <div className="px-6 pb-24 space-y-6 relative z-10 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                  
                  {/* Buy Amount with Token Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-500">I want to buy</label>
                    <div className="relative flex items-center bg-black/40 border border-white/5 rounded-xl focus-within:border-cyan-500/50 transition-colors">
                      <input
                        type="text"
                        value={buyAmount}
                        onChange={(e) => {
                          setBuyAmount(e.target.value);
                          setActiveInput('buy');
                        }}
                        onFocus={() => setActiveInput('buy')}
                        className="flex-1 bg-transparent border-none outline-none p-4 text-white placeholder-zinc-600 font-mono text-lg w-full"
                        placeholder="0.0"
                      />
                      <button 
                        onClick={() => { setActiveTokenSlot('from'); setShowTokenModal(true); }}
                        className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-1.5 mr-3 hover:bg-zinc-900 transition-colors"
                      >
                        <TokenIcon symbol={fromToken.symbol} icon={fromToken.icon} size={24} />
                        <span className="text-white font-medium">{fromToken.symbol}</span>
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      </button>
                    </div>
                  </div>

                  {/* Pay Amount with Token Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-500">Paying with</label>
                    <div className="relative flex items-center bg-black/40 border border-white/5 rounded-xl focus-within:border-cyan-500/50 transition-colors">
                      <input
                        type="text"
                        value={payAmount}
                        onChange={(e) => {
                          setPayAmount(e.target.value);
                          setActiveInput('pay');
                        }}
                        onFocus={() => setActiveInput('pay')}
                        className="flex-1 bg-transparent border-none outline-none p-4 text-white placeholder-zinc-600 font-mono text-lg w-full"
                        placeholder="0.0"
                      />
                      <button 
                         onClick={() => { setActiveTokenSlot('to'); setShowTokenModal(true); }}
                        className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-1.5 mr-3 hover:bg-zinc-900 transition-colors"
                      >
                        <TokenIcon symbol={toToken.symbol} icon={toToken.icon} size={24} />
                        <span className="text-white font-medium">{toToken.symbol}</span>
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      </button>
                    </div>
                  </div>

                  {/* Frequency */}
                  <div className="space-y-4">
                     <div>
                       <label className="text-xs font-medium text-zinc-500 mb-2 block">Frequency</label>
                       <div className="flex bg-black/40 border border-white/5 rounded-xl p-1">
                         {(['Daily', 'Weekly', 'Monthly'] as FrequencyType[]).map((freq) => (
                           <button
                             key={freq}
                             onClick={() => setFrequency(freq)}
                             className={cn(
                               "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all",
                               frequency === freq 
                                 ? 'bg-white/10 text-white shadow-sm' 
                                 : 'text-zinc-500 hover:text-zinc-300'
                             )}
                           >
                             {freq}
                           </button>
                         ))}
                       </div>
                     </div>

                     <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                       <span className="text-zinc-400 text-sm">Every</span>
                       <input
                         type="number"
                         min="1"
                         max="365"
                         value={intervalValue}
                         onChange={(e) => {
                           const val = parseInt(e.target.value);
                           if (!isNaN(val) && val > 0) setIntervalValue(val);
                         }}
                         className="flex-1 bg-transparent text-white font-medium text-center border-none outline-none text-lg min-w-[60px]"
                       />
                       <span className="text-zinc-400 text-sm">
                         {frequency === 'Daily' ? (intervalValue === 1 ? 'Day' : 'Days') :
                          frequency === 'Weekly' ? (intervalValue === 1 ? 'Week' : 'Weeks') :
                          (intervalValue === 1 ? 'Month' : 'Months')}
                       </span>
                     </div>
                  </div>

                  {/* Summary Card */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-zinc-500">Next purchase</span>
                       <div className="text-right">
                         <div className="text-white font-medium">{nextPurchaseText}</div>
                       </div>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-zinc-500">Frequency</span>
                       <span className="text-white font-medium">{frequencyDescriptions[frequency]}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-zinc-500">Duration</span>
                       <span className="text-white font-medium">Until cancelled</span>
                     </div>
                  </div>

                  <div className="mt-auto">
                    <NeonButton 
                      onClick={() => {
                        if (!userId) {
                           setError("Please connect your wallet first");
                           return;
                        }
                        if (needsAccount) {
                           setViewState('creating-account');
                           return;
                        }
                        setViewState('review');
                      }}
                      disabled={isLoadingAccounts}
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 border-none w-full disabled:opacity-50"
                    >
                      {isLoadingAccounts ? "Loading Accounts..." : !userId ? "Connect Wallet" : needsAccount ? "Create Smart Wallet" : "Start DCA Strategy"}
                    </NeonButton>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- REVIEW STATE --- */}
            {viewState === 'review' && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                <div className="p-6 flex items-center justify-between relative z-10">
                   <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setViewState('input')}
                        className="p-2 -ml-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <h2 className="text-lg font-display font-bold text-white">Confirm Strategy</h2>
                   </div>
                   <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-5 h-5" />
                   </button>
                </div>

                <div className="px-6 pb-8 flex-1 flex flex-col relative z-10 overflow-y-auto custom-scrollbar">
                  
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6 text-center">
                    <div className="text-zinc-400 text-sm mb-2">You are buying</div>
                    <div className="flex items-center justify-center gap-3 mb-2">
                      <TokenIcon symbol={fromToken} icon={fromTokenData?.icon} size={32} />
                      <span className="text-3xl font-bold text-white font-display">{buyAmount} {fromToken}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm mb-4">
                      <span>with</span>
                      <TokenIcon symbol={toToken} icon={toTokenData?.icon} size={20} />
                      <span className="text-white font-mono">{payAmount} {toToken}</span>
                    </div>
                    
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {frequencyDescriptions[frequency]}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="mb-6 px-4 relative">
                    <div className="absolute left-[27px] top-2 bottom-2 w-0.5 bg-white/10" />
                    
                    <div className="space-y-5 relative z-10">
                      <div className="flex items-start gap-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 ring-4 ring-black" />
                        <div>
                          <div className="text-white font-medium text-sm">Now</div>
                          <div className="text-zinc-500 text-xs">Create session & approve</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-700 mt-1.5 ring-4 ring-black border border-white/20" />
                        <div>
                          <div className="text-white font-medium text-sm">1st: {nextPurchaseText}</div>
                          <div className="text-zinc-500 text-xs">First automated purchase</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-700 mt-1.5 ring-4 ring-black border border-white/20" />
                        <div>
                          <div className="text-white font-medium text-sm">
                            2nd: {frequency === 'Daily' ? '+1 day' : frequency === 'Weekly' ? '+1 week' : '+1 month'}
                          </div>
                          <div className="text-zinc-500 text-xs">Continues automatically</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500 shrink-0">
                        <Fuel className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium text-sm">Gas required</span>
                          <span className="text-yellow-500 font-mono text-xs font-bold px-1.5 py-0.5 bg-yellow-500/10 rounded border border-yellow-500/20">
                            ~0.005 ETH
                          </span>
                        </div>
                        <p className="text-zinc-500 text-xs">
                          For automated transactions
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-white font-medium text-sm">Cancel anytime</span>
                        <p className="text-zinc-500 text-xs mt-0.5">
                          Pause or stop whenever you want
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <NeonButton 
                      onClick={handleCreateStrategy}
                      disabled={isLoading}
                      className="bg-white text-black hover:bg-zinc-200 shadow-none w-full disabled:opacity-50"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </span>
                      ) : (
                        'Activate & Start'
                      )}
                    </NeonButton>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- ACTIVE STRATEGIES --- */}
            {viewState === 'active' && (
              <motion.div
                key="active"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                <div className="p-6 flex items-center justify-between relative z-10">
                   <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setViewState('input')}
                        className="p-2 -ml-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div>
                        <h2 className="text-lg font-display font-bold text-white">My Strategies</h2>
                        <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                          {strategies.filter(s => s.isActive).length} active
                        </div>
                      </div>
                   </div>
                   <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-5 h-5" />
                   </button>
                </div>

                <div className="px-6 pb-8 flex-1 flex flex-col relative z-10 overflow-y-auto space-y-4">
                  
                  {isLoadingStrategies ? (
                    <div className="flex-1 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                  ) : strategies.length > 0 ? (
                    strategies.map((strategy) => (
                      <div 
                        key={strategy.strategyId}
                        className={cn(
                          "bg-white/5 border rounded-xl p-4",
                          strategy.isActive ? "border-cyan-500/30" : "border-white/10 opacity-60"
                        )}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <TokenIcon symbol="ETH" icon={getTokenBySymbol('ETH')?.icon} size={32} />
                            <div>
                              <div className="text-white font-medium text-sm">
                                {strategy.amount} ETH → USDC
                              </div>
                              <div className="text-zinc-500 text-xs capitalize">{strategy.interval}</div>
                            </div>
                          </div>
                          <div className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            strategy.isActive 
                              ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                              : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                          )}>
                            {strategy.isActive ? 'Active' : 'Paused'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm mb-4">
                          <Clock className="w-4 h-4 text-zinc-500" />
                          <span className="text-zinc-400">Next:</span>
                          <span className="text-white">{formatDateTime(timestampToDate(strategy.nextExecution))}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleStrategy(strategy)}
                            disabled={isLoading}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors",
                              strategy.isActive 
                                ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20"
                                : "bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20"
                            )}
                          >
                            {strategy.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                            {strategy.isActive ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            onClick={() => {
                              setStrategyToCancel(strategy);
                              setViewState('confirming-cancel');
                            }}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                        <ClipboardList className="w-8 h-8 text-zinc-500" />
                      </div>
                      <p className="text-zinc-400 text-sm">No strategies yet</p>
                    </div>
                  )}

                  <div className="mt-auto pt-4">
                    <NeonButton 
                      onClick={() => setViewState('input')}
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 border-none w-full"
                    >
                      + New Strategy
                    </NeonButton>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- CONFIRM CANCEL --- */}
            {viewState === 'confirming-cancel' && strategyToCancel && (
              <motion.div
                key="confirming-cancel"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col h-full"
              >
                <div className="p-6 flex items-center justify-between relative z-10">
                   <div className="flex items-center gap-3">
                      <button 
                        onClick={() => {
                          setStrategyToCancel(null);
                          setViewState('active');
                        }}
                        className="p-2 -ml-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <h2 className="text-lg font-display font-bold text-white">Cancel Strategy</h2>
                   </div>
                   <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-5 h-5" />
                   </button>
                </div>

                <div className="px-6 pb-8 flex-1 flex flex-col relative z-10 items-center justify-center text-center">
                  
                  <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                    <AlertCircle className="w-10 h-10 text-red-400" />
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">Cancel this DCA?</h3>
                  <p className="text-zinc-400 text-sm mb-6 max-w-xs">
                    This stops all automated purchases
                  </p>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 w-full mb-8">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Strategy</span>
                      <div className="flex items-center gap-2">
                        <TokenIcon symbol="ETH" icon={getTokenBySymbol('ETH')?.icon} size={20} />
                        <span className="text-white font-medium">
                          {strategyToCancel.amount} ETH → USDC
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full space-y-3">
                    <button
                      onClick={() => handleCancelStrategy(strategyToCancel)}
                      disabled={isLoading}
                      className="w-full py-3 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Yes, Cancel
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setStrategyToCancel(null);
                        setViewState('active');
                      }}
                      disabled={isLoading}
                      className="w-full py-3 rounded-xl text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
                    >
                      Keep Running
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
