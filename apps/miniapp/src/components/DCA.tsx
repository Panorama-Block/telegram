import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList,
  X,
  ChevronDown,
  ArrowLeft,
  Fuel,
  Clock,
  Wallet,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DataInput } from "@/components/ui/DataInput";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useActiveAccount } from "thirdweb/react";
import {
  getUserAccounts,
  createStrategy,
  SmartAccount,
  CreateStrategyRequest,
} from "@/features/dca/api";

interface DCAProps {
  onClose: () => void;
}

type ViewState = "input" | "review" | "success";
type Frequency = "daily" | "weekly" | "monthly";

// Supported tokens for DCA
interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  color: string;
  chainId: number;
  icon?: string;
}

const SUPPORTED_TOKENS: Token[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    decimals: 18,
    color: "bg-blue-500",
    chainId: 1,
    icon: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    decimals: 18,
    color: "bg-indigo-500",
    chainId: 1,
    icon: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    color: "bg-green-500",
    chainId: 1,
    icon: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    color: "bg-emerald-500",
    chainId: 1,
    icon: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: "0x6B175474E89094C44Da98b954EescdeCB5147d6dc",
    decimals: 18,
    color: "bg-yellow-500",
    chainId: 1,
    icon: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
  },
  {
    symbol: "WBTC",
    name: "Wrapped BTC",
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8,
    color: "bg-orange-500",
    chainId: 1,
    icon: "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png",
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    decimals: 18,
    color: "bg-blue-400",
    chainId: 1,
    icon: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  },
  {
    symbol: "UNI",
    name: "Uniswap",
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    decimals: 18,
    color: "bg-pink-500",
    chainId: 1,
    icon: "https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png",
  },
];

// Tokens available to buy (excluding stablecoins for "buy" side)
const BUY_TOKENS = SUPPORTED_TOKENS.filter(
  (t) => !["USDC", "USDT", "DAI"].includes(t.symbol)
);

// Tokens available to pay with (stablecoins + ETH)
const PAY_TOKENS = SUPPORTED_TOKENS.filter((t) =>
  ["ETH", "USDC", "USDT", "DAI"].includes(t.symbol)
);

