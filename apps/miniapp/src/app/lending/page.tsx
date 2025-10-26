'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import SwapIcon from '../../../public/icons/Swap.svg';
import { useActiveAccount } from 'thirdweb/react';
import { useLendingApi, LendingToken } from '@/features/lending/api';
import { useLendingData } from '@/features/lending/useLendingData';

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
    maximumFractionDigits: 6 
  });
}

function formatAPY(apy: number): string {
  return `${apy.toFixed(2)}%`;
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

  const [exploreDropdownOpen, setExploreDropdownOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<LendingToken | null>(null);
  const [action, setAction] = useState<LendingActionType>('supply');
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);

  // Update selected token when tokens change
  useEffect(() => {
    if (tokens.length > 0 && !selectedToken) {
      setSelectedToken(tokens[0]);
    }
  }, [tokens, selectedToken]);

  // Update initializing state
  useEffect(() => {
    if (account) {
      setInitializing(false);
    }
  }, [account]);

  const handleAction = async () => {
    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError(null);

    if (!selectedToken) {
      setError('Please select a token');
      return;
    }

    try {
      let txData;
      
      // Prepare transaction based on action
      switch (action) {
        case 'supply':
          txData = await lendingApi.prepareSupply(selectedToken.address, amount);
          break;
        case 'withdraw':
          txData = await lendingApi.prepareWithdraw(selectedToken.address, amount);
          break;
        case 'borrow':
          txData = await lendingApi.prepareBorrow(selectedToken.address, amount);
          break;
        case 'repay':
          txData = await lendingApi.prepareRepay(selectedToken.address, amount);
          break;
        default:
          throw new Error('Invalid action');
      }

      if (txData.status !== 200) {
        throw new Error(txData.msg || 'Failed to prepare transaction');
      }

      // Execute transaction
      const success = await lendingApi.executeTransaction({
        to: txData.data.to,
        value: txData.data.value,
        data: txData.data.data,
        gasLimit: txData.data.gas,
        gasPrice: txData.data.gasPrice
      });

      if (success) {
        console.log(`${action} transaction successful`);
        setAmount('');
        
        // Refresh data using the hook
        refresh();
      } else {
        throw new Error('Transaction failed');
      }
      
    } catch (err) {
      console.error('Transaction error:', err);
      setError(err instanceof Error ? err.message : 'Transaction failed. Please try again.');
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
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Top Navbar - Same as swap */}
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
            {(account?.address || effectiveAddress) ? (
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
        {/* Lending Interface */}
        <div className="h-full flex items-center justify-center p-4">
          {initializing || dataLoading ? (
            <div className="text-center">
              <div className="loader-inline-lg mb-4" />
              <p className="text-gray-400">Loading lending data...</p>
            </div>
          ) : (
            <div className="w-full max-w-md">
            {/* Lending Card */}
            <div className="bg-[#1C1C1C]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {/* Benqi Logo */}
                    <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
                      <Image 
                        src="https://s2.coinmarketcap.com/static/img/coins/64x64/9288.png" 
                        alt="Benqi Protocol" 
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Lending Service</h2>
                  </div>
                  <button
                    onClick={clearCacheAndRefresh}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                    title="Refresh data"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                <p className="text-gray-400 text-sm">Powered by Benqi Protocol on Avalanche</p>
              </div>

              {/* User Position Summary */}
              {userPosition && (
                <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-6">
                  <h3 className="text-white font-semibold mb-3">Your Position</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Supplied:</span>
                      <span className="text-white font-medium">
                        {formatAmount(userPosition.suppliedAmount, userPosition.token.decimals)} {userPosition.token.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Borrowed:</span>
                      <span className="text-white font-medium">
                        {formatAmount(userPosition.borrowedAmount, userPosition.token.decimals)} {userPosition.token.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Health Factor:</span>
                      <span className={`font-medium ${userPosition.healthFactor > 1.5 ? 'text-green-400' : 'text-red-400'}`}>
                        {userPosition.healthFactor.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Selection */}
              <div className="mb-4">
                <label className="text-xs text-white uppercase tracking-wide font-medium mb-2 block">Action</label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value as LendingActionType)}
                  className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/20 text-white focus:outline-none focus:border-white/40"
                >
                  <option value="supply">Supply Assets</option>
                  <option value="withdraw">Withdraw Assets</option>
                  <option value="borrow">Borrow Assets</option>
                  <option value="repay">Repay Assets</option>
                </select>
              </div>

              {/* Token Selection */}
              <div className="mb-4">
                <label className="text-xs text-white uppercase tracking-wide font-medium mb-2 block">Asset</label>
                <select
                  value={selectedToken?.address || ''}
                  onChange={(e) => {
                    const token = tokens.find(t => t.address === e.target.value);
                    if (token) setSelectedToken(token);
                  }}
                  className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/20 text-white focus:outline-none focus:border-white/40"
                >
                  {tokens.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount Input */}
              <div className="mb-6">
                <label className="text-xs text-white uppercase tracking-wide font-medium mb-2 block">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-white/40"
                />
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                  <span>Available: {selectedToken ? formatAmount(selectedToken.availableLiquidity, selectedToken.decimals) : '0'} {selectedToken?.symbol || ''}</span>
                  <button
                    onClick={() => selectedToken && setAmount(formatAmount(selectedToken.availableLiquidity, selectedToken.decimals))}
                    className="text-cyan-400 hover:text-cyan-300 underline"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Token Info */}
              {selectedToken && (
                <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-6">
                  <h4 className="text-white font-semibold mb-3">{selectedToken.symbol} Market Info</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Supply APY:</span>
                      <span className="text-green-400 font-medium">{formatAPY(selectedToken.supplyAPY)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Borrow APY:</span>
                      <span className="text-red-400 font-medium">{formatAPY(selectedToken.borrowAPY)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Collateral Factor:</span>
                      <span className="text-white font-medium">{(selectedToken.collateralFactor * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleAction}
                disabled={!canExecute || loading}
                className="w-full py-4 rounded-xl font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white text-black hover:bg-white/90"
              >
                {loading ? 'Processing...' : getActionLabel()}
              </button>

              {/* Error Messages */}
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="text-sm text-red-400">{error}</div>
                </div>
              )}
              
              {dataError && (
                <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="text-sm text-yellow-400">
                    Data loading error: {dataError}
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
  );
}
