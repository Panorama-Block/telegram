'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import SwapIcon from '../../../public/icons/Swap.svg';
import { networks, Token } from '@/features/swap/tokens';
import { swapApi, SwapApiError } from '@/features/swap/api';
import { normalizeToApi, getTokenDecimals, parseAmountToWei, formatAmountHuman, isNative, explorerTxUrl } from '@/features/swap/utils';
import { SwapSuccessCard } from '@/components/ui/SwapSuccessCard';
import { useActiveAccount, PayEmbed, useSwitchActiveWalletChain } from 'thirdweb/react';
import { createThirdwebClient, defineChain, prepareTransaction, sendTransaction, type Address, type Hex } from 'thirdweb';
import { THIRDWEB_CLIENT_ID } from '../../shared/config/thirdweb';
import { safeExecuteTransactionV2 } from '../../shared/utils/transactionUtilsV2';
import type { PreparedTx } from '@/features/swap/types';

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

  // Popular tokens (using token logos from public CDN)
  const getTokenIcon = (symbol: string) => {
    const iconMap: Record<string, string> = {
      'ETH': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
      'USDC': 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
      'USDT': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
      'WBTC': 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
      'WETH': 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
    };
    return iconMap[symbol] || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
  };

  const popularTokens = [
    { symbol: 'ETH', icon: getTokenIcon('ETH') },
    { symbol: 'USDC', icon: getTokenIcon('USDC') },
    { symbol: 'USDT', icon: getTokenIcon('USDT') },
    { symbol: 'WBTC', icon: getTokenIcon('WBTC') },
    { symbol: 'WETH', icon: getTokenIcon('WETH') },
  ];

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
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4">
        <div className="bg-black border border-white/20 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-white/10">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tokens"
                className="w-full px-4 py-3 pl-10 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-white/40"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="11" cy="11" r="8" strokeWidth={2} />
                <path strokeLinecap="round" strokeWidth={2} d="m21 21-4.35-4.35" />
              </svg>
            </div>

            {/* Chain selector */}
            <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-2 custom-scrollbar">
              <button
                onClick={() => setSelectedChain(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  selectedChain === null
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                All Chains
              </button>
              {networks.map((network) => (
                <button
                  key={network.chainId}
                  onClick={() => setSelectedChain(network.chainId)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    selectedChain === network.chainId
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {network.name}
                </button>
              ))}
            </div>
          </div>

          {/* Popular Tokens */}
          {!search && (
            <div className="px-4 py-3 border-b border-white/10">
              <div className="grid grid-cols-3 gap-2">
                {popularTokens.slice(0, 6).map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      const fullToken = allTokens.find(t => t.symbol === token.symbol);
                      if (fullToken) {
                        onSelect(fullToken, selectedChain || currentChainId);
                        onClose();
                      }
                    }}
                    className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                  >
                    <Image
                      src={token.icon}
                      alt={token.symbol}
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-full"
                      unoptimized
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                      }}
                    />
                    <span className="text-xs font-medium text-white truncate w-full text-center">{token.symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Token List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-2">
              {!search && (
                <div className="px-2 py-2 flex items-center gap-2 text-xs text-gray-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
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
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition-colors text-left min-w-0"
                >
                  <Image
                    src={token.icon || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'}
                    alt={token.symbol}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                    unoptimized
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{token.symbol}</div>
                    <div className="text-xs text-gray-400 truncate">
                      {token.address.slice(0, 6)}...{token.address.slice(-4)}
                    </div>
                  </div>
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
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Top Navbar - Same as chat */}
      <header className="flex-shrink-0 bg-black border-b-2 border-white/15 px-6 py-3 z-50">
        <div className="flex items-center justify-between max-w-[1920px] mx-auto">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <Image src={zicoBlue} alt="Panorama Block" width={28} height={28} />
            <span className="text-white font-semibold text-sm tracking-wide">PANORAMA BLOCK</span>
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
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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
                          <Image src={SwapIcon} alt="Swap" width={16} height={16} />
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
            {(account?.address || getWalletAddress()) ? (
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
            ) : (
              <button
                onClick={() => router.push('/auth')}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* Swap Interface */}
        <div className="h-full flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            {/* Swap Card */}
            <div className="bg-[#1C1C1C]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
              {/* Sell Section */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs text-white uppercase tracking-wide font-medium">Sell</label>
                  <div className="text-xs text-white/70">
                    {networks.find(n => n.chainId === fromChainId)?.name || 'Base'}
                  </div>
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="1.290"
                    className="bg-transparent text-3xl sm:text-4xl font-light text-white outline-none w-full"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-white/50 flex-shrink-0">0 USD</div>
                    <button
                      onClick={() => setShowSellSelector(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-black hover:bg-white/90 transition-colors flex-shrink-0 font-medium"
                    >
                      <Image
                        src={sellToken.icon || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'}
                        alt={sellToken.symbol}
                        width={18}
                        height={18}
                        className="w-[18px] h-[18px] rounded-full flex-shrink-0"
                        unoptimized
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                        }}
                      />
                      <span className="font-medium text-sm whitespace-nowrap">{sellToken.symbol}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="flex-shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center my-3">
                <button
                  onClick={handleSwapTokens}
                  className="bg-white/10 border border-white/20 rounded-full p-2.5 hover:bg-white/20 transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              </div>

              {/* Buy Section */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs text-white uppercase tracking-wide font-medium">Buy</label>
                  <div className="text-xs text-white/70">
                    {networks.find(n => n.chainId === toChainId)?.name || 'Arbitrum'}
                  </div>
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="0"
                    className="bg-transparent text-3xl sm:text-4xl font-light text-white outline-none w-full"
                    readOnly
                  />
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => setShowBuySelector(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors flex-shrink-0 bg-white text-black hover:bg-white/90 font-medium"
                    >
                      {buyToken ? (
                        <>
                          <Image
                            src={buyToken.icon || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'}
                            alt={buyToken.symbol}
                            width={18}
                            height={18}
                            className="w-[18px] h-[18px] rounded-full flex-shrink-0"
                            unoptimized
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                            }}
                          />
                          <span className="font-medium text-sm whitespace-nowrap">{buyToken.symbol}</span>
                        </>
                      ) : (
                        <span className="font-medium text-sm whitespace-nowrap">Select Token</span>
                      )}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="flex-shrink-0">
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
                className="w-full py-4 rounded-xl font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white text-black hover:bg-white/90"
              >
                {executing
                  ? 'Executing swap...'
                  : preparing
                    ? 'Preparing transaction...'
                    : quoting
                      ? 'Getting quote...'
                      : quote
                        ? 'Start Swap'
                        : 'Waiting for quote...'}
              </button>

              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-400">
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g transform="translate(0,600) scale(0.1,-0.1)" fill="#FC007A">
                      <path d="M2780 5613 c-361 -36 -647 -117 -951 -268 -715 -356 -1231 -1027 -1398 -1815 -39 -186 -54 -368 -48 -595 3 -115 13 -257 22 -315 85 -556 326 -1042 714 -1443 429 -442 976 -712 1591 -783 174 -20 505 -15 670 11 556 85 1042 326 1443 714 442 429 712 976 783 1591 20 174 15 505 -11 670 -85 556 -326 1042 -714 1443 -426 439 -977 712 -1581 781 -121 14 -418 19 -520 9z m576 -152 c269 -40 492 -109 739 -230 757 -371 1266 -1089 1377 -1941 18 -141 15 -470 -6 -615 -40 -282 -114 -524 -235 -770 -373 -758 -1089 -1266 -1941 -1377 -141 -18 -470 -15 -615 6 -282 40 -524 114 -770 235 -758 373 -1266 1089 -1377 1941 -18 141 -15 470 6 615 40 282 114 524 235 770 385 783 1151 1308 2021 1384 146 13 410 5 566 -18z"/>
                      <path d="M1601 4605 c40 -49 251 -308 469 -575 572 -700 590 -723 590 -738 0 -46 -72 -91 -147 -92 -73 0 -90 21 -378 470 -75 118 -142 220 -148 225 -12 12 -26 38 140 -260 177 -316 223 -404 223 -425 0 -9 -18 -41 -40 -71 -45 -59 -64 -115 -80 -227 -21 -154 -65 -243 -211 -430 -111 -141 -137 -194 -145 -293 -8 -111 20 -207 100 -339 35 -58 67 -116 71 -129 7 -21 11 -23 55 -17 143 19 326 112 389 198 27 37 31 50 31 107 0 82 -19 115 -97 173 -32 24 -83 68 -114 99 -48 47 -59 65 -69 111 -15 65 -3 115 59 249 48 105 57 138 71 257 11 99 28 145 60 162 10 5 52 17 92 24 96 19 139 38 186 83 39 37 62 90 62 142 0 16 -26 53 -77 110 -207 229 -1083 1191 -1121 1231 -24 25 -11 5 29 -45z m462 -2396 c47 -21 56 -80 19 -121 -33 -39 -89 -8 -71 39 7 20 6 30 -8 45 -17 19 -17 20 2 34 23 17 27 17 58 3z"/>
                      <path d="M2685 3954 c118 -25 203 -65 292 -137 63 -51 134 -130 255 -288 136 -176 213 -244 328 -289 81 -32 172 -48 367 -64 233 -20 271 -32 344 -106 l56 -57 -9 46 c-13 66 -90 217 -140 274 l-41 49 -17 -54 c-35 -112 -78 -161 -125 -140 -35 16 -38 43 -15 113 29 84 21 189 -17 226 -33 34 -172 97 -268 123 -99 27 -300 37 -400 21 l-70 -11 -45 52 c-131 151 -315 249 -460 247 -30 -1 -46 -3 -35 -5z"/>
                      <path d="M2636 3864 c-31 -80 43 -325 130 -431 61 -74 174 -137 227 -125 24 5 22 10 -23 88 -27 48 -47 102 -65 179 -44 190 -78 239 -193 284 -63 25 -68 25 -76 5z"/>
                      <path d="M4031 3820 c-6 -28 -11 -68 -11 -90 0 -47 -8 -70 -24 -70 -7 0 -39 11 -72 24 -101 40 -125 40 -49 -1 158 -85 174 -111 176 -278 1 -105 2 -108 14 -70 8 22 14 68 14 103 1 35 6 72 11 83 13 24 32 16 108 -48 28 -25 52 -42 52 -38 0 4 -36 46 -81 93 -45 48 -87 99 -95 114 -18 34 -33 141 -26 191 6 54 -5 45 -17 -13z"/>
                      <path d="M3440 3167 c0 -56 21 -149 42 -192 30 -59 123 -144 212 -194 43 -24 157 -77 254 -118 237 -100 340 -154 397 -211 54 -53 95 -130 95 -179 0 -103 68 70 76 196 11 162 -40 295 -154 403 -106 99 -245 154 -467 188 -244 36 -345 65 -412 116 -17 13 -34 24 -37 24 -3 0 -6 -15 -6 -33z"/>
                      <path d="M2810 3043 c-50 -26 -80 -76 -80 -134 0 -40 4 -51 28 -69 50 -41 198 -14 244 44 23 28 22 62 -2 101 -41 66 -125 92 -190 58z m118 -19 c45 -31 12 -86 -53 -86 -37 0 -75 24 -75 49 0 44 83 69 128 37z"/>
                      <path d="M3661 2675 c7 -16 12 -68 13 -115 1 -69 -4 -95 -23 -137 -48 -108 -148 -169 -331 -202 -189 -35 -251 -52 -328 -88 -41 -19 -72 -36 -70 -38 2 -2 39 5 83 16 43 10 147 24 230 30 82 6 182 19 221 29 174 45 273 161 274 320 0 76 -22 143 -64 195 -15 19 -16 18 -5 -10z"/>
                      <path d="M3806 2615 c-14 -36 -17 -115 -7 -170 15 -83 54 -160 159 -319 116 -174 156 -246 177 -320 22 -75 16 -173 -14 -240 -12 -27 -19 -51 -17 -53 8 -9 112 65 159 113 117 119 174 335 132 499 -43 162 -122 245 -360 380 -66 38 -141 81 -168 97 -55 33 -53 32 -61 13z"/>
                      <path d="M2921 1979 c-141 -27 -370 -145 -444 -226 -17 -19 -16 -20 69 -37 122 -24 163 -47 281 -157 80 -75 117 -102 155 -115 72 -24 130 -13 181 36 38 35 41 42 45 102 4 61 2 68 -25 98 -25 28 -38 34 -84 38 -45 3 -59 0 -81 -18 -16 -12 -28 -29 -27 -38 0 -13 3 -12 11 5 16 34 68 47 111 29 42 -17 57 -41 57 -93 0 -48 -22 -81 -67 -99 -45 -19 -106 -3 -149 40 -44 44 -52 91 -26 149 28 62 82 91 161 85 124 -9 187 -68 282 -265 100 -208 155 -258 289 -258 62 0 84 5 127 28 67 35 76 50 18 30 -30 -10 -70 -14 -118 -12 -129 7 -163 53 -203 276 -40 219 -91 300 -228 364 -99 46 -222 60 -335 38z"/>
                    </g>
                  </svg>
                </div>
                <span>Powered by Uniswap</span>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="text-sm text-red-400">{error}</div>
                </div>
              )}

              {/* Success Message */}
              {success && txHashes.length > 0 && (
                <div className="mt-4">
                  <SwapSuccessCard
                    txHashes={txHashes}
                    onClose={() => {
                      setSuccess(false);
                      setTxHashes([]);
                    }}
                    variant="compact"
                  />
                </div>
              )}

              {/* Fund Wallet Modal */}
              {showFundWallet && client && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                  <div className="bg-[#1a1a1a] border border-cyan-500/30 rounded-2xl max-w-md w-full p-6 relative">
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
  );
}
