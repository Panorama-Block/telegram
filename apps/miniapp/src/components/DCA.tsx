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
  ArrowLeftRight,
  Landmark,
  Droplets,
  Layers,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DataInput } from "@/components/ui/DataInput";
import { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useActiveAccount, useSwitchActiveWalletChain } from "thirdweb/react";
import { THIRDWEB_CLIENT_ID } from "@/shared/config/thirdweb";
import {
  getUserAccounts,
  createStrategy,
  SmartAccount,
  CreateStrategyRequest,
  type VaultUnsignedResult,
  type StrategyActionType,
} from "@/features/dca/api";

function parseDCAError(err: any): string {
  const msg: string = err?.message || err?.toString() || '';
  if (msg.includes('AA21') || msg.includes('prefund') || msg.includes("didn't pay prefund")) {
    return 'Insufficient gas in your Panorama Wallet. Send a small amount of ETH (or the native token) to it before proceeding.';
  }
  if (msg.includes('AA25') || msg.includes('invalid account nonce')) {
    return 'Transaction conflict. Wait a few seconds and try again.';
  }
  if (msg.includes('insufficient funds')) {
    return 'Insufficient token balance in your Panorama Wallet.';
  }
  if (msg.includes('user rejected') || msg.includes('User rejected')) {
    return 'Transaction cancelled.';
  }
  if (msg.includes('INSUFFICIENT_OUTPUT_AMOUNT') || msg.includes('Too little received')) {
    return 'Price moved too much (slippage). Please try again.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Network error. Check your connection and try again.';
  }
  if (msg.includes('Swap execution failed: ')) {
    return msg.replace('Swap execution failed: ', '');
  }
  return msg || 'Something went wrong. Please try again.';
}

interface DCAProps {
  onClose: () => void;
}

type ViewState = "select" | "input" | "review" | "success" | "sign";
type Frequency = "daily" | "weekly" | "monthly";

// ── Strategy type definitions ──────────────────────────────────────────────
interface StrategyOption {
  type: StrategyActionType;
  label: string;
  description: string;
  icon: typeof ArrowLeftRight;
  color: string;
  bgColor: string;
}