export function DCA({ onClose }: DCAProps) {
  const account = useActiveAccount();
  const [viewState, setViewState] = useState<ViewState>("input");

  // Form state
  const [buyToken, setBuyToken] = useState<Token>(BUY_TOKENS[0]);
  const [payToken, setPayToken] = useState<Token>(PAY_TOKENS[1]); // USDC default
  const [spendAmount, setSpendAmount] = useState("100");
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [intervalDays, setIntervalDays] = useState(7);

  // Token selection modal state
  const [showBuyTokenModal, setShowBuyTokenModal] = useState(false);
  const [showPayTokenModal, setShowPayTokenModal] = useState(false);

  // Smart accounts state
  const [smartAccounts, setSmartAccounts] = useState<SmartAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SmartAccount | null>(
    null
  );
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextExecution, setNextExecution] = useState<Date | null>(null);

  // Load user's smart accounts
  useEffect(() => {
    const loadAccounts = async () => {
      if (!account?.address) return;

      setIsLoadingAccounts(true);
      try {
        const accounts = await getUserAccounts(account.address);
        setSmartAccounts(accounts);
        if (accounts.length > 0 && !selectedAccount) {
          setSelectedAccount(accounts[0]);
        }
      } catch (err) {
        console.error("Error loading smart accounts:", err);
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    loadAccounts();
  }, [account?.address]);

  // Update interval days when frequency changes
  useEffect(() => {
    switch (frequency) {
      case "daily":
        setIntervalDays(1);
        break;
      case "weekly":
        setIntervalDays(7);
        break;
      case "monthly":
        setIntervalDays(30);
        break;
    }
  }, [frequency]);

  // Calculate next purchase date
  const nextPurchaseDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + intervalDays);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [intervalDays]);

  // Handle strategy creation
  const handleCreateStrategy = async () => {
    if (!selectedAccount || !account?.address) {
      setError("Please select a Panorama Wallet");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const request: CreateStrategyRequest = {
        smartAccountId: selectedAccount.address,
        fromToken: payToken.address,
        toToken: buyToken.address,
        fromChainId: payToken.chainId,
        toChainId: buyToken.chainId,
        amount: spendAmount,
        interval: frequency,
      };

      const result = await createStrategy(request, account.address);
      setNextExecution(result.nextExecution);
      setViewState("success");
    } catch (err: any) {
      console.error("Error creating strategy:", err);
      setError(err.message || "Failed to create strategy");
    } finally {
      setIsCreating(false);
    }
  };

  // Responsive variants
  const isMobile =
    typeof window !== "undefined" && window.innerWidth < 768;

  const modalVariants = {
    initial: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
    animate: isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 },
    exit: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
  };

  // Token Selection Button Component
  const TokenButton = ({
    token,
    onClick,
  }: {
    token: Token;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-1.5 hover:bg-zinc-900 transition-colors group"
    >
      {token.icon ? (
        <img src={token.icon} alt={token.symbol} className="w-6 h-6 rounded-full object-cover" />
      ) : (
        <div className={cn("w-6 h-6 rounded-full", token.color)} />
      )}
      <span className="text-white font-medium">{token.symbol}</span>
      <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
    </button>
  );

  // Token Selection Modal Component
  const TokenModal = ({
    isOpen,
    onClose,
    tokens,
    onSelect,
    title,
  }: {
    isOpen: boolean;
    onClose: () => void;
    tokens: Token[];
    onSelect: (token: Token) => void;
    title: string;
  }) => {
    if (!isOpen) return null;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 bg-[#0A0A0A] rounded-2xl flex flex-col overflow-hidden"
        onClick={onClose}
      >
        {/* Gradient Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-cyan-500/10 blur-[60px] pointer-events-none" />

        <div
          className="flex flex-col h-full relative z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-white font-bold">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {tokens.map((token) => (
              <button
                key={token.address}
                onClick={() => {
                  onSelect(token);
                  onClose();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                {token.icon ? (
                  <img src={token.icon} alt={token.symbol} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className={cn("w-10 h-10 rounded-full", token.color)} />
                )}
                <div className="text-left">
                  <div className="text-white font-medium">{token.symbol}</div>
                  <div className="text-xs text-zinc-500">{token.name}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    );
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
        <GlassCard className="w-full shadow-2xl overflow-hidden relative bg-[#0A0A0A] border-white/10 h-[85vh] md:h-auto md:min-h-[600px] flex flex-col rounded-t-3xl rounded-b-none md:rounded-2xl border-b-0 md:border-b pb-safe">
          {/* Gradient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-cyan-500/10 blur-[60px] pointer-events-none" />

          {/* Mobile Drag Handle */}
          <div className="md:hidden w-full flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
          </div>

          <AnimatePresence mode="wait">
            {/* --- STATE 1: INPUT --- */}
            {viewState === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full relative"
              >
                {/* Token Selection Modals */}
                <TokenModal
                  isOpen={showBuyTokenModal}
                  onClose={() => setShowBuyTokenModal(false)}
                  tokens={BUY_TOKENS}
                  onSelect={setBuyToken}
                  title="Select Token to Buy"
                />
                <TokenModal
                  isOpen={showPayTokenModal}
                  onClose={() => setShowPayTokenModal(false)}
                  tokens={PAY_TOKENS}
                  onSelect={setPayToken}
                  title="Select Payment Token"
                />

                {/* Header */}
                <div className="p-6 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-display font-bold text-white">
                        DCA Strategy
                      </h2>
                      <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                        Automated Investing
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-6 pb-8 space-y-6 relative z-10 flex-1 flex flex-col overflow-y-auto">
                  {/* Smart Account Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-500">
                      Panorama Wallet
                    </label>
                    {isLoadingAccounts ? (
                      <div className="flex items-center gap-2 p-3 bg-black/40 border border-white/5 rounded-xl text-zinc-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Loading wallets...</span>
                      </div>
                    ) : smartAccounts.length === 0 ? (
                      <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">
                          No Panorama Wallet found. Create one in Portfolio.
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          onClick={() =>
                            setShowAccountSelector(!showAccountSelector)
                          }
                          className="w-full flex items-center justify-between p-3 bg-black/40 border border-white/10 rounded-xl hover:bg-black/60 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-cyan-500/10 rounded-lg">
                              <Wallet className="w-4 h-4 text-cyan-400" />
                            </div>
                            <div className="text-left">
                              <div className="text-white font-medium">
                                {selectedAccount?.name}
                              </div>
                              <div className="text-xs text-zinc-500 font-mono">
                                {selectedAccount?.address.slice(0, 6)}...
                                {selectedAccount?.address.slice(-4)}
                              </div>
                            </div>
                          </div>
                          <ChevronDown
                            className={cn(
                              "w-4 h-4 text-zinc-500 transition-transform",
                              showAccountSelector && "rotate-180"
                            )}
                          />
                        </button>

                        {/* Account Dropdown */}
                        <AnimatePresence>
                          {showAccountSelector && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute top-full left-0 right-0 mt-2 bg-black border border-white/10 rounded-xl overflow-hidden z-20"
                            >
                              {smartAccounts.map((acc) => (
                                <button
                                  key={acc.address}
                                  onClick={() => {
                                    setSelectedAccount(acc);
                                    setShowAccountSelector(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors",
                                    selectedAccount?.address === acc.address &&
                                      "bg-cyan-500/10"
                                  )}
                                >
                                  <div className="p-2 bg-cyan-500/10 rounded-lg">
                                    <Wallet className="w-4 h-4 text-cyan-400" />
                                  </div>
                                  <div className="text-left">
                                    <div className="text-white font-medium">
                                      {acc.name}
                                    </div>
                                    <div className="text-xs text-zinc-500 font-mono">
                                      {acc.address.slice(0, 6)}...
                                      {acc.address.slice(-4)}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>

                  {/* Token to Buy (selection only) */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-500">
                      I want to buy
                    </label>
                    <button
                      onClick={() => setShowBuyTokenModal(true)}
                      className="w-full flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-xl hover:bg-black/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {buyToken.icon ? (
                          <img src={buyToken.icon} alt={buyToken.symbol} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className={cn("w-10 h-10 rounded-full", buyToken.color)} />
                        )}
                        <div className="text-left">
                          <div className="text-white font-bold text-lg">{buyToken.symbol}</div>
                          <div className="text-xs text-zinc-500">{buyToken.name}</div>
                        </div>
                      </div>
                      <ChevronDown className="w-5 h-5 text-zinc-500" />
                    </button>
                  </div>

                  {/* Amount to Spend */}
                  <DataInput
                    label="Amount to spend per execution"
                    value={spendAmount}
                    onChange={(e) => setSpendAmount(e.target.value)}
                    type="number"
                    placeholder="100"
                    rightElement={
                      <TokenButton
                        token={payToken}
                        onClick={() => setShowPayTokenModal(true)}
                      />
                    }
                  />

                  {/* Frequency Config */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-500">
                      Frequency
                    </label>
                    <div className="flex bg-black/40 border border-white/5 rounded-xl p-1">
                      {(["daily", "weekly", "monthly"] as Frequency[]).map(
                        (freq) => (
                          <button
                            key={freq}
                            onClick={() => setFrequency(freq)}
                            className={cn(
                              "flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize",
                              frequency === freq
                                ? "bg-cyan-500/20 text-cyan-400 shadow-sm"
                                : "text-zinc-500 hover:text-zinc-300"
                            )}
                          >
                            {freq}
                          </button>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-sm text-zinc-400">Every</span>
                      <input
                        type="number"
                        value={intervalDays}
                        onChange={(e) =>
                          setIntervalDays(parseInt(e.target.value) || 1)
                        }
                        className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-center text-white focus:border-cyan-500/50 outline-none"
                      />
                      <span className="text-sm text-zinc-400">Days</span>
                    </div>
                  </div>

                  {/* Summary Card */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-500">Next purchase</span>
                      <span className="text-white font-medium">
                        {nextPurchaseDate}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-500">Total Duration</span>
                      <span className="text-white font-medium">
                        Until Cancelled
                      </span>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="mt-auto">
                    <NeonButton
                      onClick={() => setViewState("review")}
                      disabled={!selectedAccount || smartAccounts.length === 0}
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 border-none w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Review Strategy
                    </NeonButton>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- STATE 2: REVIEW --- */}
            {viewState === "review" && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                {/* Header */}
                <div className="p-6 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setViewState("input")}
                      className="p-2 -ml-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-lg font-display font-bold text-white">
                      Confirm Strategy
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-6 pb-8 flex-1 flex flex-col relative z-10 overflow-y-auto custom-scrollbar">
                  {/* Highlight Block (Summary) */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6 text-center">
                    <div className="text-zinc-400 text-sm mb-1">
                      You will spend
                    </div>
                    <div className="text-3xl font-bold text-white font-display mb-2">
                      {spendAmount} {payToken.symbol}
                    </div>
                    <div className="text-zinc-500 text-sm mb-4">
                      to buy{" "}
                      <span className="text-white font-medium">
                        {buyToken.symbol}
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium">
                      <Clock className="w-3 h-3" />
                      Every {intervalDays} Day{intervalDays > 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Wallet Info */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-cyan-500/10 rounded-lg">
                        <Wallet className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div>
                        <div className="text-white font-medium">
                          {selectedAccount?.name}
                        </div>
                        <div className="text-xs text-zinc-500 font-mono">
                          {selectedAccount?.address.slice(0, 10)}...
                          {selectedAccount?.address.slice(-8)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline Preview */}
                  <div className="mb-6 px-4 relative">
                    <div className="absolute left-[27px] top-2 bottom-2 w-0.5 bg-white/10" />

                    <div className="space-y-6 relative z-10">
                      {/* Item 1 */}
                      <div className="flex items-start gap-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 mt-1.5 ring-4 ring-black" />
                        <div>
                          <div className="text-white font-medium text-sm">
                            Now
                          </div>
                          <div className="text-zinc-500 text-xs">
                            Strategy will be created
                          </div>
                        </div>
                      </div>

                      {/* Item 2 */}
                      <div className="flex items-start gap-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-700 mt-1.5 ring-4 ring-black border border-white/20" />
                        <div>
                          <div className="text-white font-medium text-sm">
                            1st Buy: {nextPurchaseDate}
                          </div>
                          <div className="text-zinc-500 text-xs">
                            First automated execution
                          </div>
                        </div>
                      </div>

                      {/* Item 3 */}
                      <div className="flex items-start gap-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-700 mt-1.5 ring-4 ring-black border border-white/20" />
                        <div>
                          <div className="text-white font-medium text-sm">
                            Continues automatically
                          </div>
                          <div className="text-zinc-500 text-xs">
                            Until you cancel the strategy
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info Card (Session Gas) */}
                  <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500 shrink-0">
                        <Fuel className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium text-sm">
                            Gas Required
                          </span>
                        </div>
                        <p className="text-zinc-500 text-xs leading-relaxed">
                          Make sure your Panorama Wallet has enough ETH to pay
                          for gas fees on each execution.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mb-4">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  {/* Final Button */}
                  <div className="mt-auto">
                    <NeonButton
                      onClick={handleCreateStrategy}
                      disabled={isCreating}
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 border-none w-full disabled:opacity-50"
                    >
                      {isCreating ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating Strategy...
                        </span>
                      ) : (
                        "Activate Strategy"
                      )}
                    </NeonButton>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- STATE 3: SUCCESS --- */}
            {viewState === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col h-full items-center justify-center p-6 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-10 h-10 text-cyan-400" />
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  Strategy Created!
                </h2>

                <p className="text-zinc-400 mb-6">
                  Your DCA strategy is now active and will execute automatically.
                </p>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4 w-full mb-6 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Strategy</span>
                    <span className="text-white font-medium">
                      {spendAmount} {payToken.symbol} → {buyToken.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Frequency</span>
                    <span className="text-white font-medium capitalize">
                      Every {intervalDays} day{intervalDays > 1 ? "s" : ""}
                    </span>
                  </div>
                  {nextExecution && (
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">First Execution</span>
                      <span className="text-white font-medium">
                        {nextExecution.toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <NeonButton
                  onClick={onClose}
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 border-none w-full"
                >
                  Done
                </NeonButton>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
