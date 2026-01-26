'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import SwapIcon from '../../../public/icons/Swap.svg';
import { useActiveAccount } from 'thirdweb/react';
import { useLendingApi } from '@/features/lending/api';
import { useLendingData } from '@/features/lending/useLendingData';
import { VALIDATION_FEE, LENDING_CONFIG } from '@/features/lending/config';
import { LendingToken } from '@/features/lending/types';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { NetworkAwareButton } from '@/shared/components/NetworkAwareButton';
import { LENDING_CONFIG as LENDING_CHAIN_CONFIG } from '@/features/lending/config';

type LendingActionType = 'supply' | 'withdraw' | 'borrow' | 'repay';


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

function formatAmount(amount: string, decimals: number): string {
  const num = parseFloat(amount) / Math.pow(10, decimals);
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 8 
  });
}

function formatAPY(apy: number): string {
  return `${apy.toFixed(4)}%`;
}

// Function to get token balance from wallet
async function getTokenBalance(account: any, tokenAddress: string): Promise<string> {
  try {
    if (!account) return '0';

    // Use RPC call to get ERC20 balance
    const rpcUrl = "https://api.avax.network/ext/bc/C/rpc";

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            to: tokenAddress,
            data: `0x70a08231000000000000000000000000${account.address.slice(2)}` // balanceOf(address) + address
          },
          'latest'
        ],
        id: 1
      })
    });

    const data = await response.json();

    if (data.result) {
      const balance = parseInt(data.result, 16).toString();
      return balance;
    } else {
      throw new Error('Failed to fetch balance');
    }
  } catch (error) {
    console.error('[LENDING] Error fetching token balance:', error);
    return '1000000000000000000'; // 1 token in wei
  }
}

