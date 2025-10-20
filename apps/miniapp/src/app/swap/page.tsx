'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sidebar } from '@/shared/ui/Sidebar';
import Image from 'next/image';
import { networks, Token } from '@/features/swap/tokens';
import { swapApi, SwapApiError } from '@/features/swap/api';
import { normalizeToApi, getTokenDecimals, parseAmountToWei, formatAmountHuman, isNative, explorerTxUrl } from '@/features/swap/utils';
import { useActiveAccount, PayEmbed, useSwitchActiveWalletChain } from 'thirdweb/react';
import { createThirdwebClient, defineChain, prepareTransaction, sendTransaction, type Address, type Hex } from 'thirdweb';
import { THIRDWEB_CLIENT_ID } from '../../shared/config/thirdweb';
import { safeExecuteTransactionV2 } from '../../shared/utils/transactionUtilsV2';
import type { PreparedTx } from '@/features/swap/types';
import { useSessionKey } from '@/features/dca/useSessionKey';
import { privateKeyToAccount } from 'thirdweb/wallets';

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
            <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
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
              {networks.map((network) => (
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
                    unoptimized
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                    }}
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
  const switchChain = useSwitchActiveWalletChain();
  const clientId = THIRDWEB_CLIENT_ID || undefined;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);
  const { sessionKey, hasSessionKey } = useSessionKey();

  const addressFromToken = useMemo(() => getAddressFromToken(), []);
  const userAddress = localStorage.getItem('userAddress');
  const effectiveAddress = account?.address || addressFromToken || userAddress;

  const [sidebarOpen, setSidebarOpen] = useState(false);
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
      });

      console.log('Prepared transactions:', prep.prepared);

      const seq = flattenPrepared(prep.prepared);

      if (!seq.length) throw new Error('No transactions returned by prepare');

      setPreparing(false);

      setExecuting(true);
      setTxHashes([]); // Reset transaction hashes

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

        const tx = prepareTransaction({
          to: t.to as Address,
          chain: defineChain(t.chainId),
          client,
          data: t.data as Hex,
          value: txValue,
        });

        console.log('Final prepared transaction value:', txValue.toString());

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
        errorMessage = 'Transação revertida pelo contrato (sem motivo detalhado).';
      }

      setError(errorMessage);
    } finally {
      setPreparing(false);
      setExecuting(false);
    }
  }

  async function handleSwapWithSessionKey() {
    if (!quote) {
      setError('Please wait for the quote to be calculated');
      return;
    }

    if (!hasSessionKey || !sessionKey) {
      setError('Session Key não encontrada. Crie uma smart wallet derivada primeiro na página Accounts.');
      return;
    }

    if (!clientId || !client) {
      setError('Missing THIRDWEB client configuration.');
      return;
    }

    setError(null);
    setSuccess(false);

    try {
      console.log('🔑 Executing swap with Session Key (automatic approval)...');
      console.log('Session Key Address:', sessionKey.address);
      console.log('Smart Account:', sessionKey.smartAccountAddress);

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

      console.log('=== SWAP WITH SESSION KEY DEBUG ===');
      console.log('Sell token:', sellToken.symbol, sellToken.address);
      console.log('Buy token:', buyToken.symbol, buyToken.address);
      console.log('Sell amount (human):', sellAmount);
      console.log('Sell amount (wei):', wei.toString());
      console.log('From chain:', fromChainId);
      console.log('To chain:', toChainId);

      // Use Smart Account address as sender
      const prep = await swapApi.prepare({
        fromChainId,
        toChainId,
        fromToken: normalizeToApi(sellToken.address),
        toToken: normalizeToApi(buyToken.address),
        amount: wei.toString(),
        sender: sessionKey.smartAccountAddress,
      });

      console.log('Prepared transactions:', prep.prepared);

      const seq = flattenPrepared(prep.prepared);

      if (!seq.length) throw new Error('No transactions returned by prepare');

      setPreparing(false);

      setExecuting(true);
      setTxHashes([]);

      // Create account from session key private key
      const sessionAccount = privateKeyToAccount({
        client,
        privateKey: sessionKey.privateKey,
      });

      console.log('✅ Session Key account created:', sessionAccount.address);

      for (const t of seq) {
        if (t.chainId !== fromChainId) {
          throw new Error(`Chain mismatch. Expected chain ${t.chainId}`);
        }

        console.log('=== TRANSACTION DEBUG (SESSION KEY) ===');
        console.log('Raw transaction from API:', t);

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

        const tx = prepareTransaction({
          to: t.to as Address,
          chain: defineChain(t.chainId),
          client,
          data: t.data as Hex,
          value: txValue,
        });

        console.log('🔐 Signing transaction with Session Key (no popup!)...');

        // Execute with session key account - NO POPUP!
        const result = await safeExecuteTransactionV2(async () => {
          return await sendTransaction({ account: sessionAccount, transaction: tx });
        });

        if (!result.success) {
          throw new Error(`Transaction failed: ${result.error}`);
        }

        if (!result.transactionHash) {
          throw new Error('Transaction failed: no transaction hash returned.');
        }

        setTxHashes(prev => [...prev, { hash: result.transactionHash!, chainId: t.chainId }]);
        console.log(`✅ Transaction ${result.transactionHash} submitted automatically with Session Key!`);
      }

      setSuccess(true);
      setSellAmount('');
      setBuyAmount('');
      setQuote(null);

      console.log('🎉 Swap executed successfully with Session Key - NO POPUP REQUIRED!');
    } catch (e: any) {
      let errorMessage = e.message || 'Failed to execute swap with Session Key';
      const lowerError = errorMessage.toLowerCase();

      if (lowerError.includes('insufficient funds') ||
          lowerError.includes('have 0 want') ||
          lowerError.includes('32003') ||
          lowerError.includes('gas required exceeds allowance')) {
        errorMessage = 'Saldo insuficiente na Smart Account. Deposite fundos na smart wallet primeiro (página Accounts).';
      }

      if (lowerError.includes('abierrorsignaturenotfounderror') || lowerError.includes('encoded error signature')) {
        errorMessage = 'Transação revertida pelo contrato (sem motivo detalhado).';
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

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-64 overflow-x-hidden">
        {/* Top Bar */}
        <div className="border-b border-cyan-500/20 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-gray-400 hover:text-white"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <h1 className="text-xl font-bold">Swap</h1>
          <div className="w-6" /> {/* Spacer */}
        </div>

        {/* Swap Interface */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="w-full max-w-lg mx-auto">
            {/* Swap Card */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-5 sm:p-6 shadow-xl">
              {/* Sell Section */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Sell</label>
                  <div className="text-xs text-gray-400">
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
                    <div className="text-sm text-gray-500 flex-shrink-0">0 USD</div>
                    <button
                      onClick={() => setShowSellSelector(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#333] transition-colors flex-shrink-0"
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
                  className="bg-[#2a2a2a] border border-gray-700 rounded-full p-2.5 hover:bg-[#333] transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-400">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              </div>

              {/* Buy Section */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Buy</label>
                  <div className="text-xs text-gray-400">
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
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
                      style={{
                        background: buyToken ? '#2a2a2a' : '#00d9ff',
                      }}
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
                        <span className="font-medium text-sm text-black whitespace-nowrap">Select Token</span>
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
                className="w-full py-4 rounded-xl font-semibold text-base transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: quote ? '#00d9ff' : '#4a7c7e',
                  color: quote ? '#000' : 'white',
                }}
              >
                {executing
                  ? 'Executando swap...'
                  : preparing
                    ? 'Preparando transação...'
                    : quoting
                      ? 'Calculando cotação...'
                      : quote
                        ? 'Start Swap'
                        : 'Aguardando cotação...'}
              </button>

              {/* Session Key Swap Button */}
              {hasSessionKey && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-purple-400">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-xs text-purple-300">Session Key Ativa - Aprovação Automática Disponível</span>
                  </div>
                  <button
                    onClick={handleSwapWithSessionKey}
                    disabled={!quote || quoting || preparing || executing}
                    className="w-full py-4 rounded-xl font-semibold text-base transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                  >
                    {executing
                      ? '🔑 Executando com Session Key...'
                      : preparing
                        ? 'Preparando transação...'
                        : quoting
                          ? 'Calculando cotação...'
                          : quote
                            ? '🔑 Swap Automático (Sem Popup!)'
                            : 'Aguardando cotação...'}
                  </button>
                  <div className="text-xs text-gray-400 text-center">
                    ⚡ Este swap será executado automaticamente usando sua Session Key, sem necessidade de aprovar no popup!
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="text-sm text-red-400">{error}</div>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
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

                    <h3 className="text-xl font-bold text-white mb-2">💰 Adicionar Fundos</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Seu saldo é insuficiente para executar esta transação. Adicione fundos à sua carteira.
                    </p>

                    <div className="mb-4">
                      <PayEmbed
                        client={client}
                        theme="dark"
                        payOptions={{
                          mode: 'fund_wallet',
                          metadata: {
                            name: 'Adicionar fundos para swap',
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
                      Fechar
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
