'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Container, AppLayout, MobileLayout, DesktopLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner, LoadingOverlay } from '@/components/ui/spinner';
import { LazyImage } from '@/components/ui/lazy-image';
import { Skeleton, SkeletonWrapper } from '@/components/ui/skeleton';
import { ErrorBoundary, ErrorFallback } from '@/components/error-boundary';
import { cn } from '@/shared/lib/utils';
import Image from 'next/image';
import { networks, Token } from '@/features/swap/tokens';
import { swapApi, SwapApiError } from '@/features/swap/api';
import { normalizeToApi, getTokenDecimals, parseAmountToWei, formatAmountHuman, isNative, explorerTxUrl } from '@/features/swap/utils';
import { useActiveAccount } from 'thirdweb/react';
import { createThirdwebClient, defineChain, prepareTransaction, sendTransaction, type Address, type Hex } from 'thirdweb';
import { THIRDWEB_CLIENT_ID } from '../../shared/config/thirdweb';
import { safeExecuteTransactionV2 } from '../../shared/utils/transactionUtilsV2';
import { useDebounce, usePerformanceMonitor } from '@/hooks/usePerformance';
import type { PreparedTx } from '@/features/swap/types';

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token, chainId: number) => void;
  title: string;
  currentChainId: number;
}

interface SwapState {
  fromToken: Token | null;
  toToken: Token | null;
  fromChainId: number;
  toChainId: number;
  fromAmount: string;
  toAmount: string;
  isLoading: boolean;
  quote: any;
  error: string | null;
  slippage: number;
  gasPrice: 'slow' | 'standard' | 'fast';
}

interface SwapSettings {
  slippage: number;
  gasPrice: 'slow' | 'standard' | 'fast';
  deadline: number;
  expertMode: boolean;
}

interface PriceInfoProps {
  quote: any;
  fromToken: Token;
  toToken: Token | null;
}

interface SwapRouteProps {
  quote: any;
  fromToken: Token;
  toToken: Token | null;
}

