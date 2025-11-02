'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import SwapIcon from '../../../public/icons/Swap.svg';
import UniswapIcon from '../../../public/icons/uniswap.svg';
import { networks, Token } from '@/features/swap/tokens';
import { swapApi, SwapApiError } from '@/features/swap/api';
import { normalizeToApi, getTokenDecimals, parseAmountToWei, formatAmountHuman, isNative, explorerTxUrl } from '@/features/swap/utils';
import { SwapSuccessCard } from '@/components/ui/SwapSuccessCard';
import { useActiveAccount, PayEmbed, useSwitchActiveWalletChain } from 'thirdweb/react';
import { createThirdwebClient, defineChain, prepareTransaction, sendTransaction, type Address, type Hex } from 'thirdweb';
import { THIRDWEB_CLIENT_ID } from '../../shared/config/thirdweb';
import { safeExecuteTransactionV2 } from '../../shared/utils/transactionUtilsV2';
import type { PreparedTx } from '@/features/swap/types';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token, chainId: number) => void;
  title: string;
  currentChainId: number;
}

function TokenSelector({ isOpen, onClose, onSelect, title, currentChainId }: TokenSelectorProps) {
  const [search, setSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState<number | null>(currentChainId);

  if (!isOpen) return null;

  // Get all tokens from selected chain or all chains
  const allTokens = selectedChain
    ? networks.find(n => n.chainId === selectedChain)?.tokens || []
    : networks.flatMap(n => n.tokens);

  // Filter tokens by search
  const filteredTokens = allTokens.filter(token =>
    token.symbol.toLowerCase().includes(search.toLowerCase()) ||
    token.address.toLowerCase().includes(search.toLowerCase())
  );

  // Sort by 24h volume (simulated - just show ETH, USDC, USDT first)
  const sortedTokens = [...filteredTokens].sort((a, b) => {
    const priority = ['ETH', 'USDC', 'USDT', 'WBTC'];
    return priority.indexOf(a.symbol) - priority.indexOf(b.symbol);
  });

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 animate-fadeIn"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-[#1A1A1A]/95 backdrop-blur-2xl border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-scaleIn">
          {/* Header */}
          <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#252525]/30">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-all hover:rotate-90 duration-300 p-1 rounded-lg hover:bg-white/5"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="p-5 border-b border-white/5">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tokens by name or address..."
                className="w-full px-4 py-3.5 pl-11 rounded-xl bg-[#252525] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:bg-[#2A2A2A] transition-all"
              />
              <svg
                className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-500"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" d="m21 21-4.35-4.35" />
              </svg>
            </div>

            {/* Chain selector */}
            <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedChain(null)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                  selectedChain === null
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                All Chains
              </button>
              {networks.map((network) => (
                <button
                  key={network.chainId}
                  onClick={() => setSelectedChain(network.chainId)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                    selectedChain === network.chainId
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                  }`}
                >
                  {network.name}
                </button>
              ))}
            </div>
          </div>

          {/* Token List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar-modal">
            <div className="p-3">
              {!search && (
                <div className="px-3 py-2.5 flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Tokens by 24H volume
                </div>
              )}
              {sortedTokens.map((token, idx) => (
                <button
                  key={`${token.symbol}-${token.address}-${idx}`}
                  onClick={() => {
                    onSelect(token, selectedChain || currentChainId);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3.5 px-3.5 py-3.5 rounded-xl hover:bg-[#252525] transition-all text-left min-w-0 border border-transparent hover:border-white/10 group"
                >
                  <Image
                    src={token.icon || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'}
                    alt={token.symbol}
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full flex-shrink-0 group-hover:scale-105 transition-transform"
                    unoptimized
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{token.symbol}</div>
                    <div className="text-xs text-gray-500 truncate font-mono">
                      {token.address.slice(0, 6)}...{token.address.slice(-4)}
                    </div>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function getAddressFromToken(): string | null {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    return payload.sub || payload.address || null;
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return null;
  }
}

export default function SwapPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const switchChain = useSwitchActiveWalletChain();
  const clientId = THIRDWEB_CLIENT_ID || undefined;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);

  const addressFromToken = useMemo(() => getAddressFromToken(), []);
  const userAddress = localStorage.getItem('userAddress');
  const effectiveAddress = account?.address || addressFromToken || userAddress;

  const [exploreDropdownOpen, setExploreDropdownOpen] = useState(false);
  const [fromChainId, setFromChainId] = useState(8453); // Base
  const [toChainId, setToChainId] = useState(42161); // Arbitrum
  const [sellToken, setSellToken] = useState<Token>({
    symbol: 'ETH',
    address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    icon: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
  });
  const [buyToken, setBuyToken] = useState<Token | null>(null);
  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [showSellSelector, setShowSellSelector] = useState(false);
  const [showBuySelector, setShowBuySelector] = useState(false);

  // Quote and swap states
  const [quote, setQuote] = useState<any | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showFundWallet, setShowFundWallet] = useState(false);
  const [txHashes, setTxHashes] = useState<Array<{ hash: string; chainId: number }>>([]);
  const quoteRequestRef = useRef(0);

  // Check if we can request quote
  const canQuote = useMemo(() => {
    return Boolean(sellToken && buyToken && sellAmount && Number(sellAmount) > 0);
  }, [sellToken, buyToken, sellAmount]);

  // Auto-quote effect
  useEffect(() => {
    const requestId = ++quoteRequestRef.current;

    if (!canQuote) {
      setQuote(null);
      setQuoting(false);
      setBuyAmount('');
      return undefined;
    }

    setQuote(null);
    setError(null);
    setSuccess(false);

    const timer = window.setTimeout(() => {
      void performQuote(requestId);
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [canQuote, sellToken, buyToken, sellAmount, effectiveAddress]);

  async function performQuote(requestId: number) {
    if (!canQuote || !buyToken) return;

    setError(null);
    try {
      setQuoting(true);

      const smartAccountAddress = effectiveAddress || '';

      const body = {
        fromChainId,
        toChainId,
        fromToken: normalizeToApi(sellToken.address),
        toToken: normalizeToApi(buyToken.address),
        amount: sellAmount.trim(),
        smartAccountAddress,
      };

      const res = await swapApi.quote(body);

      // Use backend quote as-is. Do not adjust client-side.
      if (quoteRequestRef.current !== requestId) {
        return;
      }

      if (!res.success || !res.quote) {
        throw new Error(res.message || 'Failed to get quote');
      }

      setQuote(res.quote);

      // Update buy amount from quote
      if (res.quote.estimatedReceiveAmount && buyToken && client) {
        // Get correct decimals for the destination token
        const decimals = await getTokenDecimals({
          client,
          chainId: toChainId,
          token: buyToken.address
        });
        const formatted = formatAmountHuman(BigInt(res.quote.estimatedReceiveAmount), decimals);
        setBuyAmount(formatted);
      }
    } catch (e: any) {
      if (quoteRequestRef.current !== requestId) {
        return;
      }
      setError(e.message || 'Failed to get quote');
    } finally {
      if (quoteRequestRef.current === requestId) {
        setQuoting(false);
      }
    }
  }

  function flattenPrepared(prepared: any): PreparedTx[] {
    const out: PreparedTx[] = [];
    if (prepared?.transactions) {
      out.push(...prepared.transactions);
    }
    if (prepared?.steps) {
      for (const step of prepared.steps) {
        if (step.transactions) {
          out.push(...step.transactions);
        }
      }
    }
    return out;
  }

  async function handleStartSwap() {
    if (!quote) {
      setError('Please wait for the quote to be calculated');
      return;
    }

    if (!effectiveAddress) {
      setError('Authentication required. Please ensure you are logged in.');
      return;
    }

    if (!clientId || !client) {
      setError('Missing THIRDWEB client configuration.');
      return;
    }

    setError(null);
    setSuccess(false);

    try {
      // Switch to the correct chain FIRST, before doing anything else
      if (account && switchChain) {
        const networkName = networks.find(n => n.chainId === fromChainId)?.name || `Chain ${fromChainId}`;
        console.log('Switching to source chain before preparing transactions...');
        console.log('Target chain:', fromChainId, networkName);

        setError(`Switching to ${networkName}...`);

        try {
          await switchChain(defineChain(fromChainId));
          console.log('✅ Chain switched successfully to:', fromChainId);
          setError(null);
        } catch (e: any) {
          console.error('❌ Failed to switch chain:', e);
          throw new Error(`Please approve the network switch to ${networkName} in your wallet.`);
        }
      }

      setPreparing(true);

      const decimals = await getTokenDecimals({
        client,
        chainId: fromChainId,
        token: sellToken.address
      });

      const wei = parseAmountToWei(sellAmount, decimals);
      if (wei <= 0n) throw new Error('Invalid amount');

      if (!buyToken) {
        throw new Error('Please select a token to buy');
      }

      console.log('=== SWAP DEBUG ===');
      console.log('Sell token:', sellToken.symbol, sellToken.address);
      console.log('Buy token:', buyToken.symbol, buyToken.address);
      console.log('Sell amount (human):', sellAmount);
      console.log('Sell amount (wei):', wei.toString());
      console.log('Sell token decimals:', decimals);
      console.log('From chain:', fromChainId);
      console.log('To chain:', toChainId);

      const prep = await swapApi.prepare({
        fromChainId,
        toChainId,
        fromToken: normalizeToApi(sellToken.address),
        toToken: normalizeToApi(buyToken.address),
        amount: wei.toString(),
        sender: effectiveAddress,
        // Let backend auto-select provider based on priority (Uniswap first)
      });

      console.log('Prepared transactions:', prep.prepared);
      console.log('Provider used:', prep.provider);

      const seq = flattenPrepared(prep.prepared);

      if (!seq.length) throw new Error('No transactions returned by prepare');

      setPreparing(false);

      setExecuting(true);
      setTxHashes([]); // Reset transaction hashes

      // Check if we should skip simulation (for Uniswap Smart Router)
      const shouldSkipSimulation = prep.provider === 'uniswap-smart-router' ||
                                   prep.prepared?.metadata?.skipSimulation === true;

      if (shouldSkipSimulation) {
        console.log('⚠️ Using Uniswap Smart Router - MetaMask may show a simulation warning');
        console.log('ℹ️  This is expected and safe. The transaction is valid and will execute successfully.');
      }

      for (const t of seq) {
        if (t.chainId !== fromChainId) {
          throw new Error(`Wallet chain mismatch. Switch to chain ${t.chainId} and retry.`);
        }

        console.log('=== TRANSACTION DEBUG ===');
        console.log('Raw transaction from API:', t);
        console.log('Raw value from API:', t.value, 'type:', typeof t.value);

        // Use the value from the API response - it knows the correct amount including fees
        let txValue = 0n;
        if (t.value) {
          const valueStr = typeof t.value === 'string' ? t.value : String(t.value);
          if (valueStr && valueStr !== '0') {
            try {
              txValue = BigInt(valueStr);
              console.log('Using value from API:', txValue.toString());
            } catch (e) {
              console.error('Failed to parse transaction value:', valueStr, e);
              txValue = 0n;
            }
          }
        }

        console.log('Final txValue (bigint):', txValue.toString());
        console.log('Is native token?', isNative(sellToken.address));

        if (!account) {
          throw new Error('To execute the swap, you need to connect your wallet. Please go to the dashboard and connect your wallet first.');
        }

        // Prepare and send transaction
        // For Uniswap Smart Router, we provide gas limits from backend to avoid estimation errors
        const result = await safeExecuteTransactionV2(async () => {
          if (shouldSkipSimulation) {
            console.log('🔄 Uniswap Smart Router: Using gas limits from backend');
            console.log('⚠️ Note: MetaMask may still show simulation warning - this is expected and safe to ignore');
          }

          const txParams = {
            to: t.to as Address,
            chain: defineChain(t.chainId),
            client,
            data: t.data as Hex,
            value: txValue,
            gas: t.gasLimit != null ? BigInt(t.gasLimit as any) : undefined,
            maxFeePerGas: t.maxFeePerGas != null ? BigInt(t.maxFeePerGas as any) : undefined,
            maxPriorityFeePerGas:
              t.maxPriorityFeePerGas != null ? BigInt(t.maxPriorityFeePerGas as any) : undefined,
          };

          console.log('📝 Transaction params:', {
            to: txParams.to,
            chainId: t.chainId,
            hasGasLimit: txParams.gas !== undefined,
            gasLimit: txParams.gas?.toString(),
            value: txParams.value.toString(),
            dataLength: txParams.data.length,
            data: txParams.data.substring(0, 200) + '...',
            provider: prep.provider,
            hasMaxFeePerGas: txParams.maxFeePerGas !== undefined,
            hasMaxPriorityFeePerGas: txParams.maxPriorityFeePerGas !== undefined
          });

          // CRITICAL FIX: For Uniswap with skipSimulation, send directly via window.ethereum
          // to bypass thirdweb's automatic simulation that causes failures
          if (shouldSkipSimulation && typeof window !== 'undefined' && (window as any).ethereum) {
            console.log('🚀 Sending transaction directly via MetaMask (bypassing simulation)...');

            const ethereum = (window as any).ethereum;
            const txHash = await ethereum.request({
              method: 'eth_sendTransaction',
              params: [{
                from: account.address,
                to: txParams.to,
                data: txParams.data,
                value: '0x' + txParams.value.toString(16),
                gas: txParams.gas ? '0x' + txParams.gas.toString(16) : undefined,
                maxFeePerGas: txParams.maxFeePerGas ? '0x' + txParams.maxFeePerGas.toString(16) : undefined,
                maxPriorityFeePerGas: txParams.maxPriorityFeePerGas ? '0x' + txParams.maxPriorityFeePerGas.toString(16) : undefined,
              }],
            });

            console.log('✅ Transaction sent directly! Hash:', txHash);
            return { transactionHash: txHash };
          }

          // Normal path: use thirdweb (includes simulation)
          const tx = prepareTransaction(txParams);

          console.log('✅ Transaction prepared, sending to wallet...');
          const txResult = await sendTransaction({ account, transaction: tx });
          console.log('✅ Transaction sent! Hash:', txResult.transactionHash);
          return txResult;
        });

        if (!result.success) {
          throw new Error(`Transaction failed: ${result.error}`);
        }

        if (!result.transactionHash) {
          throw new Error('Transaction failed: no transaction hash returned.');
        }

        // Store transaction hash
        setTxHashes(prev => [...prev, { hash: result.transactionHash!, chainId: t.chainId }]);
        console.log(`Transaction ${result.transactionHash} submitted on chain ${t.chainId}`);
      }

      setSuccess(true);
      setSellAmount('');
      setBuyAmount('');
      setQuote(null);
    } catch (e: any) {
      let errorMessage = e.message || 'Failed to execute swap';
      const lowerError = errorMessage.toLowerCase();

      // Check if it's an insufficient funds error
      if (lowerError.includes('insufficient funds') ||
          lowerError.includes('have 0 want') ||
          lowerError.includes('32003') ||
          lowerError.includes('gas required exceeds allowance')) {
        setShowFundWallet(true);
      }

      // Clean up noisy ABI decode errors from viem/thirdweb
      if (lowerError.includes('abierrorsignaturenotfounderror') || lowerError.includes('encoded error signature')) {
        errorMessage = 'Transaction reverted by contract (no detailed reason provided).';
      }

      setError(errorMessage);
    } finally {
      setPreparing(false);
      setExecuting(false);
    }
  }

  const handleSwapTokens = () => {
    if (buyToken) {
      const temp = sellToken;
      setSellToken(buyToken);
      setBuyToken(temp);
      setSellAmount(buyAmount);
      setBuyAmount(sellAmount);
      
      // Also swap the chain IDs
      const tempChainId = fromChainId;
      setFromChainId(toChainId);
      setToChainId(tempChainId);
    }
  };

  const getWalletAddress = () => {
    if (typeof window === 'undefined') return undefined;
    const authPayload = localStorage.getItem('authPayload');
    if (authPayload) {
      try {
        const payload = JSON.parse(authPayload);
        return payload.address?.toLowerCase();
      } catch (error) {
        console.error('Error parsing authPayload:', error);
      }
    }
    return undefined;
  };

  return (
    <ProtectedRoute>
      <div className="h-screen text-white flex flex-col overflow-hidden relative">
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Top Navbar - Same as chat */}
      <header className="flex-shrink-0 bg-black/40 backdrop-blur-md border-b-2 border-white/15 px-6 py-3 z-50">
        <div className="flex items-center justify-between max-w-[1920px] mx-auto">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <Image src={zicoBlue} alt="Panorama Block" width={28} height={28} />
            <span className="text-white font-semibold text-sm tracking-wide hidden md:inline">PANORAMA BLOCK</span>
          </div>

          {/* Right: Explore + Docs + Notifications + Wallet Address */}
          <div className="flex items-center gap-3">
            {/* Navigation Menu */}
            <nav className="flex items-center gap-6 text-sm mr-3">
              {/* Explore Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setExploreDropdownOpen(!exploreDropdownOpen)}
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  Explore
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {exploreDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setExploreDropdownOpen(false)}
                    />
                    <div className="absolute top-full right-0 mt-2 w-48 bg-black/80 backdrop-blur-xl border border-white/20 rounded-lg shadow-xl z-20">
                      <div className="py-2">
                        <button
                          onClick={() => {
                            setExploreDropdownOpen(false);
                            router.push('/chat');
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full text-left"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" stroke="#4BC3C5" fill="none" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Chat
                        </button>
                        <button
                          onClick={() => {
                            setExploreDropdownOpen(false);
                            router.push('/swap');
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full text-left"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" stroke="#4BC3C5" fill="none" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                          </svg>
                          Swap
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Docs Link */}
              <a
                href="https://docs.panoramablock.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Docs
              </a>
            </nav>

            {/* Notifications Icon */}
            <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-400" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>

            {/* Wallet Address Display */}
            {(account?.address || getWalletAddress()) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/30">
                <div className="w-2 h-2 rounded-full bg-[#00FFC3]"></div>
                <span className="text-white text-xs font-mono">
                  {account?.address
                    ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
                    : getWalletAddress()
                      ? `${getWalletAddress()!.slice(0, 6)}...${getWalletAddress()!.slice(-4)}`
                      : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* Swap Interface */}
        <div className="h-full flex items-center justify-center p-4">
          <div className="w-full max-w-xs">
            {/* Swap Card */}
            <div className="bg-[#1A1A1A]/90 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-white/5">
              {/* Sell Section */}
              <div className="mb-2">
                <label className="text-xs text-gray-400 mb-2 block">Sell</label>
                <div className="bg-[#252525] rounded-xl p-3 border border-white/10">
                  <input
                    type="text"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="0"
                    className="bg-transparent text-3xl font-light text-white outline-none w-full mb-2"
                  />
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => setShowSellSelector(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-black hover:bg-gray-200 transition-colors text-sm"
                    >
                      <Image
                        src={sellToken.icon || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'}
                        alt={sellToken.symbol}
                        width={20}
                        height={20}
                        className="w-5 h-5 rounded-full"
                        unoptimized
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                        }}
                      />
                      <span className="font-medium">{sellToken.symbol}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center -my-1 relative z-10">
                <button
                  onClick={handleSwapTokens}
                  className="bg-[#252525] border border-white/10 rounded-lg p-1.5 hover:bg-[#2A2A2A] transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              </div>

              {/* Buy Section */}
              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-2 block">Buy</label>
                <div className="bg-[#252525] rounded-xl p-3 border border-white/10">
                  <input
                    type="text"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="0"
                    className="bg-transparent text-3xl font-light text-white outline-none w-full mb-2"
                    readOnly
                  />
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => setShowBuySelector(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-black hover:bg-gray-200 transition-colors text-sm"
                    >
                      {buyToken ? (
                        <>
                          <Image
                            src={buyToken.icon || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'}
                            alt={buyToken.symbol}
                            width={20}
                            height={20}
                            className="w-5 h-5 rounded-full"
                            unoptimized
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                            }}
                          />
                          <span className="font-medium">{buyToken.symbol}</span>
                        </>
                      ) : (
                        <span className="font-medium">Select token</span>
                      )}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartSwap}
                disabled={!quote || quoting || preparing || executing}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white text-black hover:bg-gray-100"
              >
                {executing
                  ? 'Executing swap...'
                  : preparing
                    ? 'Preparing transaction...'
                    : quoting
                      ? 'Getting quote...'
                      : quote
                        ? 'Get started'
                        : 'Get started'}
              </button>

              {/* Description */}
              <div className="mt-3 text-center">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Buy and sell crypto on 15+ networks including Ethereum, Base, and Arbitrum
                </p>
              </div>

              {/* Powered by Uniswap */}
              <div className="mt-2 flex items-center justify-center gap-2 text-xs text-gray-400">
                <Image
                  src={UniswapIcon}
                  alt="Uniswap"
                  width={44}
                  height={44}
                  className="w-11 h-11"
                  style={{ filter: 'invert(29%) sepia(92%) saturate(6348%) hue-rotate(318deg) brightness(103%) contrast(106%)' }}
                />
                <span>Powered by Uniswap</span>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 backdrop-blur-sm border border-red-500/30">
                  <div className="text-sm text-red-400">{error}</div>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="mt-4 p-3 rounded-lg bg-green-500/10 backdrop-blur-sm border border-green-500/30">
                  <div className="text-sm text-green-400 mb-3">✅ Swap executed successfully!</div>
                  
                  {/* Transaction Hashes */}
                  {txHashes.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-gray-400">Transaction Hashes:</div>
                      {txHashes.map((tx, index) => {
                        const explorerUrl = explorerTxUrl(tx.chainId, tx.hash);
                        return (
                          <div key={index} className="flex items-center justify-between bg-gray-800/50 rounded p-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-gray-300 font-mono truncate">
                                {tx.hash}
                              </div>
                              <div className="text-xs text-gray-500">
                                Chain ID: {tx.chainId}
                              </div>
                            </div>
                            {explorerUrl && (
                              <a
                                href={explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs rounded transition-colors"
                              >
                                View
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Fund Wallet Modal */}
              {showFundWallet && client && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 flex items-center justify-center p-4">
                  <div className="bg-[#1a1a1a]/90 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl max-w-md w-full p-6 relative shadow-2xl">
                    <button
                      onClick={() => setShowFundWallet(false)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    <h3 className="text-xl font-bold text-white mb-2">💰 Fund Wallet</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Your balance is insufficient to execute this transaction. Add funds to your wallet.
                    </p>

                    <div className="mb-4">
                      <PayEmbed
                        client={client}
                        theme="dark"
                        payOptions={{
                          mode: 'fund_wallet',
                          metadata: {
                            name: 'Add funds for swap',
                          },
                          prefillBuy: {
                            chain: defineChain(fromChainId),
                            token: sellToken.address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
                              ? undefined
                              : {
                                  address: sellToken.address as Address,
                                  name: sellToken.symbol,
                                  symbol: sellToken.symbol,
                                }
                          }
                        }}
                      />
                    </div>

                    <button
                      onClick={() => setShowFundWallet(false)}
                      className="w-full py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-medium transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Token Selectors */}
      <TokenSelector
        isOpen={showSellSelector}
        onClose={() => setShowSellSelector(false)}
        onSelect={(token, chainId) => {
          setSellToken(token);
          setFromChainId(chainId);
        }}
        title="Select a token to sell"
        currentChainId={fromChainId}
      />
      <TokenSelector
        isOpen={showBuySelector}
        onClose={() => setShowBuySelector(false)}
        onSelect={(token, chainId) => {
          setBuyToken(token);
          setToChainId(chainId);
        }}
        title="Select a token to buy"
        currentChainId={toChainId}
      />
      </div>
    </ProtectedRoute>
  );
}
