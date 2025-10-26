'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import SwapIcon from '../../../public/icons/Swap.svg';
import { useActiveAccount } from 'thirdweb/react';
import { useStakingApi } from '@/features/staking/api';
import { useStakingData } from '@/features/staking/useStakingData';

type StakingActionType = 'stake' | 'unstake';


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

// function formatTime(timestamp: number): string {
//   const date = new Date(timestamp);
//   return date.toLocaleDateString('en-US', {
//     year: 'numeric',
//     month: 'short',
//     day: 'numeric'
//   });
// }

export default function StakingPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const stakingApi = useStakingApi();
  
  // Use the new hook for data management
  const { 
    tokens, 
    userPosition, 
    loading: dataLoading, 
    error: dataError, 
    refresh, 
    clearCacheAndRefresh 
  } = useStakingData();

  const addressFromToken = useMemo(() => getAddressFromToken(), []);
  const userAddress = localStorage.getItem('userAddress');
  const effectiveAddress = account?.address || addressFromToken || userAddress;

  const [exploreDropdownOpen, setExploreDropdownOpen] = useState(false);
  const [action, setAction] = useState<StakingActionType>('stake');
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);

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

    try {
      let transaction;
      
      // Execute transaction based on action
      switch (action) {
        case 'stake':
          transaction = await stakingApi.stake(amount);
          break;
        case 'unstake':
          transaction = await stakingApi.unstake(amount);
          break;
        default:
          throw new Error('Invalid action');
      }

      if (transaction) {
        console.log(`${action} transaction successful:`, transaction.id);
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
      case 'stake': return 'Stake';
      case 'unstake': return 'Unstake';
      default: return 'Execute';
    }
  };

  const canExecute = useMemo(() => {
    return Boolean(amount && parseFloat(amount) > 0);
  }, [amount]);

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
        {/* Staking Interface */}
        <div className="h-full flex items-center justify-center p-4">
          {initializing || dataLoading ? (
            <div className="text-center">
              <div className="loader-inline-lg mb-4" />
              <p className="text-gray-400">Loading staking data...</p>
            </div>
          ) : (
            <div className="w-full max-w-md">
            {/* Staking Card */}
            <div className="bg-[#1C1C1C]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold text-white">Liquid Staking</h2>
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
                <p className="text-gray-400 text-sm">Stake ETH and earn rewards with Lido protocol</p>
              </div>

              {/* User Position Summary */}
              {userPosition && (
                <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-6">
                  <h3 className="text-white font-semibold mb-3">Your Position</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Staked:</span>
                      <span className="text-white font-medium">
                        {formatAmount(userPosition.stakedAmount, 18)} ETH
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">stETH Balance:</span>
                      <span className="text-white font-medium">
                        {formatAmount(userPosition.stETHBalance, 18)} stETH
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Rewards:</span>
                      <span className="text-green-400 font-medium">
                        {formatAmount(userPosition.rewards, 18)} ETH
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">APY:</span>
                      <span className="text-green-400 font-medium">
                        {userPosition.apy.toFixed(2)}%
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
                  onChange={(e) => setAction(e.target.value as StakingActionType)}
                  className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/20 text-white focus:outline-none focus:border-white/40"
                >
                  <option value="stake">Stake ETH → stETH</option>
                  <option value="unstake">Unstake stETH → ETH</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {action === 'stake' 
                    ? 'Convert ETH to stETH and start earning rewards' 
                    : 'Convert stETH back to ETH and claim rewards'
                  }
                </p>
              </div>

              {/* Token Display */}
              <div className="mb-4">
                <label className="text-xs text-white uppercase tracking-wide font-medium mb-2 block">Token</label>
                <div className="px-4 py-3 rounded-lg bg-black/40 border border-white/20 text-white">
                  {action === 'stake' ? 'ETH → stETH' : 'stETH → ETH'}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {action === 'stake' 
                    ? 'You will receive stETH tokens in return' 
                    : 'You will receive ETH tokens in return'
                  }
                </p>
              </div>

              {/* Amount Input */}
              <div className="mb-6">
                <label className="text-xs text-white uppercase tracking-wide font-medium mb-2 block">
                  {action === 'stake' ? 'Amount to Stake' : 'Amount to Unstake'}
                </label>
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
                  <span>
                    Available: {tokens.length > 0 ? formatAmount(tokens[0].totalStaked, tokens[0].decimals) : '0'} {action === 'stake' ? 'ETH' : 'stETH'}
                  </span>
                  <button
                    onClick={() => setAmount(tokens.length > 0 ? formatAmount(tokens[0].totalStaked, tokens[0].decimals) : '0')}
                    className="text-cyan-400 hover:text-cyan-300 underline"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Token Info */}
              <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-6">
                <h4 className="text-white font-semibold mb-3">
                  {action === 'stake' ? 'ETH Staking Info' : 'stETH Unstaking Info'}
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Staking APY:</span>
                    <span className="text-green-400 font-medium">
                      {tokens.length > 0 ? formatAPY(tokens[0].stakingAPY) : '4.2%'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Staked:</span>
                    <span className="text-white font-medium">
                      {tokens.length > 0 ? formatAmount(tokens[0].totalStaked, tokens[0].decimals) : '0'} ETH
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Lock Period:</span>
                    <span className="text-white font-medium">No Lock</span>
                  </div>
                </div>
              </div>

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