// Price info component
function PriceInfo({ quote, fromToken, toToken }: PriceInfoProps) {
  if (!quote || !toToken) return null;

  return (
    <Card variant="glass" className="border-pano-accent/30">
      <CardContent className="pano-space-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-pano-success animate-pulse" />
          <span className="text-xs font-medium text-pano-text-secondary uppercase tracking-wide">Best Price Route</span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs text-pano-text-muted mb-1">Exchange Rate</div>
            <div className="text-sm font-medium text-pano-text-primary">
              1 {fromToken.symbol} ≈ {quote.exchangeRate || 'N/A'} {toToken.symbol}
            </div>
          </div>

          {quote.estimatedDuration && (
            <div>
              <div className="text-xs text-pano-text-muted mb-1">Est. Time</div>
              <div className="text-sm font-medium text-pano-text-primary">
                ~{quote.estimatedDuration}s
              </div>
            </div>
          )}
        </div>

        {quote.fees?.totalFeeUsd && (
          <div className="flex justify-between items-center pt-3 border-t border-pano-border">
            <span className="text-xs text-pano-text-muted">Network Fee</span>
            <span className="text-sm font-medium text-pano-text-primary">${quote.fees.totalFeeUsd}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Swap route visualization
function SwapRoute({ quote, fromToken, toToken }: SwapRouteProps) {
  if (!quote || !toToken) return null;

  return (
    <Card variant="glass" className="border-pano-accent/30">
      <CardContent className="pano-space-4">
        <div className="text-xs font-medium text-pano-text-secondary uppercase tracking-wide mb-3">Swap Route</div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LazyImage
              src={fromToken.icon || '/icons/default-token.svg'}
              alt={fromToken.symbol}
              className="w-6 h-6 rounded-full"
              fallbackSrc="/icons/default-token.svg"
            />
            <span className="text-sm font-medium text-pano-text-primary">{fromToken.symbol}</span>
          </div>

          <div className="flex items-center gap-2 text-pano-text-muted">
            <div className="w-6 h-px bg-pano-border" />
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <div className="w-6 h-px bg-pano-border" />
          </div>

          <div className="flex items-center gap-2">
            <LazyImage
              src={toToken.icon || '/icons/default-token.svg'}
              alt={toToken.symbol}
              className="w-6 h-6 rounded-full"
              fallbackSrc="/icons/default-token.svg"
            />
            <span className="text-sm font-medium text-pano-text-primary">{toToken.symbol}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Token selector component with enhanced search and filtering
function TokenSelector({ isOpen, onClose, onSelect, title, currentChainId }: TokenSelectorProps) {
  const [search, setSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState<number | null>(currentChainId);
  const debouncedSearch = useDebounce(search, 300);

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
        className="fixed inset-0 bg-black/70 z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4">
        <div className="bg-[#0d1117] border border-cyan-500/30 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between">
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
          <div className="p-4 border-b border-cyan-500/20">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tokens"
                className="w-full px-4 py-3 pl-10 rounded-lg bg-gray-800/50 border border-cyan-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
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
            <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedChain(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  selectedChain === null
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                }`}
              >
                All Chains
              </button>
              {networks.slice(0, 3).map((network) => (
                <button
                  key={network.chainId}
                  onClick={() => setSelectedChain(network.chainId)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    selectedChain === network.chainId
                      ? 'bg-cyan-500 text-white'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  {network.name}
                </button>
              ))}
            </div>
          </div>

          {/* Popular Tokens */}
          {!search && (
            <div className="px-4 py-3 border-b border-cyan-500/20">
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
                    className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors border border-cyan-500/20"
                  >
                    <Image
                      src={token.icon}
                      alt={token.symbol}
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-xs font-medium text-white truncate w-full text-center">{token.symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Token List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              {!search && (
                <div className="px-2 py-2 flex items-center gap-2 text-xs text-gray-500">
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
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-800/50 transition-colors text-left min-w-0"
                >
                  <Image
                    src={token.icon || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'}
                    alt={token.symbol}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{token.symbol}</div>
                    <div className="text-xs text-gray-500 truncate">
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
  const account = useActiveAccount();
  const clientId = THIRDWEB_CLIENT_ID || undefined;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);
  const { trackEvent } = usePerformanceMonitor();

  const addressFromToken = useMemo(() => getAddressFromToken(), []);
  const userAddress = localStorage.getItem('userAddress');
  const effectiveAddress = account?.address || addressFromToken || userAddress;

  // Swap state
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
  const [showSettings, setShowSettings] = useState(false);
  const [txHashes, setTxHashes] = useState<Array<{ hash: string; chainId: number }>>([]);
  const quoteRequestRef = useRef(0);

  // Debounced sell amount for performance
  const debouncedSellAmount = useDebounce(sellAmount, 500);

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

      if (quoteRequestRef.current !== requestId) {
        return;
      }

      if (!res.success || !res.quote) {
        throw new Error(res.message || 'Failed to get quote');
      }

      setQuote(res.quote);

      // Update buy amount from quote
      if (res.quote.estimatedReceiveAmount) {
        const decimals = 18; // You can fetch this from token metadata
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

      const prep = await swapApi.prepare({
        fromChainId,
        toChainId,
        fromToken: normalizeToApi(sellToken.address),
        toToken: normalizeToApi(buyToken.address),
        amount: wei.toString(),
        sender: effectiveAddress,
      });

      const seq = flattenPrepared(prep.prepared);
      
      if (!seq.length) throw new Error('No transactions returned by prepare');

      setPreparing(false);
      setExecuting(true);
      setTxHashes([]); // Reset transaction hashes

      for (const t of seq) {
        if (t.chainId !== fromChainId) {
          throw new Error(`Wallet chain mismatch. Switch to chain ${t.chainId} and retry.`);
        }

        const tx = prepareTransaction({
          to: t.to as Address,
          chain: defineChain(t.chainId),
          client,
          data: t.data as Hex,
          value: t.value ? BigInt(t.value as any) : 0n,
        });

        if (!account) {
          throw new Error('To execute the swap, you need to connect your wallet. Please go to the dashboard and connect your wallet first.');
        }

        const result = await safeExecuteTransactionV2(async () => {
          return await sendTransaction({ account, transaction: tx });
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
      const errorMessage = e.message || 'Failed to execute swap';
      const lowerError = errorMessage.toLowerCase();

      // Check if it's an insufficient funds error
      if (lowerError.includes('insufficient funds') ||
          lowerError.includes('have 0 want') ||
          lowerError.includes('32003') ||
          lowerError.includes('gas required exceeds allowance')) {
        setShowFundWallet(true);
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
    }
  };

  return (
    <ErrorBoundary fallback={<ErrorFallback resetError={() => window.location.reload()} />}>
      <AppLayout>
        <MobileLayout>
          <Container size="sm" className="min-h-screen py-6">
            {/* Mobile Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold text-pano-text-primary">Swap</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(true)}
                className="h-auto p-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </Button>
            </div>

            <div className="space-y-6">
              {/* Main Swap Card */}
              <Card variant="glass" className="border-pano-accent/30">
                <CardContent className="pano-space-6">
                  {/* From Token */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-pano-text-secondary uppercase tracking-wide">From</label>
                      <div className="text-xs text-pano-text-muted">
                        {networks.find(n => n.chainId === fromChainId)?.name || 'Base'}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Input
                        variant="ghost"
                        size="xl"
                        value={sellAmount}
                        onChange={(e) => setSellAmount(e.target.value)}
                        placeholder="0.0"
                        className="text-3xl font-light text-center border-none bg-transparent"
                      />

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-pano-text-muted">$0.00</div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowSellSelector(true)}
                          className="flex items-center gap-2 px-3 py-2"
                        >
                          <LazyImage
                            src={sellToken.icon || '/icons/default-token.svg'}
                            alt={sellToken.symbol}
                            className="w-5 h-5 rounded-full"
                            fallbackSrc="/icons/default-token.svg"
                          />
                          <span className="font-medium">{sellToken.symbol}</span>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <div className="flex justify-center my-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSwapTokens}
                      className="rounded-full p-3 border-pano-accent/30 hover:border-pano-accent hover:bg-pano-accent/10"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </Button>
                  </div>

                  {/* To Token */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-pano-text-secondary uppercase tracking-wide">To</label>
                      <div className="text-xs text-pano-text-muted">
                        {networks.find(n => n.chainId === toChainId)?.name || 'Arbitrum'}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <LoadingOverlay isLoading={quoting} backdrop="blur">
                        <Input
                          variant="ghost"
                          size="xl"
                          value={buyAmount}
                          readOnly
                          placeholder="0.0"
                          className="text-3xl font-light text-center border-none bg-transparent"
                        />
                      </LoadingOverlay>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-pano-text-muted">$0.00</div>
                        <Button
                          variant={buyToken ? "outline" : "default"}
                          size="sm"
                          onClick={() => setShowBuySelector(true)}
                          className="flex items-center gap-2 px-3 py-2"
                        >
                          {buyToken ? (
                            <>
                              <LazyImage
                                src={buyToken.icon || '/icons/default-token.svg'}
                                alt={buyToken.symbol}
                                className="w-5 h-5 rounded-full"
                                fallbackSrc="/icons/default-token.svg"
                              />
                              <span className="font-medium">{buyToken.symbol}</span>
                            </>
                          ) : (
                            <span className="font-medium">Select Token</span>
                          )}
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <Button
                    onClick={handleStartSwap}
                    disabled={!quote || quoting || preparing || executing}
                    variant={quote ? "default" : "outline"}
                    size="lg"
                    className="w-full mt-6"
                  >
                    {executing ? (
                      <><Spinner size="sm" className="mr-2" />Executing Swap...</>
                    ) : preparing ? (
                      <><Spinner size="sm" className="mr-2" />Preparing...</>
                    ) : quoting ? (
                      <><Spinner size="sm" className="mr-2" />Getting Quote...</>
                    ) : quote ? (
                      'Start Swap'
                    ) : (
                      'Enter Amount'
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Quote Info */}
              {quote && (
                <PriceInfo quote={quote} fromToken={sellToken} toToken={buyToken} />
              )}

              {/* Swap Route */}
              {quote && (
                <SwapRoute quote={quote} fromToken={sellToken} toToken={buyToken} />
              )}

              {/* Error Message */}
              {error && (
                <Card variant="outline" className="border-pano-error/30 bg-pano-error/5">
                  <CardContent className="pano-space-4">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-pano-error/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-pano-error" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      </div>
                      <div className="text-sm text-pano-error">{error}</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Success Message */}
              {success && (
                <Card variant="outline" className="border-pano-success/30 bg-pano-success/5">
                  <CardContent className="pano-space-4">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-5 h-5 rounded-full bg-pano-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-pano-success" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="text-sm text-pano-success font-medium">Swap executed successfully!</div>
                    </div>

                    {/* Transaction Hashes */}
                    {txHashes.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-pano-text-secondary uppercase tracking-wide">Transactions</div>
                        {txHashes.map((tx, index) => {
                          const explorerUrl = explorerTxUrl(tx.chainId, tx.hash);
                          return (
                            <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-pano-surface-elevated">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-mono text-pano-text-primary truncate">
                                  {tx.hash}
                                </div>
                                <div className="text-xs text-pano-text-muted">
                                  Chain {tx.chainId}
                                </div>
                              </div>
                              {explorerUrl && (
                                <Button
                                  variant="outline"
                                  size="xs"
                                  asChild
                                  className="ml-2"
                                >
                                  <a
                                    href={explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    View
                                  </a>
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </Container>
        </MobileLayout>

        <DesktopLayout>
          <Container size="lg" className="min-h-screen py-8">
            <div className="grid grid-cols-12 gap-8">
              {/* Main Swap Area */}
              <div className="col-span-8">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-pano-text-primary">Token Swap</h1>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSettings(true)}
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                      Settings
                    </Button>
                  </div>

                  {/* Desktop Swap Card */}
                  <Card variant="glass" className="border-pano-accent/30 max-w-md mx-auto">
                    <CardContent className="pano-space-8">
                      {/* From Token */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-pano-text-secondary">From</label>
                          <div className="text-sm text-pano-text-muted">
                            {networks.find(n => n.chainId === fromChainId)?.name || 'Base'}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <Input
                            variant="ghost"
                            size="xl"
                            value={sellAmount}
                            onChange={(e) => setSellAmount(e.target.value)}
                            placeholder="0.0"
                            className="text-4xl font-light text-center border-none bg-transparent"
                          />

                          <div className="flex items-center justify-between">
                            <div className="text-sm text-pano-text-muted">$0.00</div>
                            <Button
                              variant="outline"
                              onClick={() => setShowSellSelector(true)}
                              className="flex items-center gap-3 px-4 py-3 h-auto"
                            >
                              <LazyImage
                                src={sellToken.icon || '/icons/default-token.svg'}
                                alt={sellToken.symbol}
                                className="w-6 h-6 rounded-full"
                                fallbackSrc="/icons/default-token.svg"
                              />
                              <span className="font-medium text-base">{sellToken.symbol}</span>
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Swap Button */}
                      <div className="flex justify-center my-8">
                        <Button
                          variant="outline"
                          onClick={handleSwapTokens}
                          className="rounded-full p-4 border-pano-accent/30 hover:border-pano-accent hover:bg-pano-accent/10"
                        >
                          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                          </svg>
                        </Button>
                      </div>

                      {/* To Token */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-pano-text-secondary">To</label>
                          <div className="text-sm text-pano-text-muted">
                            {networks.find(n => n.chainId === toChainId)?.name || 'Arbitrum'}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <LoadingOverlay isLoading={quoting} backdrop="blur">
                            <Input
                              variant="ghost"
                              size="xl"
                              value={buyAmount}
                              readOnly
                              placeholder="0.0"
                              className="text-4xl font-light text-center border-none bg-transparent"
                            />
                          </LoadingOverlay>

                          <div className="flex items-center justify-between">
                            <div className="text-sm text-pano-text-muted">$0.00</div>
                            <Button
                              variant={buyToken ? "outline" : "default"}
                              onClick={() => setShowBuySelector(true)}
                              className="flex items-center gap-3 px-4 py-3 h-auto"
                            >
                              {buyToken ? (
                                <>
                                  <LazyImage
                                    src={buyToken.icon || '/icons/default-token.svg'}
                                    alt={buyToken.symbol}
                                    className="w-6 h-6 rounded-full"
                                    fallbackSrc="/icons/default-token.svg"
                                  />
                                  <span className="font-medium text-base">{buyToken.symbol}</span>
                                </>
                              ) : (
                                <span className="font-medium text-base">Select Token</span>
                              )}
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Swap Button */}
                      <Button
                        onClick={handleStartSwap}
                        disabled={!quote || quoting || preparing || executing}
                        variant={quote ? "default" : "outline"}
                        size="lg"
                        className="w-full mt-8 py-4 text-lg"
                      >
                        {executing ? (
                          <><Spinner size="sm" className="mr-2" />Executing Swap...</>
                        ) : preparing ? (
                          <><Spinner size="sm" className="mr-2" />Preparing...</>
                        ) : quoting ? (
                          <><Spinner size="sm" className="mr-2" />Getting Quote...</>
                        ) : quote ? (
                          'Start Swap'
                        ) : (
                          'Enter Amount'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Sidebar */}
              <div className="col-span-4">
                <div className="space-y-6">
                  {/* Quote Info */}
                  {quote && (
                    <PriceInfo quote={quote} fromToken={sellToken} toToken={buyToken} />
                  )}

                  {/* Swap Route */}
                  {quote && (
                    <SwapRoute quote={quote} fromToken={sellToken} toToken={buyToken} />
                  )}

                  {/* Error Message */}
                  {error && (
                    <Card variant="outline" className="border-pano-error/30 bg-pano-error/5">
                      <CardContent className="pano-space-4">
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-pano-error/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-3 h-3 text-pano-error" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                          </div>
                          <div className="text-sm text-pano-error">{error}</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Success Message */}
                  {success && (
                    <Card variant="outline" className="border-pano-success/30 bg-pano-success/5">
                      <CardContent className="pano-space-4">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-5 h-5 rounded-full bg-pano-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-3 h-3 text-pano-success" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="text-sm text-pano-success font-medium">Swap executed successfully!</div>
                        </div>

                        {/* Transaction Hashes */}
                        {txHashes.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-pano-text-secondary uppercase tracking-wide">Transactions</div>
                            {txHashes.map((tx, index) => {
                              const explorerUrl = explorerTxUrl(tx.chainId, tx.hash);
                              return (
                                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-pano-surface-elevated">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-mono text-pano-text-primary truncate">
                                      {tx.hash}
                                    </div>
                                    <div className="text-xs text-pano-text-muted">
                                      Chain {tx.chainId}
                                    </div>
                                  </div>
                                  {explorerUrl && (
                                    <Button
                                      variant="outline"
                                      size="xs"
                                      asChild
                                      className="ml-2"
                                    >
                                      <a
                                        href={explorerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        View
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </Container>
        </DesktopLayout>

        {/* Token Selectors */}
        <TokenSelector
          isOpen={showSellSelector}
          onClose={() => setShowSellSelector(false)}
          onSelect={(token, chainId) => {
            setSellToken(token);
            setFromChainId(chainId);
            trackEvent('token_selected', { type: 'sell', token: token.symbol, chainId });
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
            trackEvent('token_selected', { type: 'buy', token: token.symbol, chainId });
          }}
          title="Select a token to buy"
          currentChainId={toChainId}
        />
      </AppLayout>
    </ErrorBoundary>
  );
}