export default function LendingPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const lendingApi = useLendingApi();

  // Use the new hook for data management
  const {
    tokens,
    userPosition,
    loading: dataLoading,
    error: dataError,
    refresh,
    clearCacheAndRefresh
  } = useLendingData();

  const addressFromToken = useMemo(() => getAddressFromToken(), []);
  const userAddress = localStorage.getItem('userAddress');
  const effectiveAddress = account?.address || addressFromToken || userAddress;

  // Filter out invalid tokens (zero address, duplicates)
  const validTokens = useMemo(() => {
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    const seen = new Set<string>();

    return tokens.filter(token => {
      // Skip zero address
      if (token.address === zeroAddress) return false;

      // Skip duplicates
      if (seen.has(token.address)) return false;

      seen.add(token.address);
      return true;
    });
  }, [tokens]);

  const [exploreDropdownOpen, setExploreDropdownOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<LendingToken | null>(null);
  const [action, setAction] = useState<LendingActionType>('supply');
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
  const [loadingBalances, setLoadingBalances] = useState<boolean>(false);

  // Update selected token when tokens change
  useEffect(() => {
    if (validTokens.length > 0 && !selectedToken) {
      setSelectedToken(validTokens[0]);
    }
  }, [validTokens, selectedToken]);

  // Fetch token balances when account or tokens change
  useEffect(() => {
    const fetchTokenBalances = async () => {
      // Only fetch balances if we have an account object (MetaMask connected)
      // For JWT-only users, we'll show 0 balances or fetch differently
      if (!account || validTokens.length === 0) {
        // Set default balances to 0 for JWT users
        const defaultBalances: Record<string, string> = {};
        validTokens.forEach(token => {
          defaultBalances[token.address] = '0';
        });
        setTokenBalances(defaultBalances);
        return;
      }

      setLoadingBalances(true);
      const balances: Record<string, string> = {};

      for (const token of validTokens) {
        try {
          const balance = await getTokenBalance(account, token.address);
          balances[token.address] = balance;
        } catch (error) {
          console.error(`Error fetching balance for ${token.symbol}:`, error);
          balances[token.address] = '0';
        }
      }

      setTokenBalances(balances);
      setLoadingBalances(false);
    };

    fetchTokenBalances();
  }, [account, validTokens]);

  const handleAction = async () => {
    // Capture current action state to avoid race conditions
    const currentAction = action;
    const currentToken = selectedToken;
    const currentAmount = amount;

    // Validations
    if (!currentAmount || parseFloat(currentAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!currentToken) {
      setError('Please select a token');
      return;
    }

    // Account is required for blockchain transactions
    if (!account) {
      setError('Wallet not connected. Redirecting to reconnect...');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // FORCE switch to Avalanche before any lending transaction
      const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : null;
      if (ethereum) {
        const AVALANCHE_CHAIN_ID = 43114;
        const chainIdHex = `0x${AVALANCHE_CHAIN_ID.toString(16)}`; // 0xa86a

        try {
          const currentChainHex = await ethereum.request({ method: 'eth_chainId' });
          const currentChainId = parseInt(currentChainHex, 16);

          if (currentChainId !== AVALANCHE_CHAIN_ID) {
            console.log('[LENDING] Switching to Avalanche...');
            setSuccess('Switching to Avalanche network...');

            await ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: chainIdHex }],
            });

            console.log('[LENDING] Successfully switched to Avalanche');
            // Wait for the switch to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (switchError: any) {
          console.error('[LENDING] Switch error:', switchError);

          if (switchError?.code === 4902) {
            // Chain not added, try to add it
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: chainIdHex,
                chainName: 'Avalanche C-Chain',
                nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
                rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
                blockExplorerUrls: ['https://snowtrace.io'],
              }],
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else if (switchError?.code === 4001) {
            throw new Error('You must switch to Avalanche network to use Lending');
          } else {
            throw new Error('Failed to switch to Avalanche. Please switch manually in your wallet.');
          }
        }
      }

      let txData;

      // Prepare transaction based on action (use captured state)
      switch (currentAction) {
        case 'supply':
          txData = await lendingApi.prepareSupply(currentToken.address, currentAmount);
          break;
        case 'withdraw':
          txData = await lendingApi.prepareWithdraw(currentToken.address, currentAmount);
          break;
        case 'borrow':
          txData = await lendingApi.prepareBorrow(currentToken.address, currentAmount);
          break;
        case 'repay':
          txData = await lendingApi.prepareRepay(currentToken.address, currentAmount);
          break;
        default:
          throw new Error(`Invalid action: ${currentAction}`);
      }

      if (txData.status !== 200) {
        throw new Error(txData.msg || 'Failed to prepare transaction');
      }

      // Extract transaction data based on action type
      let mainTransactionData;
      const validationData = txData.data.validation;

      switch (action) {
        case 'supply':
          mainTransactionData = txData.data.supply;
          break;
        case 'withdraw':
          mainTransactionData = txData.data.withdraw;
          break;
        case 'borrow':
          mainTransactionData = txData.data.borrow;
          break;
        case 'repay':
          mainTransactionData = txData.data.repay;
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // STEP 1: Execute validation transaction first
      console.log('[LENDING] Executing validation transaction...');
      const validationTxData = {
        to: validationData.to,
        value: validationData.value,
        data: validationData.data,
        gasLimit: validationData.gas,
        gasPrice: validationData.gasPrice,
        chainId: LENDING_CONFIG.DEFAULT_CHAIN_ID // 43114 (Avalanche)
      };

      const validationSuccess = await lendingApi.executeTransaction(validationTxData);
      if (!validationSuccess) {
        throw new Error('Validation transaction failed');
      }
      console.log('[LENDING] Validation transaction confirmed');

      // STEP 2: Execute main transaction (supply/borrow/withdraw/repay)
      console.log(`[LENDING] Executing ${action} transaction...`);
      const mainTxData = {
        to: mainTransactionData.to,
        value: mainTransactionData.value,
        data: mainTransactionData.data,
        gasLimit: mainTransactionData.gas,
        gasPrice: mainTransactionData.gasPrice,
        chainId: LENDING_CONFIG.DEFAULT_CHAIN_ID // 43114 (Avalanche)
      };

      const success = await lendingApi.executeTransaction(mainTxData);

      if (success) {
        setAmount('');
        setSuccess(`${action.charAt(0).toUpperCase() + action.slice(1)} completed! (Validation + ${action} transactions confirmed)`);

        // Refresh data using the hook
        refresh();

        // Refresh token balances
        const refreshBalances = async () => {
          if (!account || validTokens.length === 0) return;

          setLoadingBalances(true);
          const balances: Record<string, string> = {};

          for (const token of validTokens) {
            try {
              const balance = await getTokenBalance(account, token.address);
              balances[token.address] = balance;
            } catch (error) {
              console.error('[LENDING] Error fetching balance:', error);
              balances[token.address] = '0';
            }
          }

          setTokenBalances(balances);
          setLoadingBalances(false);
        };

        refreshBalances();

        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(null), 5000);
      } else {
        throw new Error('Transaction failed');
      }

    } catch (err) {
      console.error('[LENDING] Transaction error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = () => {
    switch (action) {
      case 'supply': return 'Supply';
      case 'withdraw': return 'Withdraw';
      case 'borrow': return 'Borrow';
      case 'repay': return 'Repay';
      default: return 'Execute';
    }
  };

  const canExecute = useMemo(() => {
    return Boolean(selectedToken && amount && parseFloat(amount) > 0);
  }, [selectedToken, amount]);

  return (
    <ProtectedRoute>
      <div className="h-screen text-white flex flex-col overflow-hidden relative">
        {/* Animated Background */}
        <AnimatedBackground />

      {/* Top Navbar - Same as swap */}
      <header className="flex-shrink-0 bg-black/40 backdrop-blur-md border-b-2 border-white/15 px-6 py-3 z-50">
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
                        <button
                          onClick={() => {
                            setExploreDropdownOpen(false);
                            router.push('/lending');
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full text-left"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Lending
                        </button>
                        <button
                          onClick={() => {
                            setExploreDropdownOpen(false);
                            router.push('/staking');
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full text-left"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Staking
                        </button>
                        <button
                          onClick={() => {
                            setExploreDropdownOpen(false);
                            router.push('/account');
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full text-left"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Account
                        </button>
                        <button
                          onClick={() => {
                            setExploreDropdownOpen(false);
                            router.push('/dca');
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full text-left"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          DCA
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
            {(account?.address || effectiveAddress) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/30">
                <div className="w-2 h-2 rounded-full bg-[#00FFC3]"></div>
                <span className="text-white text-xs font-mono">
                  {account?.address
                    ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
                    : effectiveAddress
                      ? `${effectiveAddress.slice(0, 6)}...${effectiveAddress.slice(-4)}`
                      : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* Lending Interface */}
        <div className="h-full flex items-center justify-center p-3 sm:p-4">
          {dataLoading ? (
            <div className="text-center">
              <div className="loader-inline-lg mb-4" />
              <p className="text-gray-400 text-sm">Loading lending data...</p>
            </div>
          ) : (
            <div className="w-full max-w-[90vw] sm:max-w-sm">
            {/* Lending Card */}
            <div className="bg-[#202020]/75 backdrop-blur-xl border border-white/10 rounded-[25px] p-3 shadow-[0px_16px_57.7px_0px_rgba(0,0,0,0.42)]">
              {/* Header */}
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-base sm:text-lg font-bold text-white">Lending Service</h2>
                <button
                  onClick={clearCacheAndRefresh}
                  className="p-1.5 rounded-lg bg-[#2A2A2A]/80 border border-white/10 hover:bg-[#343434]/80 transition-colors flex-shrink-0"
                  title="Refresh data"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {/* User Position Summary */}
              {userPosition && (
                <div className="bg-[#2A2A2A]/80 border border-white/10 rounded-xl p-2.5 mb-1.5">
                  <h3 className="text-white font-semibold mb-1.5 text-xs">Your Position</h3>
                  <div className="space-y-0.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Supplied:</span>
                      <span className="text-white font-medium truncate ml-2">
                        {formatAmount(userPosition.suppliedAmount, userPosition.token.decimals)} {userPosition.token.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Borrowed:</span>
                      <span className="text-white font-medium truncate ml-2">
                        {formatAmount(userPosition.borrowedAmount, userPosition.token.decimals)} {userPosition.token.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Health Factor:</span>
                      <span className={`font-medium ${userPosition.healthFactor > 1.5 ? 'text-green-400' : 'text-red-400'}`}>
                        {userPosition.healthFactor.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Selection */}
              <div className="mb-1.5">
                <label className="text-xs text-gray-400 mb-1.5 block">Action</label>
                <select
                  value={action}
                  onChange={(e) => {
                    const newAction = e.target.value as LendingActionType;
                    console.log('🔀 [LENDING] Action changed:', action, '→', newAction);
                    setAction(newAction);
                  }}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[#2A2A2A]/80 border border-white/10 text-white focus:outline-none focus:border-white/20"
                >
                  <option value="supply">Supply Assets</option>
                  <option value="withdraw">Withdraw Assets</option>
                  <option value="borrow">Borrow Assets</option>
                  <option value="repay">Repay Assets</option>
                </select>
              </div>

              {/* Token Selection */}
              <div className="mb-1.5">
                <label className="text-xs text-gray-400 mb-1.5 block">Asset</label>
                <select
                  value={selectedToken?.address || ''}
                  onChange={(e) => {
                    const token = validTokens.find(t => t.address === e.target.value);
                    if (token) setSelectedToken(token);
                  }}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[#2A2A2A]/80 border border-white/10 text-white focus:outline-none focus:border-white/20"
                >
                  {validTokens.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount Input */}
              <div className="mb-1.5">
                <label className="text-xs text-gray-400 mb-1.5 block">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[#252525] border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-white/20"
                />
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <span>
                    Available: {loadingBalances ? 'Loading...' : selectedToken ? formatAmount(tokenBalances[selectedToken.address] || '0', selectedToken.decimals) : '0'} {selectedToken?.symbol || ''}
                  </span>
                  <button
                    onClick={() => {
                      if (selectedToken) {
                        const balance = tokenBalances[selectedToken.address] || '0';
                        setAmount(formatAmount(balance, selectedToken.decimals));
                      }
                    }}
                    className="text-[#4BDEDD] hover:text-[#4BDEDD]/80 underline font-medium"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Validation Fee Information */}
              {amount && parseFloat(amount) > 0 && selectedToken && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-2.5 mb-1.5">
                  <div className="flex items-start gap-2 mb-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-yellow-400 mt-0.5 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="text-yellow-400 font-semibold text-xs">Validation Fee</h4>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Total Amount:</span>
                      <span className="text-white font-medium truncate ml-2">{amount} {selectedToken.symbol}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 truncate mr-2">Fee ({VALIDATION_FEE.PERCENTAGE}%):</span>
                      <span className="text-yellow-400 font-medium truncate">{(parseFloat(amount) * VALIDATION_FEE.RATE).toFixed(6)} {selectedToken.symbol}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-yellow-500/20">
                      <span className="text-gray-300 font-medium">Net Amount:</span>
                      <span className="text-white font-semibold truncate ml-2">{(parseFloat(amount) * VALIDATION_FEE.NET_RATE).toFixed(6)} {selectedToken.symbol}</span>
                    </div>
                    <p className="text-yellow-400/80 text-xs mt-1 leading-snug">
                      Validation contract charges {VALIDATION_FEE.PERCENTAGE}% fee. Only {VALIDATION_FEE.NET_PERCENTAGE}% will be used for {action}.
                    </p>
                    <p className="text-cyan-400/80 text-xs mt-1 leading-snug font-medium">
                      ℹ️ You will sign 2 transactions: (1) Validation fee payment, (2) {action.charAt(0).toUpperCase() + action.slice(1)} operation.
                    </p>
                  </div>
                </div>
              )}

              {/* Token Info */}
              {selectedToken && (
                <div className="bg-[#2A2A2A]/80 border border-white/10 rounded-xl p-2.5 mb-1.5">
                  <h4 className="text-white font-semibold mb-1.5 text-xs">{selectedToken.symbol} Market Info</h4>
                  <div className="space-y-0.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Supply APY:</span>
                      <span className="text-green-400 font-medium">{formatAPY(selectedToken.supplyAPY)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Borrow APY:</span>
                      <span className="text-red-400 font-medium">{formatAPY(selectedToken.borrowAPY)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Collateral Factor:</span>
                      <span className="text-white font-medium">{(selectedToken.collateralFactor * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button with Network Guard */}
              <NetworkAwareButton
                requiredChainId={LENDING_CHAIN_CONFIG.DEFAULT_CHAIN_ID}
                onClick={handleAction}
                disabled={!canExecute}
                loading={loading}
                className="w-full"
              >
                {loading ? "Processing 2 transactions..." : getActionLabel()}
              </NetworkAwareButton>

              {/* Powered by Benqi */}
              <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-white/5">
                <div className="w-5 h-5 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                  <Image
                    src="https://s2.coinmarketcap.com/static/img/coins/64x64/9288.png"
                    alt="Benqi Protocol"
                    width={20}
                    height={20}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
                <p className="text-gray-400 text-xs">Powered by Benqi Protocol on Avalanche</p>
              </div>

              {/* Success Messages */}
              {success && (
                <div className="mt-1.5 p-2.5 rounded-xl bg-green-500/10 border border-green-500/30">
                  <div className="text-xs text-green-400">{success}</div>
                </div>
              )}

              {/* Error Messages */}
              {error && (
                <div className="mt-1.5 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
                  <div className="text-xs text-red-400 break-words">{error}</div>
                </div>
              )}

              {dataError && (
                <div className="mt-1.5 p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                  <div className="text-xs text-yellow-400">
                    Data error: {dataError}
                    <button
                      onClick={refresh}
                      className="ml-2 underline hover:no-underline"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
