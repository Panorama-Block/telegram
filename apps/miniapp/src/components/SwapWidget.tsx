import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftRight } from "lucide-react";
import {
  X,
  ArrowDown,
  Check,
  ChevronRight,
  Triangle
} from "lucide-react";
import * as Switch from '@radix-ui/react-switch';
import { useState, useMemo, useEffect, useRef } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DataInput } from "@/components/ui/DataInput";
import { cn } from "@/lib/utils";
import { TokenSelectionModal } from "@/components/TokenSelectionModal";

// API Integration - TON bridge uses separate API
import { bridgeApi } from "@/features/swap/bridgeApi";
import { TON_CHAIN_ID, CROSS_CHAIN_SUPPORTED_CHAIN_IDS, CROSS_CHAIN_SUPPORTED_SYMBOLS } from "@/features/swap/tokens";
import {
  normalizeToApi,
  formatAmountHuman,
  parseAmountToWei,
  getTokenDecimals,
  isNative
} from "@/features/swap/utils";
import { useActiveAccount, ConnectButton, useSwitchActiveWalletChain } from "thirdweb/react";
import { Bridge, prepareTransaction, sendTransaction, sendAndConfirmTransaction, createThirdwebClient, defineChain } from "thirdweb";
import { THIRDWEB_CLIENT_ID } from "@/shared/config/thirdweb";
import { useTonConnectUI } from '@tonconnect/ui-react';
import { getUserJettonWallet, toUSDT } from '@/lib/ton-helpers';
import { beginCell, toNano, Address as TonAddress } from '@ton/core';
import { inAppWallet } from "thirdweb/wallets";

interface SwapWidgetProps {
  onClose: () => void;
  initialFromToken?: any;
  initialToToken?: any;
  initialAmount?: string;
}

type ViewState = 'input' | 'routing' | 'details' | 'confirm';

// Helper to get color based on network/token
const getTokenColor = (token: any) => {
  if (!token?.network) return 'bg-zinc-500';
  if (token.network === 'TON') return 'bg-blue-400';
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

const DEFAULT_SELL_TOKEN = { ticker: "ETH", name: "Ethereum", network: "Ethereum", address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", balance: "0.00", icon: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" };
const DEFAULT_BUY_TOKEN = { ticker: "AVAX", name: "Avalanche", network: "Avalanche", address: "0x0000000000000000000000000000000000000000", balance: "0.00", icon: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png" };

// Translate Portuguese error messages to English
const translateError = (message: string): string => {
  const translations: Record<string, string> = {
    'Estamos enfrentando uma instabilidade pontual': 'We are experiencing temporary instability. Please try again later.',
    'Erro ao obter cotação': 'Error getting quote',
    'Falha na transação': 'Transaction failed',
    'Saldo insuficiente': 'Insufficient balance',
    'Valor mínimo não atingido': 'Minimum amount not reached',
    'Valor máximo excedido': 'Maximum amount exceeded',
    'Rede não suportada': 'Network not supported',
    'Token não suportado': 'Token not supported',
    'Erro de conexão': 'Connection error',
    'Tempo limite excedido': 'Request timeout',
    'Serviço indisponível': 'Service unavailable',
    'AMOUNT_TOO_LOW': 'Amount too low. Please increase the swap amount to cover network fees.',
    'amount is too low': 'Amount too low. Please increase the swap amount to cover network fees.',
    'The provided amount is too low': 'Amount too low. Please increase the swap amount to cover network fees.',
  };

  // Check for exact match
  if (translations[message]) {
    return translations[message];
  }

  // Check if message contains any Portuguese phrase
  for (const [pt, en] of Object.entries(translations)) {
    if (message.toLowerCase().includes(pt.toLowerCase())) {
      return message.replace(new RegExp(pt, 'gi'), en);
    }
  }

  return message;
};

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
    case 'TON': return TON_CHAIN_ID;
    default: return 8453; // Default Base
  }
};

const getLayerswapNetwork = (networkName: string): string => {
  const mapping: Record<string, string> = {
    'TON': 'TON_MAINNET',
    'Ethereum': 'ETHEREUM_MAINNET',
    'Base': 'BASE_MAINNET',
    'Arbitrum': 'ARBITRUM_MAINNET',
    'Optimism': 'OPTIMISM_MAINNET',
    'Polygon': 'POLYGON_MAINNET',
    'Avalanche': 'AVALANCHE_MAINNET',
    'Binance Smart Chain': 'BSC_MAINNET',
    'World Chain': 'WORLDCHAIN_MAINNET', // Verify if supported, fallback might be needed
  };
  return mapping[networkName] || 'ETHEREUM_MAINNET'; // Default or throw
};

const getBridgeTokenSymbol = (token: any) => token?.ticker || token?.symbol || token?.name || 'USDT';

const isPendingHash = (hash?: string | null) => {
  if (!hash) return true;
  return hash.toLowerCase().includes('pending');
};

const getExplorerUrl = (hash: string, chainId: number) => {
  if (isPendingHash(hash)) return null;
  if (!hash) return null;
  if (chainId === TON_CHAIN_ID) {
    return `https://tonviewer.com/transaction/${hash}`;
  }
  if (chainId === 1) return `https://etherscan.io/tx/${hash}`;
  if (chainId === 8453) return `https://basescan.org/tx/${hash}`;
  if (chainId === 10) return `https://optimistic.etherscan.io/tx/${hash}`;
  if (chainId === 137) return `https://polygonscan.com/tx/${hash}`;
  if (chainId === 56) return `https://bscscan.com/tx/${hash}`;
  if (chainId === 43114) return `https://snowtrace.io/tx/${hash}`;
  if (chainId === 42161) return `https://arbiscan.io/tx/${hash}`;
  if (chainId === 480) return `https://worldscan.org/tx/${hash}`;
  return null;
};