const STRATEGY_OPTIONS: StrategyOption[] = [
  {
    type: "swap",
    label: "Swap",
    description: "Auto-buy tokens on a schedule. Classic DCA — accumulate over time.",
    icon: ArrowLeftRight,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
  },
  {
    type: "lending",
    label: "Lending",
    description: "Auto-supply to lending protocols. Earn interest automatically.",
    icon: Landmark,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
  {
    type: "liquid_staking",
    label: "Liquid Staking",
    description: "Auto-stake ETH or AVAX. Compound staking rewards over time.",
    icon: Droplets,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    type: "liquidity_pool",
    label: "Liquidity Pool",
    description: "Auto-add liquidity to pools. Build LP positions gradually.",
    icon: Layers,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
];

// ── Supported tokens ───────────────────────────────────────────────────────
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
  // ── Ethereum (chainId 1)
  { symbol: "ETH", name: "Ethereum", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, color: "bg-blue-500", chainId: 1, icon: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  { symbol: "WETH", name: "Wrapped Ether", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18, color: "bg-indigo-500", chainId: 1, icon: "https://assets.coingecko.com/coins/images/2518/small/weth.png" },
  { symbol: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, color: "bg-green-500", chainId: 1, icon: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
  { symbol: "USDT", name: "Tether USD", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, color: "bg-emerald-500", chainId: 1, icon: "https://assets.coingecko.com/coins/images/325/small/Tether.png" },
  { symbol: "WBTC", name: "Wrapped BTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8, color: "bg-orange-500", chainId: 1, icon: "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png" },
  { symbol: "DAI", name: "Dai Stablecoin", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18, color: "bg-yellow-500", chainId: 1, icon: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png" },
  { symbol: "LINK", name: "Chainlink", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18, color: "bg-blue-400", chainId: 1, icon: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png" },
  { symbol: "UNI", name: "Uniswap", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18, color: "bg-pink-500", chainId: 1, icon: "https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png" },
  // ── Base (chainId 8453)
  { symbol: "WETH", name: "Wrapped Ether (Base)", address: "0x4200000000000000000000000000000000000006", decimals: 18, color: "bg-indigo-500", chainId: 8453, icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x4200000000000000000000000000000000000006/logo.png" },
  { symbol: "USDC", name: "USD Coin (Base)", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, color: "bg-green-500", chainId: 8453, icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png" },
  { symbol: "cbBTC", name: "Coinbase Wrapped BTC", address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", decimals: 8, color: "bg-orange-500", chainId: 8453, icon: "https://assets.coingecko.com/coins/images/40143/small/cbbtc.webp" },
  { symbol: "AERO", name: "Aerodrome", address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", decimals: 18, color: "bg-blue-600", chainId: 8453, icon: "https://assets.coingecko.com/coins/images/31745/small/token.png" },
  // ── Avalanche (chainId 43114)
  { symbol: "AVAX", name: "Avalanche", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, color: "bg-red-500", chainId: 43114, icon: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png" },
  { symbol: "sAVAX", name: "Staked AVAX", address: "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE", decimals: 18, color: "bg-red-400", chainId: 43114, icon: "https://assets.coingecko.com/coins/images/23846/small/sAVAX_logo.png" },
];

// Token filters per strategy type
const BUY_TOKENS = SUPPORTED_TOKENS.filter((t) => !["USDC", "USDT"].includes(t.symbol));
const PAY_TOKENS = SUPPORTED_TOKENS.filter((t) => ["ETH", "USDC", "USDT", "DAI"].includes(t.symbol));

const LENDING_TOKENS = SUPPORTED_TOKENS.filter((t) =>
  ["USDC", "USDT", "DAI", "ETH", "WETH", "WBTC"].includes(t.symbol) && t.chainId === 43114 || t.chainId === 1
);

const STAKING_TOKENS = SUPPORTED_TOKENS.filter((t) =>
  ["ETH", "AVAX"].includes(t.symbol)
);

const LP_TOKENS = SUPPORTED_TOKENS.filter((t) =>
  ["ETH", "WETH", "USDC", "USDT", "WBTC", "AERO"].includes(t.symbol)
);

// ── Lending protocols ──────────────────────────────────────────────────────
interface Protocol {
  id: string;
  name: string;
  chain: string;
  chainId: number;
  icon: string;
}

const LENDING_PROTOCOLS: Protocol[] = [
  { id: "benqi", name: "Benqi", chain: "Avalanche", chainId: 43114, icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/assets/0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5/logo.png" },
  { id: "aave-v3", name: "Aave V3", chain: "Ethereum", chainId: 1, icon: "https://assets.coingecko.com/coins/images/12645/small/AAVE.png" },
];

// ── LP Pools ───────────────────────────────────────────────────────────────
interface LPPool {
  id: string;
  name: string;
  tokenA: string;
  tokenB: string;
  chain: string;
  chainId: number;
  apr: string;
  protocol: string;
}

const LP_POOLS: LPPool[] = [
  { id: "aero-weth-usdc", name: "WETH / USDC", tokenA: "WETH", tokenB: "USDC", chain: "Base", chainId: 8453, apr: "~12%", protocol: "Aerodrome" },
  { id: "aero-weth-aero", name: "WETH / AERO", tokenA: "WETH", tokenB: "AERO", chain: "Base", chainId: 8453, apr: "~28%", protocol: "Aerodrome" },
  { id: "aero-usdc-cbbtc", name: "USDC / cbBTC", tokenA: "USDC", tokenB: "cbBTC", chain: "Base", chainId: 8453, apr: "~9%", protocol: "Aerodrome" },
];

export function DCA({ onClose }: DCAProps) {
  const account = useActiveAccount();
  const switchChain = useSwitchActiveWalletChain();
  const [viewState, setViewState] = useState<ViewState>("select");

  // Strategy type
  const [strategyType, setStrategyType] = useState<StrategyActionType>("swap");

  // Shared form state
  const [spendAmount, setSpendAmount] = useState("100");
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [intervalDays, setIntervalDays] = useState(7);

  // Swap-specific
  const [buyToken, setBuyToken] = useState<Token>(BUY_TOKENS[0]);
  const [payToken, setPayToken] = useState<Token>(PAY_TOKENS[1]);
  const [showBuyTokenModal, setShowBuyTokenModal] = useState(false);
  const [showPayTokenModal, setShowPayTokenModal] = useState(false);

  // Lending-specific
  const [lendingToken, setLendingToken] = useState<Token>(LENDING_TOKENS[0]);
  const [lendingProtocol, setLendingProtocol] = useState<Protocol>(LENDING_PROTOCOLS[0]);
  const [lendingAction, setLendingAction] = useState<"supply" | "borrow">("supply");
  const [showLendingTokenModal, setShowLendingTokenModal] = useState(false);

  // Staking-specific
  const [stakingToken, setStakingToken] = useState<Token>(STAKING_TOKENS[0]);
  const [showStakingTokenModal, setShowStakingTokenModal] = useState(false);

  // LP-specific
  const [selectedPool, setSelectedPool] = useState<LPPool>(LP_POOLS[0]);
  const [amountB, setAmountB] = useState("100");
  const [showPoolSelector, setShowPoolSelector] = useState(false);

  // Smart accounts state
  const [smartAccounts, setSmartAccounts] = useState<SmartAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SmartAccount | null>(null);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextExecution, setNextExecution] = useState<Date | null>(null);
  const [vaultBundle, setVaultBundle] = useState<VaultUnsignedResult | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signStep, setSignStep] = useState<{ current: number; total: number } | null>(null);

  // Token selection modal state (generic)
  const [genericTokenModal, setGenericTokenModal] = useState<{
    open: boolean;
    tokens: Token[];
    title: string;
    onSelect: (t: Token) => void;
  } | null>(null);

  const handleSign = useCallback(async () => {
    if (!account || !vaultBundle || !selectedAccount) return;
    setIsSigning(true);
    setError(null);
    try {
      const { sendAndConfirmTransaction, createThirdwebClient, defineChain, prepareTransaction } = await import("thirdweb");
      const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
      const baseChain = defineChain(8453);
      await switchChain(baseChain);

      for (let i = 0; i < vaultBundle.steps.length; i++) {
        const step = vaultBundle.steps[i];
        setSignStep({ current: i + 1, total: vaultBundle.steps.length });
        const tx = prepareTransaction({
          client,
          chain: baseChain,
          to: step.to as `0x${string}`,
          data: step.data as `0x${string}`,
          value: BigInt(step.value || "0"),
        });
        await sendAndConfirmTransaction({ transaction: tx, account });
      }
      setViewState("success");
    } catch (err: any) {
      setError(parseDCAError(err));
    } finally {
      setIsSigning(false);
      setSignStep(null);
    }
  }, [account, vaultBundle, selectedAccount, switchChain]);

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
      case "daily": setIntervalDays(1); break;
      case "weekly": setIntervalDays(7); break;
      case "monthly": setIntervalDays(30); break;
    }
  }, [frequency]);

  const nextPurchaseDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + intervalDays);
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }, [intervalDays]);

  // Build the strategy request based on type
  const buildStrategyRequest = (): CreateStrategyRequest | null => {
    if (!selectedAccount || !account?.address) return null;

    const base = {
      smartAccountId: selectedAccount.address,
      actionType: strategyType,
      amount: spendAmount,
      interval: frequency,
    };

    switch (strategyType) {
      case "swap":
        return { ...base, fromToken: payToken.address, toToken: buyToken.address, fromChainId: payToken.chainId, toChainId: buyToken.chainId };
      case "lending":
        return { ...base, fromToken: lendingToken.address, toToken: lendingToken.address, fromChainId: lendingProtocol.chainId, toChainId: lendingProtocol.chainId, protocol: lendingProtocol.id, action: lendingAction };
      case "liquid_staking":
        return { ...base, fromToken: stakingToken.address, toToken: stakingToken.address, fromChainId: stakingToken.chainId, toChainId: stakingToken.chainId };
      case "liquidity_pool": {
        const tokenA = LP_TOKENS.find((t) => t.symbol === selectedPool.tokenA && t.chainId === selectedPool.chainId);
        const tokenB = LP_TOKENS.find((t) => t.symbol === selectedPool.tokenB && t.chainId === selectedPool.chainId);
        if (!tokenA || !tokenB) return null;
        return { ...base, fromToken: tokenA.address, toToken: tokenB.address, fromChainId: selectedPool.chainId, toChainId: selectedPool.chainId, amountB, tokenB: tokenB.address };
      }
    }
  };

  const handleCreateStrategy = async () => {
    const request = buildStrategyRequest();
    if (!request) {
      setError("Please select a Panorama Wallet");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const result = await createStrategy(request, account!.address);
      if (result.type === "vault_unsigned") {
        setVaultBundle(result);
        setViewState("sign");
      } else {
        setNextExecution(result.nextExecution);
        setViewState("success");
      }
    } catch (err: any) {
      console.error("Error creating strategy:", err);
      setError(parseDCAError(err));
    } finally {
      setIsCreating(false);
    }
  };

  // Get strategy label and summary for review
  const strategyMeta = STRATEGY_OPTIONS.find((o) => o.type === strategyType)!;

  const getReviewSummary = () => {
    switch (strategyType) {
      case "swap":
        return { action: "Buy", detail: `${spendAmount} ${payToken.symbol} → ${buyToken.symbol}`, chain: payToken.chainId === 8453 ? "Base" : "Ethereum" };
      case "lending":
        return { action: lendingAction === "supply" ? "Supply" : "Borrow", detail: `${spendAmount} ${lendingToken.symbol}`, chain: lendingProtocol.chain, extra: `Protocol: ${lendingProtocol.name}` };
      case "liquid_staking":
        return { action: "Stake", detail: `${spendAmount} ${stakingToken.symbol}`, chain: stakingToken.chainId === 43114 ? "Avalanche" : "Ethereum" };
      case "liquidity_pool":
        return { action: "Add Liquidity", detail: `${spendAmount} ${selectedPool.tokenA} + ${amountB} ${selectedPool.tokenB}`, chain: selectedPool.chain, extra: `Pool: ${selectedPool.protocol} · APR ${selectedPool.apr}` };
    }
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const modalVariants = {
    initial: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
    animate: isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 },
    exit: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
  };

  // ── Shared sub-components ────────────────────────────────────────────────

  const TokenButton = ({ token, onClick }: { token: Token; onClick: () => void }) => (
    <button onClick={onClick} className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-1.5 hover:bg-zinc-900 transition-colors group">
      {token.icon ? <img src={token.icon} alt={token.symbol} className="w-6 h-6 rounded-full object-cover" /> : <div className={cn("w-6 h-6 rounded-full", token.color)} />}
      <span className="text-white font-medium">{token.symbol}</span>
      <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
    </button>
  );

  const TokenModal = ({ isOpen, onClose: closeModal, tokens, onSelect, title }: { isOpen: boolean; onClose: () => void; tokens: Token[]; onSelect: (token: Token) => void; title: string }) => {
    if (!isOpen) return null;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-[#0A0A0A] rounded-2xl flex flex-col overflow-hidden" onClick={closeModal}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-cyan-500/10 blur-[60px] pointer-events-none" />
        <div className="flex flex-col h-full relative z-10" onClick={(e) => e.stopPropagation()}>
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-white font-bold">{title}</h3>
            <button onClick={closeModal} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {tokens.map((token) => (
              <button key={`${token.address}-${token.chainId}`} onClick={() => { onSelect(token); closeModal(); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors">
                {token.icon ? <img src={token.icon} alt={token.symbol} className="w-10 h-10 rounded-full object-cover" /> : <div className={cn("w-10 h-10 rounded-full", token.color)} />}
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{token.symbol}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-400">{token.chainId === 8453 ? "Base" : token.chainId === 43114 ? "Avalanche" : "Ethereum"}</span>
                  </div>
                  <div className="text-xs text-zinc-500">{token.name}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    );
  };

  const FrequencySelector = () => (
    <div className="space-y-2">
      <label className="text-xs font-medium text-zinc-500">Frequency</label>
      <div className="flex bg-black/40 border border-white/5 rounded-xl p-1">
        {(["daily", "weekly", "monthly"] as Frequency[]).map((freq) => (
          <button key={freq} onClick={() => setFrequency(freq)} className={cn("flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize", frequency === freq ? "bg-cyan-500/20 text-cyan-400 shadow-sm" : "text-zinc-500 hover:text-zinc-300")}>
            {freq}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <span className="text-sm text-zinc-400">Every</span>
        <input type="number" value={intervalDays} onChange={(e) => setIntervalDays(parseInt(e.target.value) || 1)} className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-center text-white focus:border-cyan-500/50 outline-none" />
        <span className="text-sm text-zinc-400">Days</span>
      </div>
    </div>
  );

  const WalletSelector = () => (
    <div className="space-y-2">
      <label className="text-xs font-medium text-zinc-500">Panorama Wallet</label>
      {isLoadingAccounts ? (
        <div className="flex items-center gap-2 p-3 bg-black/40 border border-white/5 rounded-xl text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading wallets...</span>
        </div>
      ) : smartAccounts.length === 0 ? (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">No Panorama Wallet found. Create one in Portfolio.</span>
        </div>
      ) : (
        <div className="relative">
          <button onClick={() => setShowAccountSelector(!showAccountSelector)} className="w-full flex items-center justify-between p-3 bg-black/40 border border-white/10 rounded-xl hover:bg-black/60 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg"><Wallet className="w-4 h-4 text-cyan-400" /></div>
              <div className="text-left">
                <div className="text-white font-medium">{selectedAccount?.name}</div>
                <div className="text-xs text-zinc-500 font-mono">{selectedAccount?.address.slice(0, 6)}...{selectedAccount?.address.slice(-4)}</div>
              </div>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", showAccountSelector && "rotate-180")} />
          </button>
          <AnimatePresence>
            {showAccountSelector && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 right-0 mt-2 bg-black border border-white/10 rounded-xl overflow-hidden z-20">
                {smartAccounts.map((acc) => (
                  <button key={acc.address} onClick={() => { setSelectedAccount(acc); setShowAccountSelector(false); }} className={cn("w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors", selectedAccount?.address === acc.address && "bg-cyan-500/10")}>
                    <div className="p-2 bg-cyan-500/10 rounded-lg"><Wallet className="w-4 h-4 text-cyan-400" /></div>
                    <div className="text-left">
                      <div className="text-white font-medium">{acc.name}</div>
                      <div className="text-xs text-zinc-500 font-mono">{acc.address.slice(0, 6)}...{acc.address.slice(-4)}</div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  // ── Type-specific form bodies ────────────────────────────────────────────

  const SwapForm = () => (
    <>
      <TokenModal isOpen={showBuyTokenModal} onClose={() => setShowBuyTokenModal(false)} tokens={BUY_TOKENS} onSelect={(token) => { setBuyToken(token); setPayToken((prev) => { if (prev.chainId === token.chainId) return prev; const match = PAY_TOKENS.find((t) => t.chainId === token.chainId && t.symbol === "USDC") || PAY_TOKENS.find((t) => t.chainId === token.chainId); return match ?? prev; }); }} title="Select Token to Buy" />
      <TokenModal isOpen={showPayTokenModal} onClose={() => setShowPayTokenModal(false)} tokens={PAY_TOKENS} onSelect={setPayToken} title="Select Payment Token" />

      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-500">I want to buy</label>
        <button onClick={() => setShowBuyTokenModal(true)} className="w-full flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-xl hover:bg-black/60 transition-colors">
          <div className="flex items-center gap-3">
            {buyToken.icon ? <img src={buyToken.icon} alt={buyToken.symbol} className="w-10 h-10 rounded-full object-cover" /> : <div className={cn("w-10 h-10 rounded-full", buyToken.color)} />}
            <div className="text-left">
              <div className="text-white font-bold text-lg">{buyToken.symbol}</div>
              <div className="text-xs text-zinc-500">{buyToken.name}</div>
            </div>
          </div>
          <ChevronDown className="w-5 h-5 text-zinc-500" />
        </button>
      </div>

      <DataInput label="Amount to spend per execution" value={spendAmount} onChange={(e) => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) setSpendAmount(v); }} type="text" inputMode="decimal" placeholder="100" rightElement={<TokenButton token={payToken} onClick={() => setShowPayTokenModal(true)} />} />
    </>
  );

  const LendingForm = () => (
    <>
      <TokenModal isOpen={showLendingTokenModal} onClose={() => setShowLendingTokenModal(false)} tokens={LENDING_TOKENS} onSelect={setLendingToken} title="Select Token" />

      {/* Supply / Borrow toggle */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-500">Action</label>
        <div className="flex bg-black/40 border border-white/5 rounded-xl p-1">
          {(["supply", "borrow"] as const).map((action) => (
            <button key={action} onClick={() => setLendingAction(action)} className={cn("flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize", lendingAction === action ? "bg-emerald-500/20 text-emerald-400 shadow-sm" : "text-zinc-500 hover:text-zinc-300")}>
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Protocol selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-500">Protocol</label>
        <div className="flex gap-2">
          {LENDING_PROTOCOLS.map((p) => (
            <button key={p.id} onClick={() => setLendingProtocol(p)} className={cn("flex-1 flex items-center gap-2 p-3 border rounded-xl transition-all", lendingProtocol.id === p.id ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 bg-black/40 hover:bg-black/60")}>
              <img src={p.icon} alt={p.name} className="w-6 h-6 rounded-full" />
              <div className="text-left">
                <div className={cn("text-sm font-medium", lendingProtocol.id === p.id ? "text-emerald-400" : "text-white")}>{p.name}</div>
                <div className="text-[10px] text-zinc-500">{p.chain}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Token selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-500">Token to {lendingAction}</label>
        <button onClick={() => setShowLendingTokenModal(true)} className="w-full flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-xl hover:bg-black/60 transition-colors">
          <div className="flex items-center gap-3">
            {lendingToken.icon ? <img src={lendingToken.icon} alt={lendingToken.symbol} className="w-10 h-10 rounded-full object-cover" /> : <div className={cn("w-10 h-10 rounded-full", lendingToken.color)} />}
            <div className="text-left">
              <div className="text-white font-bold text-lg">{lendingToken.symbol}</div>
              <div className="text-xs text-zinc-500">{lendingToken.name}</div>
            </div>
          </div>
          <ChevronDown className="w-5 h-5 text-zinc-500" />
        </button>
      </div>

      <DataInput label={`Amount to ${lendingAction} per execution`} value={spendAmount} onChange={(e) => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) setSpendAmount(v); }} type="text" inputMode="decimal" placeholder="100" />
    </>
  );

  const StakingForm = () => (
    <>
      <TokenModal isOpen={showStakingTokenModal} onClose={() => setShowStakingTokenModal(false)} tokens={STAKING_TOKENS} onSelect={setStakingToken} title="Select Token to Stake" />

      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-500">Token to stake</label>
        <button onClick={() => setShowStakingTokenModal(true)} className="w-full flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-xl hover:bg-black/60 transition-colors">
          <div className="flex items-center gap-3">
            {stakingToken.icon ? <img src={stakingToken.icon} alt={stakingToken.symbol} className="w-10 h-10 rounded-full object-cover" /> : <div className={cn("w-10 h-10 rounded-full", stakingToken.color)} />}
            <div className="text-left">
              <div className="text-white font-bold text-lg">{stakingToken.symbol}</div>
              <div className="text-xs text-zinc-500">{stakingToken.name}</div>
            </div>
          </div>
          <ChevronDown className="w-5 h-5 text-zinc-500" />
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-500">You will receive</span>
          <span className="text-white font-medium">{stakingToken.symbol === "ETH" ? "stETH (Lido)" : "sAVAX (Benqi)"}</span>
        </div>
      </div>

      <DataInput label="Amount to stake per execution" value={spendAmount} onChange={(e) => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) setSpendAmount(v); }} type="text" inputMode="decimal" placeholder="0.5" />
    </>
  );

  const LPForm = () => (
    <>
      {/* Pool selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-500">Liquidity Pool</label>
        <div className="relative">
          <button onClick={() => setShowPoolSelector(!showPoolSelector)} className="w-full flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-xl hover:bg-black/60 transition-colors">
            <div className="text-left">
              <div className="text-white font-bold">{selectedPool.name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-400">{selectedPool.chain}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">{selectedPool.protocol}</span>
                <span className="text-xs text-emerald-400 font-medium">APR {selectedPool.apr}</span>
              </div>
            </div>
            <ChevronDown className={cn("w-5 h-5 text-zinc-500 transition-transform", showPoolSelector && "rotate-180")} />
          </button>

          <AnimatePresence>
            {showPoolSelector && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 right-0 mt-2 bg-black border border-white/10 rounded-xl overflow-hidden z-20">
                {LP_POOLS.map((pool) => (
                  <button key={pool.id} onClick={() => { setSelectedPool(pool); setShowPoolSelector(false); }} className={cn("w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors", selectedPool.id === pool.id && "bg-purple-500/10")}>
                    <div className="text-left">
                      <div className="text-white font-medium">{pool.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-zinc-500">{pool.protocol}</span>
                        <span className="text-[10px] text-zinc-500">{pool.chain}</span>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-400 font-medium">{pool.apr}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <DataInput label={`Amount ${selectedPool.tokenA} per execution`} value={spendAmount} onChange={(e) => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) setSpendAmount(v); }} type="text" inputMode="decimal" placeholder="100" />
      <DataInput label={`Amount ${selectedPool.tokenB} per execution`} value={amountB} onChange={(e) => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) setAmountB(v); }} type="text" inputMode="decimal" placeholder="100" />
    </>
  );

  const renderFormByType = () => {
    switch (strategyType) {
      case "swap": return SwapForm();
      case "lending": return LendingForm();
      case "liquid_staking": return StakingForm();
      case "liquidity_pool": return LPForm();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pb-20 md:pb-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        data-tour="widget-dca"
        variants={modalVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full md:max-w-[480px] md:my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard className="w-full shadow-2xl overflow-hidden relative bg-[#0A0A0A] border-white/10 max-h-[78vh] md:max-h-[85vh] md:h-auto md:min-h-[600px] flex flex-col rounded-2xl border pb-safe overflow-y-auto">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-cyan-500/10 blur-[60px] pointer-events-none" />

          <AnimatePresence mode="wait">
            {/* ── STATE 0: STRATEGY TYPE SELECTOR ── */}
            {viewState === "select" && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full relative"
              >
                {/* Header */}
                <div className="p-6 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-display font-bold text-white">DCA Strategy</h2>
                      <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Choose Strategy Type</div>
                    </div>
                  </div>
                  <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-6 pb-8 space-y-3 relative z-10 flex-1 flex flex-col">
                  <p className="text-sm text-zinc-400 mb-2">
                    Select what you want to automate. Each type runs on the schedule you choose.
                  </p>

                  {STRATEGY_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.type}
                        onClick={() => { setStrategyType(option.type); setViewState("input"); }}
                        className="w-full flex items-start gap-4 p-4 bg-black/40 border border-white/10 rounded-xl hover:bg-white/5 hover:border-white/20 transition-all group text-left"
                      >
                        <div className={cn("p-2.5 rounded-xl shrink-0", option.bgColor)}>
                          <Icon className={cn("w-5 h-5", option.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold group-hover:text-cyan-400 transition-colors">{option.label}</div>
                          <div className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{option.description}</div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-zinc-600 -rotate-90 shrink-0 mt-1 group-hover:text-white transition-colors" />
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── STATE 1: INPUT ── */}
            {viewState === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full relative"
              >
                {/* Header */}
                <div className="p-6 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setViewState("select")} className="p-2 -ml-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className={cn("p-2 rounded-lg", strategyMeta.bgColor)}>
                      <strategyMeta.icon className={cn("w-5 h-5", strategyMeta.color)} />
                    </div>
                    <div>
                      <h2 className="text-xl font-display font-bold text-white">DCA {strategyMeta.label}</h2>
                      <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Configure Strategy</div>
                    </div>
                  </div>
                  <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-6 pb-8 space-y-6 relative z-10 flex-1 flex flex-col overflow-y-auto">
                  <WalletSelector />
                  {renderFormByType()}
                  <FrequencySelector />

                  {/* Summary Card */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-500">Next execution</span>
                      <span className="text-white font-medium">{nextPurchaseDate}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-500">Duration</span>
                      <span className="text-white font-medium">Until Cancelled</span>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="mt-auto">
                    <NeonButton onClick={() => setViewState("review")} disabled={!selectedAccount || smartAccounts.length === 0} className="bg-primary text-black hover:bg-primary/90 shadow-[0_0_20px_rgba(34,211,238,0.25)] border-none w-full disabled:opacity-50 disabled:cursor-not-allowed">
                      Review Strategy
                    </NeonButton>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STATE 2: REVIEW (unified for all types) ── */}
            {viewState === "review" && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                <div className="p-6 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setViewState("input")} className="p-2 -ml-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-lg font-display font-bold text-white">Confirm Strategy</h2>
                  </div>
                  <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-6 pb-8 flex-1 flex flex-col relative z-10 overflow-y-auto custom-scrollbar">
                  {/* Strategy type badge */}
                  <div className="flex justify-center mb-4">
                    <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium", strategyMeta.bgColor, strategyMeta.color)}>
                      <strategyMeta.icon className="w-3.5 h-3.5" />
                      DCA {strategyMeta.label}
                    </div>
                  </div>

                  {/* Summary block */}
                  {(() => {
                    const summary = getReviewSummary();
                    return (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6 text-center">
                        <div className="text-zinc-400 text-sm mb-1">{summary.action}</div>
                        <div className="text-2xl font-bold text-white font-display mb-2">{summary.detail}</div>
                        <div className="text-zinc-500 text-sm mb-2">on {summary.chain}</div>
                        {summary.extra && <div className="text-xs text-zinc-400">{summary.extra}</div>}
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mt-3">
                          <Clock className="w-3 h-3" />
                          Every {intervalDays} Day{intervalDays > 1 ? "s" : ""}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Wallet Info */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-cyan-500/10 rounded-lg"><Wallet className="w-4 h-4 text-cyan-400" /></div>
                      <div>
                        <div className="text-white font-medium">{selectedAccount?.name}</div>
                        <div className="text-xs text-zinc-500 font-mono">{selectedAccount?.address.slice(0, 10)}...{selectedAccount?.address.slice(-8)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline Preview */}
                  <div className="mb-6 px-4 relative">
                    <div className="absolute left-[27px] top-2 bottom-2 w-0.5 bg-white/10" />
                    <div className="space-y-6 relative z-10">
                      <div className="flex items-start gap-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 mt-1.5 ring-4 ring-black" />
                        <div>
                          <div className="text-white font-medium text-sm">Now</div>
                          <div className="text-zinc-500 text-xs">Strategy will be created</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-700 mt-1.5 ring-4 ring-black border border-white/20" />
                        <div>
                          <div className="text-white font-medium text-sm">1st Execution: {nextPurchaseDate}</div>
                          <div className="text-zinc-500 text-xs">First automated {strategyMeta.label.toLowerCase()}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-700 mt-1.5 ring-4 ring-black border border-white/20" />
                        <div>
                          <div className="text-white font-medium text-sm">Continues automatically</div>
                          <div className="text-zinc-500 text-xs">Until you cancel the strategy</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gas info */}
                  <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500 shrink-0"><Fuel className="w-5 h-5" /></div>
                      <div>
                        <span className="text-white font-medium text-sm">Gas Required</span>
                        <p className="text-zinc-500 text-xs leading-relaxed mt-1">Make sure your Panorama Wallet has enough ETH to pay for gas fees on each execution.</p>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mb-4">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="mt-auto">
                    <NeonButton onClick={handleCreateStrategy} disabled={isCreating} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 border-none w-full disabled:opacity-50">
                      {isCreating ? (
                        <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Creating Strategy...</span>
                      ) : (
                        "Activate Strategy"
                      )}
                    </NeonButton>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STATE 3: SIGN (Base DCAVault) ── */}
            {viewState === "sign" && vaultBundle && (
              <motion.div
                key="sign"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col h-full items-center justify-center p-6 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-10 h-10 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Sign to Confirm</h2>
                <p className="text-zinc-400 mb-6">
                  Your DCA {strategyMeta.label} order is ready. Sign{" "}
                  <span className="text-white font-medium">{vaultBundle.steps.length} transaction{vaultBundle.steps.length > 1 ? "s" : ""}</span>{" "}
                  in your wallet to activate it on-chain.
                </p>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 w-full mb-6 space-y-2 text-left">
                  {vaultBundle.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">{i + 1}</div>
                      <div className="text-white font-mono text-xs">{step.to.slice(0, 10)}...{step.to.slice(-6)}</div>
                    </div>
                  ))}
                </div>
                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
                <NeonButton onClick={handleSign} disabled={isSigning} className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 border-none w-full">
                  {isSigning ? (signStep ? `Signing ${signStep.current}/${signStep.total}...` : "Waiting for wallet...") : "Open Wallet to Sign"}
                </NeonButton>
              </motion.div>
            )}

            {/* ── STATE 4: SUCCESS ── */}
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
                <h2 className="text-2xl font-bold text-white mb-2">Strategy Created!</h2>
                <p className="text-zinc-400 mb-6">Your DCA {strategyMeta.label} strategy is now active and will execute automatically.</p>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 w-full mb-6 space-y-3">
                  {(() => {
                    const summary = getReviewSummary();
                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Type</span>
                          <span className="text-white font-medium">{strategyMeta.label}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Strategy</span>
                          <span className="text-white font-medium">{summary.detail}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Frequency</span>
                          <span className="text-white font-medium capitalize">Every {intervalDays} day{intervalDays > 1 ? "s" : ""}</span>
                        </div>
                        {nextExecution && (
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">First Execution</span>
                            <span className="text-white font-medium">{nextExecution.toLocaleDateString()}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <NeonButton onClick={onClose} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 border-none w-full">
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
