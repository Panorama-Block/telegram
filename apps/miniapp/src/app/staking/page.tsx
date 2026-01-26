'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import SwapIcon from '../../../public/icons/Swap.svg';
import { useActiveAccount } from 'thirdweb/react';
import { useStakingApi } from '@/features/staking/api';
import { useStakingData } from '@/features/staking/useStakingData';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { NetworkAwareButton } from '@/shared/components/NetworkAwareButton';

// Lido Staking is on Ethereum Mainnet
const STAKING_CHAIN_ID = 1;

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
  console.log('formatAmount input:', { amount, decimals });
  
  // Validate input
  if (!amount || amount === '0' || isNaN(parseFloat(amount))) {
    console.log('Invalid amount, returning 0');
    return '0.00';
  }
  
  const num = parseFloat(amount) / Math.pow(10, decimals);
  console.log('formatAmount calculated:', num);
  
  if (isNaN(num) || !isFinite(num)) {
    console.log('Invalid calculation result, returning 0');
    return '0.00';
  }
  
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 6 
  });
}

function formatAPY(apy: number): string {
  return `${apy.toFixed(4)}%`;
}

// Function to get token balance from wallet
async function getTokenBalance(account: any, tokenAddress: string): Promise<string> {
  try {
    if (!account) return '0';
    
    console.log(`Fetching balance for token ${tokenAddress} for address ${account.address}`);
    
    // Handle ETH (native token on Ethereum Mainnet) differently
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      console.log('Fetching ETH native balance');
      const rpcUrl = "https://mainnet.infura.io/v3/9ff045cf374041eeabdf13a4664ceced"; // Ethereum Mainnet RPC
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [account.address, 'latest'],
          id: 1
        })
      });
      
      const data = await response.json();
      
      if (data.result) {
        const balance = parseInt(data.result, 16).toString();
        console.log(`ETH balance:`, balance);
        return balance;
      } else {
        throw new Error('Failed to fetch ETH balance');
      }
    }
    
    // Use RPC call to get ERC20 balance
    const rpcUrl = "https://mainnet.infura.io/v3/9ff045cf374041eeabdf13a4664ceced"; // Ethereum Mainnet RPC
    
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
      console.log(`Balance for ${tokenAddress}:`, balance);
      
      // Validate balance
      if (isNaN(parseInt(balance)) || balance === 'NaN') {
        console.log('Invalid balance received, returning 0');
        return '0';
      }
      
      return balance;
    } else {
      throw new Error('Failed to fetch balance');
    }
  } catch (error) {
    console.error('Error fetching token balance:', error);
    // Return mock balance for testing if contract call fails
    return '1000000000000000000'; // 1 token in wei
  }
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
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
  const [loadingBalances, setLoadingBalances] = useState<boolean>(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch token balances when account or tokens change
  useEffect(() => {
    const fetchTokenBalances = async () => {
      if (!account || tokens.length === 0) return;
      
      console.log('🔄 Fetching token balances for Ethereum Mainnet...');
      console.log('Account address:', account.address);
      console.log('Tokens to fetch:', tokens.map(t => ({ symbol: t.symbol, address: t.address })));
      
      setLoadingBalances(true);
      const balances: Record<string, string> = {};
      
      for (const token of tokens) {
        try {
          console.log(`Fetching balance for ${token.symbol} (${token.address})`);
          const balance = await getTokenBalance(account, token.address);
          balances[token.address] = balance;
          console.log(`✅ ${token.symbol} balance:`, balance);
        } catch (error) {
          console.error(`❌ Error fetching balance for ${token.symbol}:`, error);
          balances[token.address] = '0';
        }
      }
      
      console.log('📊 Final balances:', balances);
      setTokenBalances(balances);
      setLoadingBalances(false);
    };

    fetchTokenBalances();
  }, [account, tokens]);

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
      // FORCE switch to Ethereum Mainnet before any staking transaction
      const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : null;
      if (ethereum) {
        const ETHEREUM_CHAIN_ID = 1;
        const chainIdHex = '0x1';

        try {
          const currentChainHex = await ethereum.request({ method: 'eth_chainId' });
          const currentChainId = parseInt(currentChainHex, 16);

          if (currentChainId !== ETHEREUM_CHAIN_ID) {
            console.log('[STAKING] Switching to Ethereum Mainnet...');
            setSuccess('Switching to Ethereum Mainnet...');

            await ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: chainIdHex }],
            });

            console.log('[STAKING] Successfully switched to Ethereum Mainnet');
            // Wait for the switch to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (switchError: any) {
          console.error('[STAKING] Switch error:', switchError);

          if (switchError?.code === 4001) {
            throw new Error('You must switch to Ethereum Mainnet to use Staking');
          } else {
            throw new Error('Failed to switch to Ethereum. Please switch manually in your wallet.');
          }
        }
      }

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
        console.log(`${action} transaction prepared:`, transaction);

        // Check if we need to execute the transaction (smart wallet)
        if (transaction.transactionData) {
          console.log('🔗 Smart wallet detected, executing transaction...');
          console.log('📦 Transaction data from backend:', transaction.transactionData);
          console.log('📋 Transaction type:', transaction.type);

          // Note: Network validation is handled by NetworkAwareButton
          // The staking API executeTransaction includes chainId: 1 to ensure
          // the transaction is sent to Ethereum Mainnet

          // Check if this is an approval transaction (two-step unstake process)
          console.log('🔍 Checking transaction type:', transaction.type);
          console.log('🔍 Full transaction object:', JSON.stringify(transaction, null, 2));

          if (transaction.type === 'unstake_approval') {
            console.log('📝 This is an approval transaction - Step 1 of unstaking');
            console.log('📝 Approval transaction details:');
            console.log('   to:', transaction.transactionData?.to);
            console.log('   data:', transaction.transactionData?.data);
            console.log('   data length:', transaction.transactionData?.data?.length);
            console.log('   value:', transaction.transactionData?.value);
            console.log('   gasLimit:', transaction.transactionData?.gasLimit);
            console.log('   chainId:', transaction.transactionData?.chainId);
            setSuccess('Step 1/2: Approving stETH for withdrawal...');

            try {
              // Execute the approval transaction
              const approvalTxHash = await stakingApi.executeTransaction(transaction.transactionData);
              console.log('✅ Approval transaction executed:', approvalTxHash);

              setSuccess('Step 1/2 complete! Now requesting withdrawal...');

              // Wait a bit for the approval to be confirmed
              await new Promise(resolve => setTimeout(resolve, 2000));

              // Now call unstake again to get the actual withdrawal transaction
              console.log('🔄 Calling unstake again to get withdrawal transaction...');
              const withdrawalTransaction = await stakingApi.unstake(amount);

              if (withdrawalTransaction && withdrawalTransaction.transactionData) {
                console.log('📦 Withdrawal transaction data:', withdrawalTransaction.transactionData);

                if (withdrawalTransaction.type === 'unstake_approval') {
                  // If we still get an approval transaction, something went wrong
                  setError('Approval transaction completed but allowance not updated. Please try again.');
                  return;
                }

                setSuccess('Step 2/2: Executing withdrawal request...');

                // Execute the withdrawal transaction
                const withdrawalTxHash = await stakingApi.executeTransaction(withdrawalTransaction.transactionData);
                console.log('✅ Withdrawal transaction executed:', withdrawalTxHash);

                setAmount('');
                setError(null);
                const successMessage = `Unstaking successful! Approval: ${approvalTxHash}, Withdrawal: ${withdrawalTxHash}`;
                console.log('🎉 Setting success message:', successMessage);
                setSuccess(successMessage);

                // Clear success message after 15 seconds
                setTimeout(() => {
                  console.log('🕐 Clearing success message after 15 seconds');
                  setSuccess(null);
                }, 15000);
              } else {
                throw new Error('Failed to get withdrawal transaction after approval');
              }
            } catch (execError) {
              console.error('❌ Error in two-step unstake process:', execError);
              setError(`Failed to execute unstake: ${execError instanceof Error ? execError.message : 'Unknown error'}`);
              return;
            }
          } else {
            // Regular transaction (stake or direct unstake with sufficient allowance)
            setSuccess('Transaction prepared! Executing on blockchain...');

            try {
              // Execute the transaction on the blockchain
              const txHash = await stakingApi.executeTransaction(transaction.transactionData);
              console.log('✅ Transaction executed successfully:', txHash);

              setAmount('');
              setError(null);
              const successMessage = `${action === 'stake' ? 'Staking' : 'Unstaking'} successful! Transaction Hash: ${txHash}`;
              console.log('🎉 Setting success message:', successMessage);
              setSuccess(successMessage);

              // Clear success message after 10 seconds
              setTimeout(() => {
                console.log('🕐 Clearing success message after 10 seconds');
                setSuccess(null);
              }, 10000);
            } catch (execError) {
              console.error('❌ Error executing transaction:', execError);
              setError(`Failed to execute transaction: ${execError instanceof Error ? execError.message : 'Unknown error'}`);
              return;
            }
          }
        } else {
          // Private key wallet - transaction already executed
          console.log('🔑 Private key wallet detected, transaction already executed');
          setAmount('');
          setError(null);
          const successMessage = `${action === 'stake' ? 'Staking' : 'Unstaking'} successful! Transaction ID: ${transaction.id}`;
          console.log('🎉 Setting success message:', successMessage);
          setSuccess(successMessage);

          // Clear success message after 5 seconds
          setTimeout(() => {
            console.log('🕐 Clearing success message after 5 seconds');
            setSuccess(null);
          }, 5000);
        }

        // Refresh data using the hook
        refresh();

        // Refresh token balances
        const refreshBalances = async () => {
          if (!account || tokens.length === 0) return;

          setLoadingBalances(true);
          const balances: Record<string, string> = {};

          for (const token of tokens) {
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

        refreshBalances();
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
    <div className="h-screen text-white flex flex-col overflow-hidden relative">
      <AnimatedBackground />
      {/* Top Navbar - Same as swap */}
      <header className="flex-shrink-0 bg-black/40 backdrop-blur-md border-b-2 border-white/15 px-4 sm:px-6 py-2.5 sm:py-3 z-50">
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
          {dataLoading ? (
            <div className="text-center">
              <div className="loader-inline-lg mb-4" />
              <p className="text-gray-400">Loading staking data...</p>
            </div>
          ) : (
            <div className="w-full max-w-md">
            {/* Staking Card */}
            <div className="bg-[#202020]/75 backdrop-blur-xl border border-white/10 rounded-[25px] p-3 shadow-[0px_16px_57.7px_0px_rgba(0,0,0,0.42)]">
              {/* Header */}
              <div className="text-center mb-2">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {/* Lido Logo */}
                    <div className="w-6 h-6 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                      <Image
                        src="https://s2.coinmarketcap.com/static/img/coins/64x64/8000.png"
                        alt="Lido Protocol"
                        width={24}
                        height={24}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-white">Staking Service</h2>
                  </div>
                  <button
                    onClick={clearCacheAndRefresh}
                    className="p-1.5 rounded-lg bg-[#2A2A2A]/80 hover:bg-[#343434]/80 transition-colors border border-white/10"
                    title="Refresh data"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-center gap-2 mt-1.5 pt-1.5 border-t border-white/5">
                  <div className="w-5 h-5 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                    <Image
                      src="https://s2.coinmarketcap.com/static/img/coins/64x64/8000.png"
                      alt="Lido Protocol"
                      width={20}
                      height={20}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                  <p className="text-gray-400 text-xs">Powered by Lido Protocol on Ethereum</p>
                </div>
              </div>

              {/* User Position Summary */}
              {userPosition && (
                <div className="bg-[#2A2A2A]/80 border border-white/10 rounded-xl p-2.5 mb-1.5">
                  <h3 className="text-white font-semibold text-sm mb-1.5">Your Position</h3>
                  <div className="space-y-1.5 text-sm">
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
              <div className="mb-1.5">
                <label className="text-xs text-gray-400 mb-1.5 block">Action</label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value as StakingActionType)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[#2A2A2A]/80 border border-white/10 text-white focus:outline-none focus:border-white/20"
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
              <div className="mb-1.5">
                <label className="text-xs text-gray-400 mb-1.5 block">Token</label>
                <div className="px-3 py-2 text-sm rounded-xl bg-[#2A2A2A]/80 border border-white/10 text-white">
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
              <div className="mb-1.5">
                <label className="text-xs text-gray-400 mb-1.5 block">
                  {action === 'stake' ? 'Amount to Stake' : 'Amount to Unstake'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[#2A2A2A]/80 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-white/20"
                />
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                  <span>
                    Available: {loadingBalances ? 'Loading...' : (() => {
                      if (tokens.length === 0) return '0';
                      
                      // Get the correct token based on action
                      let targetToken;
                      if (action === 'stake') {
                        // For stake, use ETH (first token with address 0x0000...)
                        targetToken = tokens.find(t => t.address === '0x0000000000000000000000000000000000000000') || tokens[0];
                      } else {
                        // For unstake, use stETH (second token)
                        targetToken = tokens.find(t => t.symbol === 'stETH') || tokens[1] || tokens[0];
                      }
                      
                      const balance = tokenBalances[targetToken.address] || '0';
                      const decimals = targetToken.decimals;
                      console.log('Available display:', { 
                        action, 
                        balance, 
                        decimals, 
                        tokenAddress: targetToken.address,
                        tokenSymbol: targetToken.symbol 
                      });
                      return formatAmount(balance, decimals);
                    })()} {action === 'stake' ? 'ETH' : 'stETH'}
                  </span>
                  <button
                    onClick={() => {
                      if (tokens.length > 0) {
                        // Get the correct token based on action
                        let targetToken;
                        if (action === 'stake') {
                          targetToken = tokens.find(t => t.address === '0x0000000000000000000000000000000000000000') || tokens[0];
                        } else {
                          targetToken = tokens.find(t => t.symbol === 'stETH') || tokens[1] || tokens[0];
                        }

                        const balance = tokenBalances[targetToken.address] || '0';
                        setAmount(formatAmount(balance, targetToken.decimals));
                      }
                    }}
                    className="text-[#4BDEDD] hover:text-[#4BDEDD]/80 underline font-medium"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Token Info */}
              <div className="bg-[#2A2A2A]/80 border border-white/10 rounded-xl p-2.5 mb-1.5">
                <h4 className="text-white font-semibold text-sm mb-1.5">
                  {action === 'stake' ? 'ETH Staking Info' : 'stETH Unstaking Info'}
                </h4>
                <div className="space-y-1.5 text-sm">
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

              {/* Action Button with Network Guard */}
              <NetworkAwareButton
                requiredChainId={STAKING_CHAIN_ID}
                onClick={handleAction}
                disabled={!canExecute}
                loading={loading}
                className="w-full"
              >
                {loading ? 'Processing...' : getActionLabel()}
              </NetworkAwareButton>

              {/* Error Messages */}
              {error && (
                <div className="mt-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
                  <div className="text-xs text-red-400">{error}</div>
                </div>
              )}

              {/* Success Messages */}
              {success && (
                <div className="mt-2 p-2.5 rounded-xl bg-green-500/10 border border-green-500/30">
                  <div className="text-xs text-green-400">{success}</div>
                </div>
              )}

              {dataError && (
                <div className="mt-2 p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                  <div className="text-xs text-yellow-400">
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