const getExplorerName = (chainId: number): string => {
  if (chainId === TON_CHAIN_ID) return 'TON Viewer';
  if (chainId === 1) return 'Etherscan';
  if (chainId === 8453) return 'Basescan';
  if (chainId === 10) return 'Optimism Explorer';
  if (chainId === 137) return 'Polygonscan';
  if (chainId === 56) return 'BscScan';
  if (chainId === 43114) return 'Snowtrace';
  if (chainId === 42161) return 'Arbiscan';
  if (chainId === 480) return 'Worldscan';
  return 'Explorer';
};

const formatAddress = (address?: string | null) => {
  if (!address) return '-';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function SwapWidget({ onClose, initialFromToken, initialToToken, initialAmount }: SwapWidgetProps) {
  const account = useActiveAccount();
  const switchChain = useSwitchActiveWalletChain();
  const clientId = THIRDWEB_CLIENT_ID;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);
  const [tonConnectUI] = useTonConnectUI();
  const wallets = useMemo(() => (clientId ? [inAppWallet({ auth: { options: ['telegram'], mode: 'popup' } })] : []), [client])

  const [viewState, setViewState] = useState<ViewState>('input');
  const [showTokenList, setShowTokenList] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [refuelEnabled, setRefuelEnabled] = useState(true);

  // Token State
  const [activeSlot, setActiveSlot] = useState<'sell' | 'buy'>('sell');
  const [sellToken, setSellToken] = useState(initialFromToken || DEFAULT_SELL_TOKEN);
  const [buyToken, setBuyToken] = useState(initialToToken || DEFAULT_BUY_TOKEN);
  const [amount, setAmount] = useState<string>(initialAmount || ""); // Will be set to balance when loaded
  const [initialBalanceSet, setInitialBalanceSet] = useState(false);

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
  const [currentSwapId, setCurrentSwapId] = useState<string | null>(null);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [swapStatusError, setSwapStatusError] = useState<string | null>(null);

  // Balance State
  const [sellTokenBalance, setSellTokenBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const isCrossChain = sellToken.network !== buyToken.network;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Cross-chain support validation
  const crossChainSupport = useMemo(() => {
    if (!isCrossChain) {
      return { supported: true, reason: undefined };
    }

    const fromChainId = getBaseChainId(sellToken.network);
    const toChainId = getBaseChainId(buyToken.network);
    const tokenSymbol = sellToken.ticker || sellToken.symbol;

    // TON bridge is always supported (has its own flow)
    if (fromChainId === TON_CHAIN_ID || toChainId === TON_CHAIN_ID) {
      return { supported: true, reason: undefined };
    }

    // Check if source chain supports cross-chain
    if (!CROSS_CHAIN_SUPPORTED_CHAIN_IDS.includes(fromChainId)) {
      return {
        supported: false,
        reason: `Cross-chain swaps from ${sellToken.network} are not yet supported`
      };
    }

    // Check if destination chain supports cross-chain
    if (!CROSS_CHAIN_SUPPORTED_CHAIN_IDS.includes(toChainId)) {
      return {
        supported: false,
        reason: `Cross-chain swaps to ${buyToken.network} are not yet supported`
      };
    }

    // Check if the sell token is supported for cross-chain
    if (!CROSS_CHAIN_SUPPORTED_SYMBOLS.includes(tokenSymbol)) {
      return {
        supported: false,
        reason: `${tokenSymbol} is not supported for cross-chain swaps. Try using ETH, USDC, or USDT instead.`
      };
    }

    return { supported: true, reason: undefined };
  }, [isCrossChain, sellToken, buyToken]);

  // Effects
  useEffect(() => {
    if (initialFromToken) setSellToken(initialFromToken);
    if (initialToToken) setBuyToken(initialToToken);
  }, [initialFromToken, initialToToken]);

  // Reset initial balance flag when sell token changes to update amount
  useEffect(() => {
    setInitialBalanceSet(false);
    setAmount("");
  }, [sellToken.address, sellToken.network]);

  // Fetch sell token balance
  useEffect(() => {
    if (!client || !account?.address || !sellToken) {
      setSellTokenBalance(null);
      return;
    }

    const fromChainId = getBaseChainId(sellToken.network);
    if (fromChainId === TON_CHAIN_ID) {
      // TON balance handled separately
      setSellTokenBalance(null);
      return;
    }

    let cancelled = false;
    setLoadingBalance(true);

    const fetchBalance = async () => {
      try {
        const { getContract } = await import("thirdweb");
        const { getBalance } = await import("thirdweb/extensions/erc20");
        const { eth_getBalance, getRpcClient } = await import("thirdweb/rpc");

        const tokenAddress = sellToken.address?.toLowerCase();
        const isNativeToken = !tokenAddress ||
          tokenAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
          tokenAddress === '0x0000000000000000000000000000000000000000' ||
          tokenAddress === 'native';

        let balance: bigint;
        let decimals = sellToken.decimals || 18;

        if (isNativeToken) {
          // Native token balance (ETH, AVAX, etc)
          const rpcRequest = getRpcClient({ client, chain: defineChain(fromChainId) });
          balance = await eth_getBalance(rpcRequest, { address: account.address });
        } else {
          // ERC20 token balance
          const tokenContract = getContract({
            client,
            chain: defineChain(fromChainId),
            address: sellToken.address,
          });
          const balanceResult = await getBalance({ contract: tokenContract, address: account.address });
          balance = balanceResult.value;
          decimals = balanceResult.decimals;
        }

        if (cancelled) return;

        // Format balance
        const formattedBalance = formatAmountHuman(balance, decimals, 6);
        setSellTokenBalance(formattedBalance);

        // Set initial amount to balance if not already set
        if (!initialBalanceSet && formattedBalance && parseFloat(formattedBalance) > 0) {
          setAmount(formattedBalance);
          setInitialBalanceSet(true);
        }
      } catch (error) {
        console.error("[SwapWidget] Error fetching balance:", error);
        if (!cancelled) setSellTokenBalance(null);
      } finally {
        if (!cancelled) setLoadingBalance(false);
      }
    };

    fetchBalance();

    return () => {
      cancelled = true;
    };
  }, [client, account?.address, sellToken]);

  // Poll bridge status when we have a swapId
  useEffect(() => {
    if (!currentSwapId) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const pollStatus = async () => {
      try {
        const statusRes = await bridgeApi.getStatus(currentSwapId);
        if (cancelled) return;

        const data = (statusRes as any)?.data || statusRes;
        const status = data?.status || data?.state;
        const txHash = data?.transactionHash || data?.txHash;
        const chainId = data?.chainId || TON_CHAIN_ID;

        if (status) setSwapStatus(status);
        if (txHash) {
          setTxHashes((prev) => {
            if (prev.some((p) => p.hash === txHash)) return prev;
            const withoutPending = prev.filter((p) => !isPendingHash(p.hash));
            return [...withoutPending, { hash: txHash, chainId }];
          });
        }

        if (status && ['completed', 'finished', 'failed', 'canceled', 'refunded'].includes(status.toLowerCase())) {
          if (interval) clearInterval(interval);
        }
      } catch (e: any) {
        if (!cancelled) setSwapStatusError(translateError(e.message || 'Failed to fetch swap status'));
      }
    };

    void pollStatus();
    interval = setInterval(() => void pollStatus(), 15000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [currentSwapId]);

  const canQuote = useMemo(() => {
    return Boolean(sellToken && buyToken && amount && Number(amount) > 0 && crossChainSupport.supported);
  }, [sellToken, buyToken, amount, crossChainSupport.supported]);

  // Check if user has sufficient balance
  const insufficientBalance = useMemo(() => {
    if (!sellTokenBalance || !amount || Number(amount) <= 0) return false;
    const balance = parseFloat(sellTokenBalance.replace(/,/g, ''));
    const amountNum = parseFloat(amount);
    return amountNum > balance;
  }, [sellTokenBalance, amount]);

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
  }, [canQuote, sellToken, buyToken, amount, account, refuelEnabled]);

  async function performQuote(requestId: number) {
    if (!canQuote || !client) return;

    try {
      setQuoting(true);
      const fromChainId = getBaseChainId(sellToken.network);
      const toChainId = getBaseChainId(buyToken.network);

      // TON bridge uses separate API
      if (fromChainId === TON_CHAIN_ID || buyToken.network === 'TON') {
        const sourceNetwork = getLayerswapNetwork(sellToken.network);
        const destinationNetwork = getLayerswapNetwork(buyToken.network);
        const sourceTokenSymbol = getBridgeTokenSymbol(sellToken);
        const destinationTokenSymbol = getBridgeTokenSymbol(buyToken);

        const bridgeRes = await bridgeApi.quote(
          Number(amount),
          sourceNetwork,
          destinationNetwork,
          refuelEnabled,
          sourceTokenSymbol,
          destinationTokenSymbol
        );

        if (quoteRequestRef.current !== requestId) return;

        if (!bridgeRes.success || !bridgeRes.quote) {
          throw new Error('Failed to get bridge quote');
        }

        setQuote(bridgeRes.quote);
        return;
      }

      // EVM swap - use ThirdWeb SDK directly
      // Get decimals - fallback to known values for common tokens
      const sellSymbol = (sellToken.ticker || sellToken.symbol || '').toUpperCase();
      const decimals = sellToken.decimals ||
        (sellSymbol === 'USDC' || sellSymbol === 'USDT' ? 6 :
         sellSymbol === 'WBTC' || sellSymbol === 'BTC.B' ? 8 : 18);
      const weiAmount = parseAmountToWei(amount, decimals);

      console.log("[SwapWidget] Token decimals:", { symbol: sellSymbol, decimals, rawDecimals: sellToken.decimals });

      console.log("[SwapWidget] Getting quote from ThirdWeb SDK...", {
        fromChainId,
        toChainId,
        amount: weiAmount.toString(),
      });

      const quoteResult = await Bridge.Sell.quote({
        originChainId: fromChainId,
        originTokenAddress: normalizeToApi(sellToken.address || 'native') as `0x${string}`,
        destinationChainId: toChainId,
        destinationTokenAddress: normalizeToApi(buyToken.address || 'native') as `0x${string}`,
        amount: BigInt(weiAmount),
        client,
      });

      if (quoteRequestRef.current !== requestId) return;

      console.log("[SwapWidget] Quote result:", quoteResult);

      setQuote({
        estimatedReceiveAmount: quoteResult.destinationAmount.toString(),
        originAmount: quoteResult.originAmount.toString(),
        estimatedExecutionTimeMs: quoteResult.estimatedExecutionTimeMs,
      });

    } catch (e: any) {
      if (quoteRequestRef.current !== requestId) return;
      console.error("Quote error:", e);
      setQuoteError(translateError(e.message || "Unable to fetch quote"));
    } finally {
      if (quoteRequestRef.current === requestId) {
        setQuoting(false);
      }
    }
  }

  // Execution Logic
  async function handleSwap() {
    if (!quote) return;

    const fromChainId = getBaseChainId(sellToken.network);

    // --- TON SWAP FLOW ---
    if (fromChainId === TON_CHAIN_ID) {
      const userTonAddress = tonConnectUI.account?.address;
      if (!userTonAddress) {
        setExecutionError("Please connect your TON wallet");
        return;
      }

      // We need an EVM destination address. 
      // If the user is connected via Thirdweb, use that.
      // Otherwise check localStorage or ask user (not implemented here yet, assuming connected)
      const evmAddress = account?.address || localStorage.getItem('userAddress');
      if (!evmAddress) {
        setExecutionError("Destination EVM address not found. Please connect your EVM wallet.");
        return;
      }

      setPreparing(true);
      setExecutionError(null);
      setTxHashes([]);

      try {
        // 1. Create Swap on Backend
        const sourceNetwork = getLayerswapNetwork(sellToken.network);
        const destinationNetwork = getLayerswapNetwork(buyToken.network);
        const sourceTokenSymbol = getBridgeTokenSymbol(sellToken);
        const destinationTokenSymbol = getBridgeTokenSymbol(buyToken);

        const bridgeTx = await bridgeApi.createTransaction(
          Number(amount),
          evmAddress,
          userTonAddress,
          sourceNetwork,
          destinationNetwork,
          refuelEnabled,
          sourceTokenSymbol,
          destinationTokenSymbol
        );

        console.log('🌉 Bridge Transaction Response:', bridgeTx);

        // The response structure is { transaction: { swapId, depositAddress, ... }, quote: ... }
        const txData = bridgeTx.transaction || bridgeTx;
        const swapId = txData.swapId || txData.id;
        const layerswapVault = txData.depositAddress || txData.destination || txData.vaultAddress;

        if (!swapId) throw new Error("Bridge API did not return a Swap ID");
        if (!layerswapVault) throw new Error("Bridge API did not return a Vault Address");
        setCurrentSwapId(swapId);
        setSwapStatus(null);
        setSwapStatusError(null);

        // 2. Get User's USDT Wallet
        const myUsdtWallet = await getUserJettonWallet(userTonAddress);

        // 3. Construct Payload
        const txPayload = txData.transactionPayload || txData.transaction_payload || {};
        const comment =
          txPayload.depositActions?.[0]?.comment ||
          txPayload.deposit_actions?.[0]?.comment ||
          txPayload.comment;

        if (!comment) {
          throw new Error("Bridge API did not return a deposit memo/comment");
        }

        console.log("Bridge transaction payload:", txPayload, "Using comment:", comment);

        const forwardPayload = beginCell()
          .storeUint(0, 32) // 0 = Text Comment
          .storeStringTail(comment)
          .endCell();

        const body = beginCell()
          .storeUint(0xf8a7ea5, 32) // OpCode: Transfer
          .storeUint(0, 64)         // QueryID
          .storeCoins(toUSDT(amount)) // USDT Amount (6 decimals)
          .storeAddress(TonAddress.parse(layerswapVault))
          .storeAddress(TonAddress.parse(userTonAddress))
          .storeBit(0)
          .storeCoins(toNano('0.01')) // Forward Amount
          .storeBit(1)
          .storeRef(forwardPayload)
          .endCell();

        setPreparing(false);
        setExecuting(true);

        // 4. Send Transaction
        const transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 600,
          messages: [
            {
              address: myUsdtWallet.toString(),
              amount: toNano('0.1').toString(), // Gas
              payload: body.toBoc().toString('base64')
            }
          ]
        };

        const result = await tonConnectUI.sendTransaction(transaction);
        console.log('TON Transaction sent:', result);

        // TON Connect doesn't always return hash easily in all wallets, 
        // but if successful we show pending.
        setTxHashes([{ hash: 'pending', chainId: TON_CHAIN_ID }]);

      } catch (e: any) {
        console.error("TON Swap error:", e);
        setExecutionError(translateError(e.message || "TON Swap failed"));
      } finally {
        setPreparing(false);
        setExecuting(false);
      }
      return;
    }

    // --- EVM SWAP FLOW (Including EVM -> TON Bridge) ---
    if (!client || !account) return;

    setPreparing(true);
    setExecutionError(null);
    setTxHashes([]);

    try {
      const toChainId = getBaseChainId(buyToken.network);

      // Check if this is EVM -> TON Bridge
      if (buyToken.network === 'TON') {
        const userTonAddress = tonConnectUI.account?.address;
        if (!userTonAddress) {
          setExecutionError("Please connect your TON wallet");
          setPreparing(false);
          return;
        }

        // 1. Create Bridge Transaction
        const sourceNetwork = getLayerswapNetwork(sellToken.network);
        const destinationNetwork = getLayerswapNetwork(buyToken.network);
        const sourceTokenSymbol = getBridgeTokenSymbol(sellToken);
        const destinationTokenSymbol = getBridgeTokenSymbol(buyToken);

        const bridgeTx = await bridgeApi.createTransaction(
          Number(amount),
          userTonAddress, // Destination is TON
          account.address, // Source Address (EVM)
          sourceNetwork, // Source Network
          destinationNetwork, // Destination Network
          refuelEnabled,
          sourceTokenSymbol,
          destinationTokenSymbol
        );

        console.log('🌉 Bridge Transaction Response:', bridgeTx);

        const txData = bridgeTx.transaction || bridgeTx;
        const swapId = txData.swapId || txData.id;
        const depositAddress = txData.depositAddress || txData.destination || txData.vaultAddress;

        if (!depositAddress) throw new Error("Bridge API did not return a Deposit Address");
        if (swapId) {
          setCurrentSwapId(swapId);
          setSwapStatus(null);
          setSwapStatusError(null);
        }

        // 2. Send EVM Transaction to Deposit Address
        const decimals = await getTokenDecimals({
          client,
          chainId: fromChainId,
          token: sellToken.address
        }).catch(() => 18);

        const wei = parseAmountToWei(amount, decimals);

        setExecuting(true);

        // Prepare and send transaction
        let transaction;

        if (isNative(sellToken.address)) {
          transaction = prepareTransaction({
            to: depositAddress,
            chain: defineChain(fromChainId),
            client,
            value: wei,
          });
        } else {
          // ERC20 Transfer
          const { prepareContractCall, getContract } = await import("thirdweb");

          const contract = getContract({
            client,
            chain: defineChain(fromChainId),
            address: sellToken.address
          });

          transaction = prepareContractCall({
            contract,
            method: "function transfer(address to, uint256 value)",
            params: [depositAddress, BigInt(wei)]
          });
        }

        const receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        });

        setTxHashes([{ hash: receipt.transactionHash, chainId: fromChainId }]);
        return;
      }

      // Standard EVM Swap - SDK with approval FIRST
      // Get decimals - try from contract first, fallback to known values
      const sellSymbol = (sellToken.ticker || sellToken.symbol || '').toUpperCase();
      const knownDecimals = sellSymbol === 'USDC' || sellSymbol === 'USDT' ? 6 :
                            sellSymbol === 'WBTC' || sellSymbol === 'BTC.B' ? 8 : 18;
      const decimals = await getTokenDecimals({
        client,
        chainId: fromChainId,
        token: sellToken.address
      }).catch(() => knownDecimals);

      console.log("[SwapWidget] Swap decimals:", { symbol: sellSymbol, decimals });

      const weiAmount = parseAmountToWei(amount, decimals);
      const originToken = normalizeToApi(sellToken.address) as `0x${string}`;
      const destinationToken = normalizeToApi(buyToken.address) as `0x${string}`;

      const hashes: Array<{ hash: string, chainId: number }> = [];

      // Prepare swap - ThirdWeb will return all necessary transactions including approvals
      console.log("[SwapWidget] Preparing swap...");

      const prepared = await Bridge.Sell.prepare({
        originChainId: fromChainId,
        originTokenAddress: originToken,
        destinationChainId: toChainId,
        destinationTokenAddress: destinationToken,
        amount: BigInt(weiAmount),
        sender: account.address,
        receiver: account.address,
        client,
      });

      console.log("[SwapWidget] Prepared response:", {
        steps: prepared.steps.length,
        transactions: prepared.steps.flatMap(s => s.transactions).map(t => ({
          action: (t as any).action,
          chainId: (t as any).chainId,
          to: (t as any).to,
          spender: (t as any).spender,
          value: String((t as any).value || '0'),
        })),
        expiration: (prepared as any).expiration,
      });

      // Check if there's an approval transaction and log the spender
      const allTxs = prepared.steps.flatMap(s => s.transactions);
      const approvalTx = allTxs.find(t => (t as any).action === 'approval');
      if (approvalTx) {
        console.log("[SwapWidget] Approval needed for spender:", (approvalTx as any).spender || (approvalTx as any).to);
      } else {
        console.log("[SwapWidget] No approval needed (already approved or native token)");
      }

      setPreparing(false);
      setExecuting(true);

      // Track current chain to avoid unnecessary switches
      let currentWalletChainId: number | null = null;

      // Execute ALL transactions from ThirdWeb (approvals + swaps)
      for (const step of prepared.steps) {
        for (const transaction of step.transactions) {
          const txAction = (transaction as any).action || 'unknown';
          console.log(`[SwapWidget] Executing ${txAction} transaction...`);

          // Get the chainId from the transaction
          const txChainId = (transaction as any).chainId || fromChainId;

          // Switch chain if needed
          if (currentWalletChainId !== txChainId) {
            console.log(`[SwapWidget] Transaction requires chain ${txChainId}, switching...`);
            try {
              await switchChain(defineChain(txChainId));
              // Wait a bit for the wallet to fully switch
              await new Promise(resolve => setTimeout(resolve, 500));
              currentWalletChainId = txChainId;
              console.log(`[SwapWidget] ✅ Switched to chain ${txChainId}`);
            } catch (switchError: any) {
              console.error(`[SwapWidget] Failed to switch to chain ${txChainId}:`, switchError);
              const networkName = Object.entries({
                1: 'Ethereum', 8453: 'Base', 42161: 'Arbitrum', 43114: 'Avalanche',
                137: 'Polygon', 10: 'Optimism', 56: 'BSC', 480: 'World Chain'
              }).find(([id]) => Number(id) === txChainId)?.[1] || `Chain ${txChainId}`;
              throw new Error(`Please switch to ${networkName} in your wallet to continue`);
            }
          }

          // Convert raw transaction to thirdweb prepared transaction
          const preparedTx = prepareTransaction({
            to: (transaction as any).to,
            data: (transaction as any).data,
            value: (transaction as any).value ? BigInt((transaction as any).value) : 0n,
            chain: defineChain(txChainId),
            client,
          });

          const receipt = await sendAndConfirmTransaction({
            transaction: preparedTx,
            account,
          });

          console.log("[SwapWidget] Swap confirmed:", receipt.transactionHash);
          hashes.push({ hash: receipt.transactionHash, chainId: txChainId });
        }
      }

      setTxHashes(hashes);
      // Success handled by UI showing hashes

    } catch (e: any) {
      console.error("Swap execution error:", e);
      setExecutionError(translateError(e.message || "Swap failed"));
    } finally {
      setPreparing(false);
      setExecuting(false);
    }
  }

  // Formatting View Data
  const estimatedOutput = useMemo(() => {
    if (!quote) return "0.00";
    // Handle Bridge Quote (Float)
    if (quote.sourceNetwork && quote.estimatedReceiveAmount) {
      return Number(quote.estimatedReceiveAmount).toFixed(8);
    }

    try {
      // Get decimals from buyToken - common values: 18 (ETH, most tokens), 6 (USDC, USDT), 8 (WBTC)
      const buyDecimals = buyToken.decimals ||
        (buyToken.ticker === 'USDC' || buyToken.ticker === 'USDT' ? 6 :
         buyToken.ticker === 'WBTC' || buyToken.ticker === 'BTC.b' ? 8 : 18);

      // The backend quote returns estimatedReceiveAmount in smallest units (wei for 18 decimals, etc)
      // Use 8 decimal places to show small amounts properly
      return formatAmountHuman(BigInt(quote.estimatedReceiveAmount || quote.toAmount || 0), buyDecimals, 8);
    } catch {
      return "0.00";
    }
  }, [quote, buyToken]);

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

  const primaryLabel = executing ? "Swapping..." : preparing ? "Preparing..." : "Confirm Swap";
  const fromIsTon = sellToken.network === 'TON';
  const toIsTon = buyToken.network === 'TON';
  const fromAddress = fromIsTon ? tonConnectUI.account?.address : account?.address;
  const toAddress = toIsTon ? tonConnectUI.account?.address : account?.address;
  const fromLabel = fromIsTon ? 'TON' : 'EVM';
  const toLabel = toIsTon ? 'TON' : 'EVM';

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
        className="relative w-full md:max-w-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard className="w-full shadow-2xl overflow-hidden relative bg-[#0A0A0A] border-white/10 max-h-[70vh] md:max-h-[85vh] md:h-auto md:min-h-[540px] flex flex-col rounded-2xl border safe-area-pb overflow-y-auto">
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
                <div className="p-4 md:p-6 flex items-center justify-between relative z-20">
                  <div className="flex items-center gap-3">
                    <ArrowLeftRight className="w-6 h-6 text-cyan-400" />
                    <h2 className="text-xl font-display font-bold text-white">Swap</h2>
                  </div>
                  <button onClick={onClose} className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-500 hover:text-white active:text-white hover:bg-white/10 active:bg-white/20 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-4 md:px-6 pb-4 md:pb-6 space-y-2 relative z-10 flex-1 flex flex-col">
                  <DataInput
                    label="Sell"
                    balance={loadingBalance ? 'Loading...' : sellTokenBalance ? `${sellTokenBalance} ${sellToken.ticker}` : `-- ${sellToken.ticker}`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={insufficientBalance ? 'border-red-500/50' : ''}
                    rightElement={
                      <button
                        onClick={() => openTokenList('sell')}
                        className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2.5 sm:px-4 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] hover:bg-zinc-900 active:bg-zinc-800 transition-colors group"
                      >
                        {sellToken.icon ? (
                          <img src={sellToken.icon} alt={sellToken.ticker} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover" />
                        ) : (
                          <div className={cn("w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] text-white font-bold", getTokenColor(sellToken))}>
                            {sellToken.ticker?.[0]}
                          </div>
                        )}
                        <span className="text-white font-medium text-sm sm:text-base">{sellToken.ticker}</span>
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </button>
                    }
                  />

                  <div className="flex justify-center -my-3 relative z-20">
                    <button
                      onClick={() => {
                        const tempToken = sellToken;
                        setSellToken(buyToken);
                        setBuyToken(tempToken);
                        // Swap the amounts: sell amount becomes estimated output
                        if (estimatedOutput && estimatedOutput !== "0.00" && !quoting) {
                          setAmount(estimatedOutput);
                        }
                        setQuote(null);
                      }}
                      className="bg-[#0A0A0A] border border-white/10 p-2 rounded-xl text-zinc-400 hover:text-primary hover:border-primary/50 transition-all"
                    >
                      <ArrowDown className="w-5 h-5" />
                    </button>
                  </div>

                  <DataInput
                    label="Buy"
                    value={quoting ? "..." : estimatedOutput}
                    readOnly
                    rightElement={
                      <button
                        onClick={() => openTokenList('buy')}
                        className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2.5 sm:px-4 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] hover:bg-zinc-900 active:bg-zinc-800 transition-colors group"
                      >
                        {buyToken.icon ? (
                          <img src={buyToken.icon} alt={buyToken.ticker} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover" />
                        ) : (
                          <div className={cn("w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] text-white font-bold", getTokenColor(buyToken))}>
                            {buyToken.ticker?.[0]}
                          </div>
                        )}
                        <span className="text-white font-medium text-sm sm:text-base">{buyToken.ticker}</span>
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </button>
                    }
                  />

                  {/* Insufficient balance warning */}
                  {insufficientBalance && (
                    <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-3 mt-2">
                      <div className="flex items-start gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-red-400 flex-shrink-0 mt-0.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <p className="text-xs font-semibold text-red-400 mb-1">Insufficient Balance</p>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            You have {sellTokenBalance} {sellToken.ticker} but trying to swap {amount} {sellToken.ticker}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cross-chain not supported warning */}
                  {!crossChainSupport.supported && (
                    <div className="bg-orange-500/10 border border-orange-500/40 rounded-xl p-3 mt-2">
                      <div className="flex items-start gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-orange-400 flex-shrink-0 mt-0.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <p className="text-xs font-semibold text-orange-400 mb-1">Pair Not Supported</p>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">{crossChainSupport.reason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quote Error */}
                  {quoteError && crossChainSupport.supported && (
                    <div className="text-red-400 text-xs px-2 mt-2">
                      {quoteError}
                    </div>
                  )}

                  {/* Refuel Toggle for Bridge */}
                  {(getBaseChainId(sellToken.network) === TON_CHAIN_ID || buyToken.network === 'TON') && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 mt-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs sm:text-sm text-white font-medium">Refuel</span>
                            <span className="bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap">Recommended</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 mt-0.5">
                            Receive {buyToken.network === 'TON' ? 'TON' : 'ETH'} for gas
                            {quote?.refuelAmount && (
                              <span className="text-green-400 ml-1">
                                (+{Number(quote.refuelAmount).toFixed(4)})
                              </span>
                            )}
                          </span>
                        </div>
                        <Switch.Root
                          checked={refuelEnabled}
                          onCheckedChange={setRefuelEnabled}
                          className={cn("w-9 h-5 rounded-full relative transition-colors flex-shrink-0", refuelEnabled ? 'bg-primary' : 'bg-zinc-700')}
                        >
                          <Switch.Thumb className={cn("block w-3.5 h-3.5 bg-white rounded-full transition-transform translate-x-0.5 will-change-transform", refuelEnabled ? 'translate-x-[18px]' : 'translate-x-0.5')} />
                        </Switch.Root>
                      </div>
                    </div>
                  )}

                  <div className="mt-auto pt-6 space-y-4">
                    <NeonButton
                      onClick={() => setViewState('routing')}
                      disabled={!quote || quoting || !crossChainSupport.supported || insufficientBalance}
                      className={(!crossChainSupport.supported || insufficientBalance) ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      {quoting ? "Fetching best price..." : insufficientBalance ? "Insufficient Balance" : !crossChainSupport.supported ? "Pair Not Supported" : "Review Swap"}
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
                <div className="p-4 md:p-6 flex items-center justify-between relative z-10">
                  <h2 className="text-lg font-display font-bold text-white">Order Routing</h2>
                  <button onClick={onClose} className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-500 hover:text-white active:text-white hover:bg-white/10 active:bg-white/20 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-4 md:px-6 pb-4 md:pb-6 flex-1 flex flex-col relative z-10">
                  <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-4 md:mb-6">
                    <div className="bg-primary/10 px-4 py-3 border-b border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-primary font-medium text-sm">
                        <Check className="w-4 h-4" />
                        Best price route
                      </div>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {/* From Token */}
                          {sellToken.icon ? (
                            <img src={sellToken.icon} alt={sellToken.ticker} className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold", getTokenColor(sellToken))}>
                              {sellToken.ticker?.[0]}
                            </div>
                          )}
                          <span className="font-medium text-white">{sellToken.ticker}</span>
                          <ArrowDown className="w-4 h-4 text-zinc-500 rotate-[-90deg]" />
                          {/* To Token */}
                          {buyToken.icon ? (
                            <img src={buyToken.icon} alt={buyToken.ticker} className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold", getTokenColor(buyToken))}>
                              {buyToken.ticker?.[0]}
                            </div>
                          )}
                          <span className="font-medium text-white">{buyToken.ticker}</span>
                        </div>
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
                        {quote?.refuelAmount && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Refuel (Gas)</span>
                            <span className="text-green-400 font-mono">
                              +{Number(quote.refuelAmount).toFixed(4)} {buyToken.network === 'TON' ? 'TON' : 'ETH'}
                            </span>
                          </div>
                        )}
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
                <div className="p-4 md:p-6 flex items-center justify-between relative z-10">
                  <h2 className="text-lg font-display font-bold text-white">Confirm Swap</h2>
                  <button onClick={onClose} className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-500 hover:text-white active:text-white hover:bg-white/10 active:bg-white/20 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-4 md:px-6 pb-4 md:pb-6 flex-1 flex flex-col relative z-10">

                  {txHashes.length > 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 space-y-4">
                      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Check className="w-8 h-8 text-green-500" />
                      </div>
                      <h3 className="text-xl font-bold text-white">Swap Submitted!</h3>
                      <div className="text-zinc-400 text-center text-sm max-w-xs">
                        Your transaction has been submitted to the blockchain.
                      </div>

                      {/* Swap Summary */}
                      <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-zinc-500">You sent</span>
                          <div className="flex items-center gap-2">
                            {sellToken.icon && <img src={sellToken.icon} alt={sellToken.ticker} className="w-4 h-4 rounded-full" />}
                            <span className="text-white font-medium">{amount} {sellToken.ticker}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-zinc-500">You receive</span>
                          <div className="flex items-center gap-2">
                            {buyToken.icon && <img src={buyToken.icon} alt={buyToken.ticker} className="w-4 h-4 rounded-full" />}
                            <span className="text-white font-medium">~{estimatedOutput} {buyToken.ticker}</span>
                          </div>
                        </div>
                        {isCrossChain && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500">Route</span>
                            <span className="text-zinc-300">{sellToken.network} → {buyToken.network}</span>
                          </div>
                        )}
                      </div>

                      {/* Transaction Links */}
                      <div className="space-y-2 w-full pt-2">
                        <p className="text-xs text-zinc-500 text-center">Transaction Details</p>
                        {txHashes.map((h, i) => {
                          const explorerUrl = getExplorerUrl(h.hash, h.chainId);
                          const explorerName = getExplorerName(h.chainId);
                          if (!explorerUrl) {
                            return (
                              <div
                                key={i}
                                className="block w-full text-center py-3 bg-white/5 rounded-xl text-zinc-300 text-xs px-4"
                              >
                                Transaction pending — check your wallet activity
                              </div>
                            );
                          }
                          return (
                            <a
                              key={i}
                              href={explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between w-full py-3 px-4 bg-white/5 rounded-xl text-xs hover:bg-white/10 transition-colors"
                            >
                              <span className="text-zinc-400">View on {explorerName}</span>
                              <span className="text-primary font-mono">{h.hash.slice(0, 8)}...{h.hash.slice(-6)}</span>
                            </a>
                          );
                        })}
                        {swapStatus && (
                          <div className="text-center text-xs text-zinc-400 pt-2">
                            Status: <span className="text-primary capitalize">{swapStatus}</span>
                          </div>
                        )}
                        {swapStatusError && (
                          <div className="text-center text-xs text-red-400">
                            Status check failed: {swapStatusError}
                          </div>
                        )}
                      </div>
                      <button onClick={onClose} className="mt-8 text-zinc-400 hover:text-white">
                        Close
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-zinc-400 mb-4">
                        Please review the final details before executing.
                      </p>

                      <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
                        {/* Address Details */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-500">From ({fromLabel})</span>
                            <span className="text-zinc-300 font-mono">
                              {formatAddress(fromAddress)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-500">To ({toLabel})</span>
                            <span className="text-zinc-300 font-mono">
                              {formatAddress(toAddress)}
                            </span>
                          </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                          <span className="text-sm text-zinc-300">I agree to <span className="text-white underline decoration-zinc-500">Terms of Service</span></span>
                          <Switch.Root
                            checked={tosAccepted}
                            onCheckedChange={setTosAccepted}
                            className={cn("w-9 h-5 rounded-full relative transition-colors flex-shrink-0", tosAccepted ? 'bg-primary' : 'bg-zinc-700')}
                          >
                            <Switch.Thumb className={cn("block w-3.5 h-3.5 bg-white rounded-full transition-transform translate-x-0.5 will-change-transform", tosAccepted ? 'translate-x-[18px]' : 'translate-x-0.5')} />
                          </Switch.Root>
                        </div>
                      </div>

                      {executionError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-xs mb-4">
                          {executionError}
                        </div>
                      )}

                      <div className="mt-auto">
                        {/* TON Bridge Logic: Require BOTH wallets */}
                        {sellToken.network === 'TON' || buyToken.network === 'TON' ? (
                          <>
                            {!tonConnectUI.connected ? (
                              <NeonButton
                                onClick={() => tonConnectUI.openModal()}
                                className="bg-blue-500 text-white hover:bg-blue-600 shadow-none mb-2"
                              >
                                Connect TON Wallet
                              </NeonButton>
                            ) : !account ? (
                              <div className="w-full">
                                <ConnectButton
                                  client={client!}
                                  wallets={wallets}
                                  theme={"dark"}
                                  connectButton={{
                                    label: "Connect EVM Wallet",
                                    className: "!w-full !h-12 !rounded-xl !font-bold"
                                  }}
                                />
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
                          </>
                        ) : (
                          /* EVM Logic: Require EVM wallet */
                          !account ? (
                            <div className="w-full">
                              <ConnectButton
                                client={client!}
                                theme={"dark"}
                                connectButton={{
                                  label: "Connect Wallet",
                                  className: "!w-full !h-12 !rounded-xl !font-bold"
                                }}
                              />
                            </div>
                          ) : (
                            <NeonButton
                              onClick={handleSwap}
                              className={cn("bg-white text-black hover:bg-zinc-200 shadow-none", (!tosAccepted) && "opacity-50 cursor-not-allowed")}
                              disabled={!tosAccepted || executing || preparing}
                            >
                              {primaryLabel}
                            </NeonButton>
                          )
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
          <div className="py-4 md:py-6 relative z-10 flex items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
            {isCrossChain ? (
              <>
                <img src="/miniapp/icons/thirdweb_logo.png" alt="Thirdweb" className="w-7 h-7 object-contain rounded-full" />
                <span className="text-sm font-medium text-zinc-400">Powered by Thirdweb</span>
              </>
            ) : sellToken.network === 'Avalanche' ? (
              <>
                <img src="https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png" alt="Avalanche" className="w-7 h-7 object-contain" />
                <span className="text-sm font-medium text-zinc-400">Powered by Avax</span>
              </>
            ) : (
              <>
                <img src="/miniapp/icons/uni_logo.png" alt="Uniswap" className="w-7 h-7 object-contain" />
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
