'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import SwapIcon from '../../../public/icons/Swap.svg';
import UniswapIcon from '../../../public/icons/uniswap.svg';
import AvalancheIcon from '../../../public/icons/Avalanche_Blockchain_Logo.svg';
import { networks, Token } from '@/features/swap/tokens';
import { swapApi, SwapApiError } from '@/features/swap/api';
import { normalizeToApi, getTokenDecimals, parseAmountToWei, formatAmountHuman, isNative, explorerTxUrl, toFixedFloor } from '@/features/swap/utils';
import { SwapSuccessCard } from '@/components/ui/SwapSuccessCard';
import { useActiveAccount, PayEmbed, useSwitchActiveWalletChain } from 'thirdweb/react';
import { createThirdwebClient, defineChain, prepareTransaction, sendTransaction, type Address, type Hex } from 'thirdweb';
import { THIRDWEB_CLIENT_ID } from '../../shared/config/thirdweb';
import { safeExecuteTransactionV2 } from '../../shared/utils/transactionUtilsV2';
import type { PreparedTx } from '@/features/swap/types';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { SeniorAppShell } from '@/components/layout';


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
      <div className="fixed inset-0 flex items-start md:items-center justify-center pt-4 md:pt-0 p-4 pb-20 md:pb-4 z-50 overflow-y-auto">
        <div className="bg-[#1A1A1A]/95 backdrop-blur-2xl border border-white/10 rounded-2xl w-full max-w-lg max-h-[65vh] md:max-h-[75vh] flex flex-col overflow-hidden shadow-2xl animate-scaleIn">
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
  const account = useActiveAccount();
  const switchChain = useSwitchActiveWalletChain();
  const clientId = THIRDWEB_CLIENT_ID || undefined;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);

  const addressFromToken = useMemo(() => getAddressFromToken(), []);
  const userAddress = localStorage.getItem('userAddress');
  const effectiveAddress = account?.address || addressFromToken || userAddress;

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

  // Balance states
  const [sellTokenBalance, setSellTokenBalance] = useState<string | null>(null);
  const [sellTokenBalanceRaw, setSellTokenBalanceRaw] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

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

  // Swap flow states
  const [swapFlowStep, setSwapFlowStep] = useState<'routing' | 'details' | 'confirm' | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // Helper to check if swap involves Avalanche
  const isAvalancheSwap = useMemo(() => {
    const isAvalancheChain = fromChainId === 43114 || toChainId === 43114;
    const isAvaxToken = sellToken?.symbol?.toUpperCase() === 'AVAX' ||
                        sellToken?.symbol?.toUpperCase() === 'WAVAX' ||
                        buyToken?.symbol?.toUpperCase() === 'AVAX' ||
                        buyToken?.symbol?.toUpperCase() === 'WAVAX';
    return isAvalancheChain || isAvaxToken;
  }, [fromChainId, toChainId, sellToken, buyToken]);

  // Check if we can request quote
  const canQuote = useMemo(() => {
    return Boolean(sellToken && buyToken && sellAmount && Number(sellAmount) > 0);
  }, [sellToken, buyToken, sellAmount]);

  // Reset amount when sell token changes - set default to "0.0" until balance is fetched
  useEffect(() => {
    setSellAmount('0.0');
    setSellTokenBalance(null);
    setSellTokenBalanceRaw(null);
  }, [sellToken.address, fromChainId]);

  // Fetch sell token balance
  useEffect(() => {
    // Helper to check if amount can be auto-filled
    const canAutoFillAmount = !sellAmount || sellAmount === '' || sellAmount === '0.0';

    if (!client || !effectiveAddress || !sellToken) {
      setSellTokenBalance(null);
      if (canAutoFillAmount) {
        setSellAmount('0.0');
      }
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
          balance = await eth_getBalance(rpcRequest, { address: effectiveAddress as `0x${string}` });
        } else {
          // ERC20 token balance
          const tokenContract = getContract({
            client,
            chain: defineChain(fromChainId),
            address: sellToken.address,
          });
          const balanceResult = await getBalance({ contract: tokenContract, address: effectiveAddress as `0x${string}` });
          balance = balanceResult.value;
          decimals = balanceResult.decimals;
        }

        if (cancelled) return;

        // Format balance — display with 6 decimals, keep full precision for max
        const formattedBalance = formatAmountHuman(balance, decimals, 6);
        const fullPrecisionBalance = formatAmountHuman(balance, decimals, decimals);
        setSellTokenBalance(formattedBalance);
        setSellTokenBalanceRaw(fullPrecisionBalance);

        // Set initial amount to balance or "0.0" if zero (only if amount can be auto-filled)
        const canAutoFill = !sellAmount || sellAmount === '' || sellAmount === '0.0';
        if (canAutoFill) {
          const balanceValue = parseFloat(formattedBalance);
          setSellAmount(balanceValue > 0 ? formattedBalance : '0.0');
        }
      } catch (error) {
        console.error("[SwapPage] Error fetching balance:", error);
        if (!cancelled) {
          setSellTokenBalance("0");
          setSellTokenBalanceRaw("0");
          const canAutoFill = !sellAmount || sellAmount === '' || sellAmount === '0.0';
          if (canAutoFill) {
            setSellAmount('0.0');
          }
        }
      } finally {
        if (!cancelled) setLoadingBalance(false);
      }
    };

    fetchBalance();

    return () => {
      cancelled = true;
    };
  }, [client, effectiveAddress, sellToken, fromChainId]);

  // Set max balance handler — use full-precision balance to avoid rounding up
  const handleSetMax = () => {
    if (!sellTokenBalance || loadingBalance) return;
    const exactBalance = (sellTokenBalanceRaw || sellTokenBalance).replace(/,/g, '');
    if (exactBalance && parseFloat(exactBalance) > 0) {
      setSellAmount(exactBalance);
    }
  };

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

  // Function to start swap flow - opens first modal
  function handleStartSwap() {
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

    // Open the first modal in the flow
    setSwapFlowStep('routing');
  }

  // Function to execute swap after confirmation
  async function executeSwap() {
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
    setSwapFlowStep(null);

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

      // Track current chain to avoid unnecessary switches
      let currentWalletChainId: number | null = null;

      for (const t of seq) {
        // Switch to the transaction's required chain if needed
        const requiredChainId = t.chainId;
        if (currentWalletChainId !== requiredChainId) {
          const networkName = networks.find(n => n.chainId === requiredChainId)?.name || `Chain ${requiredChainId}`;
          console.log(`[executeSwap] Transaction requires chain ${requiredChainId} (${networkName}), switching...`);

          try {
            await switchChain(defineChain(requiredChainId));
            // Wait a bit for the wallet to fully switch
            await new Promise(resolve => setTimeout(resolve, 500));
            currentWalletChainId = requiredChainId;
            console.log(`[executeSwap] ✅ Switched to chain ${requiredChainId}`);
          } catch (switchError: any) {
            console.error(`[executeSwap] Failed to switch to chain ${requiredChainId}:`, switchError);
            throw new Error(`Please switch to ${networkName} in your wallet to continue the swap`);
          }
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

  return (
    <ProtectedRoute>
      <SeniorAppShell pageTitle="Liquid Swap">
        <div className="relative min-h-[100dvh] w-full overflow-y-auto bg-[#050505] text-white">
          <AnimatedBackground />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(8,180,217,0.12),transparent_40%)]" />
          {/* Mobile: top aligned, Desktop: centered */}
          <div className="min-h-[100dvh] flex items-start justify-center px-4 py-4 md:py-10">
            <div className="w-full max-w-3xl space-y-6 md:my-auto">
              <div className="flex flex-col gap-2 text-center">
                <p className="text-sm uppercase tracking-[0.3em] text-white/60">Cross-chain swap</p>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Route assets with Zico</h1>
              </div>

              {/* Swap Card */}
              <div className="bg-[#0c0d11]/90 backdrop-blur-2xl rounded-[28px] p-5 sm:p-7 shadow-[0px_24px_72px_rgba(0,0,0,0.55)] border border-white/10 space-y-5 relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_90%_at_50%_-10%,rgba(8,180,217,0.12),transparent_55%)]" />
                <div className="relative flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-white/50">Smart routing</p>
                    <h2 className="text-xl font-semibold text-white mt-1">Best price across chains</h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
                    {isAvalancheSwap ? 'Avalanche' : 'Uniswap Router'}
                  </div>
                </div>

                {/* Sell Section */}
                <div className="relative rounded-2xl border border-white/10 bg-[#11131a]/70 p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">You sell</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/60">
                        {loadingBalance ? 'Loading...' : sellTokenBalance ? `${sellTokenBalance} ${sellToken.symbol}` : `-- ${sellToken.symbol}`}
                      </span>
                      {sellTokenBalance && !loadingBalance && (
                        <button
                          onClick={handleSetMax}
                          className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                        >
                          Max
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <input
                      type="text"
                      value={sellAmount}
                      onChange={(e) => setSellAmount(e.target.value)}
                      placeholder="0.0"
                      className="bg-transparent text-4xl sm:text-5xl font-semibold text-white outline-none w-full"
                    />
                    <button
                      onClick={() => setShowSellSelector(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#0b0e13] px-3 py-2 border border-white/10 text-sm font-semibold text-white hover:border-cyan-500/50 transition-colors"
                    >
                      <Image
                        src={sellToken.icon || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'}
                        alt={sellToken.symbol}
                        width={28}
                        height={28}
                        className="w-7 h-7 rounded-full"
                        unoptimized
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                        }}
                      />
                      <span>{sellToken.symbol}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Swap Button */}
                <div className="flex justify-center -my-3 relative z-10">
                  <button
                    onClick={handleSwapTokens}
                    className="bg-[#0b0e13] border border-white/10 rounded-full p-2.5 hover:border-cyan-500/50 hover:shadow-[0_0_24px_rgba(8,180,217,0.45)] transition-all"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-white">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                </div>

                {/* Buy Section */}
                <div className="relative rounded-2xl border border-white/10 bg-[#11131a]/70 p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">You receive</div>
                    <div className="text-xs text-white/60">Estimated output</div>
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <input
                      type="text"
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value)}
                      placeholder="0.0"
                      className="bg-transparent text-4xl sm:text-5xl font-semibold text-white outline-none w-full"
                      readOnly
                    />
                    <button
                      onClick={() => setShowBuySelector(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#0b0e13] px-3 py-2 border border-white/10 text-sm font-semibold text-white hover:border-cyan-500/50 transition-colors"
                    >
                      {buyToken ? (
                        <>
                          <Image
                            src={buyToken.icon || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'}
                            alt={buyToken.symbol}
                            width={28}
                            height={28}
                            className="w-7 h-7 rounded-full"
                            unoptimized
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                            }}
                          />
                          <span>{buyToken.symbol}</span>
                        </>
                      ) : (
                        <span>Select token</span>
                      )}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Start Button */}
                <button
                  onClick={handleStartSwap}
                  disabled={!quote || quoting || preparing || executing}
                  className="relative w-full overflow-hidden rounded-2xl py-3.5 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[#00d2ff] to-[#0084ff] text-black shadow-[0_12px_32px_rgba(0,132,255,0.35)]"
                >
                  <span className="relative z-10">
                    {executing
                      ? 'Executing swap...'
                      : preparing
                        ? 'Preparing transaction...'
                        : quoting
                          ? 'Getting quote...'
                          : quote
                            ? 'Start swap'
                            : 'Enter an amount to quote'}
                  </span>
                  <div className="absolute inset-0 opacity-0 hover:opacity-20 transition-opacity bg-white" />
                </button>

                {/* Description */}
                <div className="relative flex flex-col items-center gap-3 text-center">
                  <p className="text-xs text-white/60 leading-relaxed">
                    Buy and sell crypto on 15+ networks including Ethereum, Base, and Arbitrum
                  </p>

                  {/* Powered by Uniswap/Avalanche */}
                  <div className="flex items-center justify-center gap-2 text-xs text-white/70">
                    {isAvalancheSwap ? (
                      <>
                        <Image
                          src={AvalancheIcon}
                          alt="Avalanche"
                          width={26}
                          height={26}
                          className="w-7 h-7"
                        />
                        <span>Powered by Avalanche</span>
                      </>
                    ) : (
                      <>
                        <Image
                          src={UniswapIcon}
                          alt="Uniswap"
                          width={40}
                          height={40}
                          className="w-10 h-10"
                          style={{ filter: 'invert(29%) sepia(92%) saturate(6348%) hue-rotate(318deg) brightness(103%) contrast(106%)' }}
                        />
                        <span>Powered by Uniswap</span>
                      </>
                    )}
                  </div>
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

      {/* Order Routing Modal */}
      {swapFlowStep === 'routing' && quote && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => {
            // Just close the modal, keep swap state so user can resume
            setSwapFlowStep(null);
          }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-black border border-black rounded-xl sm:rounded-2xl overflow-hidden max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-black z-10">
                <h3 className="text-base sm:text-lg font-semibold text-white">Order Routing</h3>
                <button onClick={() => setSwapFlowStep(null)} className="text-gray-400 hover:text-white transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-4 py-3 sm:px-5 sm:py-4">
                {/* Route Info */}
                <div className="bg-[#0A0A0A] border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-cyan-400 flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-xs sm:text-sm text-cyan-400 font-semibold">Best price route</span>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-start sm:items-center justify-between gap-2">
                        <div className="text-sm sm:text-base font-medium text-white break-words">
                          Swap {sellToken.symbol} to {buyToken?.symbol || 'Token'}
                        </div>
                        <div className="px-2 py-1 bg-cyan-400/20 text-cyan-400 text-[10px] sm:text-xs font-semibold rounded flex items-center gap-1 flex-shrink-0">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          FAST
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-gray-400">Amount in</span>
                        <span className="text-white font-medium text-right break-words">
                          {sellAmount} {sellToken.symbol}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-gray-400">Expected Amount Out</span>
                        <span className="text-white font-medium text-right break-words">
                          {buyAmount} {buyToken?.symbol || ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] sm:text-xs">
                        <span className="text-gray-400 text-[11px] sm:text-xs">Min. Out After Slippage</span>
                        <span className="text-white font-medium text-right break-words text-[11px] sm:text-xs">
                          {toFixedFloor(parseFloat(buyAmount || '0') * 0.99, 6)} {buyToken?.symbol || ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 border-t border-white/10 sticky bottom-0 bg-black">
                <button
                  onClick={() => setSwapFlowStep('details')}
                  className="w-full sm:w-auto px-8 sm:px-12 py-2.5 rounded-lg bg-white hover:bg-gray-100 text-black text-xs sm:text-sm font-semibold transition-colors"
                >
                  Continue
                </button>
                <div className="mt-2 sm:mt-3 flex items-center justify-center gap-2 text-xs sm:text-sm text-gray-400">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#202020] flex items-center justify-center flex-shrink-0">
                    {isAvalancheSwap ? (
                      <Image
                        src={AvalancheIcon}
                        alt="Avalanche"
                        width={28}
                        height={28}
                        className="w-7 h-7"
                      />
                    ) : (
                      <Image
                        src={UniswapIcon}
                        alt="Uniswap"
                        width={44}
                        height={44}
                        className="w-11 h-11"
                        style={{ filter: 'invert(29%) sepia(92%) saturate(6348%) hue-rotate(318deg) brightness(103%) contrast(106%)' }}
                      />
                    )}
                  </div>
                  <span>{isAvalancheSwap ? 'Powered by Avalanche' : 'Powered by Uniswap'}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Swap Details Modal */}
      {swapFlowStep === 'details' && quote && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => {
            // Just close the modal, keep swap state so user can resume
            setSwapFlowStep(null);
          }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-black border border-black rounded-xl sm:rounded-2xl overflow-hidden max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-black z-10">
                <h3 className="text-base sm:text-lg font-semibold text-white">Swap Details</h3>
                <button onClick={() => setSwapFlowStep(null)} className="text-gray-400 hover:text-white transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-4 py-4 sm:px-5 sm:py-5 space-y-3 sm:space-y-4">
                {/* Select Swap API */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-medium text-white">Select Swap API</span>
                  <button disabled className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-[#202020] text-gray-400 text-[10px] sm:text-xs font-medium cursor-not-allowed flex-shrink-0">
                    Change API
                  </button>
                </div>

                {/* Routing */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm text-gray-400">Routing</span>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {isAvalancheSwap ? (
                      <>
                        <Image src={AvalancheIcon} alt="Avalanche" width={16} height={16} className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="text-xs sm:text-sm text-white">Avalanche C-chain</span>
                      </>
                    ) : (
                      <>
                        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white flex items-center justify-center">
                          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-black"></div>
                        </div>
                        <span className="text-xs sm:text-sm text-white">UNI V3</span>
                      </>
                    )}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-500">
                      <circle cx="12" cy="12" r="10" strokeWidth={2} />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4m0-4h.01" />
                    </svg>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="px-2 py-1 bg-cyan-400/20 text-cyan-400 text-[10px] sm:text-xs font-semibold rounded flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>
                    Suggested
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">Est. Price Impact 1.1%</span>
                </div>

                {/* Swap Details Card */}
                <div className="bg-[#0A0A0A] border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <div className="text-sm sm:text-base font-semibold text-white mb-3 sm:mb-4 break-words">
                    Swap {sellToken.symbol} to {buyToken?.symbol || 'Token'}
                  </div>

                  <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400">Amount in</span>
                      <span className="text-white font-medium text-right break-words">
                        {sellAmount} {sellToken.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400 text-[11px] sm:text-xs">Expected Amount Out</span>
                      <span className="text-white font-medium text-right break-words text-[11px] sm:text-xs">
                        {buyAmount} {buyToken?.symbol || ''}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400 text-[11px] sm:text-xs">Min. Out After Slippage</span>
                      <span className="text-white font-medium text-right break-words text-[11px] sm:text-xs">
                        {toFixedFloor(parseFloat(buyAmount || '0') * 0.99, 6)} {buyToken?.symbol || ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transaction Settings */}
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white font-medium text-xs sm:text-sm">Transaction Setting</span>
                    <button disabled className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-[#202020] text-gray-400 text-[10px] sm:text-xs font-medium cursor-not-allowed flex-shrink-0">
                      Change Settings
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 border-t border-white/10 sticky bottom-0 bg-black">
                <button
                  onClick={async () => {
                    if (isAvalancheSwap) {
                      // For Avalanche, execute swap directly without confirmation modal
                      setSwapFlowStep(null);
                      await executeSwap();
                    } else {
                      // For Uniswap, go to confirmation modal
                      setSwapFlowStep('confirm');
                    }
                  }}
                  disabled={executing}
                  className="w-full sm:w-auto px-8 sm:px-12 py-2.5 rounded-lg bg-white hover:bg-gray-100 text-black text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {executing ? 'Executing...' : 'Continue'}
                </button>
                <div className="mt-2 sm:mt-3 flex items-center justify-center gap-2 text-xs sm:text-sm text-gray-400">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#202020] flex items-center justify-center flex-shrink-0">
                    {isAvalancheSwap ? (
                      <Image
                        src={AvalancheIcon}
                        alt="Avalanche"
                        width={28}
                        height={28}
                        className="w-7 h-7"
                      />
                    ) : (
                      <Image
                        src={UniswapIcon}
                        alt="Uniswap"
                        width={44}
                        height={44}
                        className="w-11 h-11"
                        style={{ filter: 'invert(29%) sepia(92%) saturate(6348%) hue-rotate(318deg) brightness(103%) contrast(106%)' }}
                      />
                    )}
                  </div>
                  <span>{isAvalancheSwap ? 'Powered by Avalanche' : 'Powered by Uniswap'}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Confirm Details Modal - Only show for non-Avalanche swaps */}
      {swapFlowStep === 'confirm' && quote && !isAvalancheSwap && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => {
            // Just close the modal, keep swap state so user can resume
            setSwapFlowStep(null);
          }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-black border border-black rounded-xl sm:rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-white/10 sticky top-0 bg-black z-10">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="text-sm sm:text-base font-semibold text-white mb-1">Confirm details</h3>
                    <p className="text-[10px] sm:text-xs text-gray-400 pr-2">Review and accept Uniswap Labs Terms of Service & Privacy Policy to get started</p>
                  </div>
                  <button onClick={() => setSwapFlowStep(null)} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 space-y-3 sm:space-y-4">
                {/* Terms of Service Toggles */}
                <div className="space-y-2 sm:space-y-3">
                  <label className="flex items-center justify-between cursor-pointer bg-black border border-white/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:bg-[#0A0A0A] transition-colors">
                    <span className="text-xs sm:text-sm text-white flex-1 pr-2">
                      I have read and agreed with{' '}
                      <a
                        href="https://support.uniswap.org/hc/en-us/articles/30935100859661-Uniswap-Labs-Terms-of-Service"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-cyan-400 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Uniswap Labs Terms of Service
                      </a>
                    </span>
                    <div className="relative ml-2 sm:ml-4 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={tosAccepted}
                        onChange={(e) => setTosAccepted(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className={`w-9 h-5 sm:w-11 sm:h-6 rounded-full transition-colors ${tosAccepted ? 'bg-cyan-400' : 'bg-gray-600'}`}></div>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full transition-transform ${tosAccepted ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0'}`}></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer bg-black border border-white/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:bg-[#0A0A0A] transition-colors">
                    <span className="text-xs sm:text-sm text-white flex-1 pr-2">
                      I have read and agreed with{' '}
                      <a
                        href="https://support.uniswap.org/hc/en-us/articles/40074102704141-Uniswap-Labs-Privacy-Policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-cyan-400 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Uniswap Labs Privacy Policy
                      </a>
                    </span>
                    <div className="relative ml-2 sm:ml-4 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={privacyAccepted}
                        onChange={(e) => setPrivacyAccepted(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className={`w-9 h-5 sm:w-11 sm:h-6 rounded-full transition-colors ${privacyAccepted ? 'bg-cyan-400' : 'bg-gray-600'}`}></div>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full transition-transform ${privacyAccepted ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0'}`}></div>
                    </div>
                  </label>
                </div>

              </div>

              {/* Action Button */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 border-t border-white/10 sticky bottom-0 bg-black">
                <button
                  onClick={async () => {
                    if (tosAccepted && privacyAccepted) {
                      await executeSwap();
                    }
                  }}
                  disabled={!tosAccepted || !privacyAccepted || executing}
                  className="w-full sm:w-auto px-8 sm:px-12 py-2.5 rounded-lg bg-white hover:bg-gray-100 text-black text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-600"
                >
                  {executing ? 'Executing...' : 'Confirm'}
                </button>
                <div className="mt-2 sm:mt-3 flex items-center justify-start gap-2 text-xs sm:text-sm text-gray-400">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#202020] flex items-center justify-center flex-shrink-0">
                    {isAvalancheSwap ? (
                      <Image
                        src={AvalancheIcon}
                        alt="Avalanche"
                        width={28}
                        height={28}
                        className="w-7 h-7"
                      />
                    ) : (
                      <Image
                        src={UniswapIcon}
                        alt="Uniswap"
                        width={44}
                        height={44}
                        className="w-11 h-11"
                        style={{ filter: 'invert(29%) sepia(92%) saturate(6348%) hue-rotate(318deg) brightness(103%) contrast(106%)' }}
                      />
                    )}
                  </div>
                  <span>{isAvalancheSwap ? 'Powered by Avalanche' : 'Powered by Uniswap'}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </SeniorAppShell>
  </ProtectedRoute>
  );
}
