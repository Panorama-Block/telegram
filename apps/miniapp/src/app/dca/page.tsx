'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { useActiveAccount } from 'thirdweb/react';
import {
  getUserAccounts,
  createStrategy,
  getAccountStrategies,
  toggleStrategy,
  deleteStrategy,
  getExecutionHistory,
  getSessionKeyBalance,
  type SmartAccount,
  type DCAStrategy,
  type ExecutionHistory,
  DCAApiError,
} from '@/features/dca/api';
import { Container } from '@/components/layout/Container';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import UniswapIcon from '../../../public/icons/uniswap.svg';
import { networks, type Token, type Network, isSwapPairSupported, CROSS_CHAIN_SUPPORTED_SYMBOLS, CROSS_CHAIN_SUPPORTED_CHAIN_IDS } from '@/features/swap/tokens';

interface CreateDCAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: DCAConfig) => void;
  loading: boolean;
  smartAccounts: SmartAccount[];
  chainId?: number;
}

interface DCAConfig {
  smartAccountId: string;
  fromToken: string;
  fromTokenSymbol: string;
  toToken: string;
  toTokenSymbol: string;
  fromChainId: number;
  toChainId: number;
  amount: string;
  interval: 'daily' | 'weekly' | 'monthly';
}

function CreateDCAModal({
  isOpen,
  onClose,
  onConfirm,
  loading,
  smartAccounts,
  chainId = 1,
}: CreateDCAModalProps) {
  const account = useActiveAccount();
  const defaultFromNetwork = networks.find(n => n.chainId === 1) || networks[0];
  const defaultFromToken = defaultFromNetwork.tokens[0];
  const defaultToToken = defaultFromNetwork.tokens.find(t => t.symbol === 'USDC') || defaultFromNetwork.tokens[1];

  const [config, setConfig] = useState<DCAConfig>({
    smartAccountId: '',
    fromToken: defaultFromToken.address,
    fromTokenSymbol: defaultFromToken.symbol,
    toToken: defaultToToken.address,
    toTokenSymbol: defaultToToken.symbol,
    fromChainId: defaultFromNetwork.chainId,
    toChainId: defaultFromNetwork.chainId,
    amount: '',
    interval: 'daily',
  });

  const [fromNetwork, setFromNetwork] = useState<Network>(defaultFromNetwork);
  const [toNetwork, setToNetwork] = useState<Network>(defaultFromNetwork);
  const [fromTokenObj, setFromTokenObj] = useState<Token>(defaultFromToken);
  const [toTokenObj, setToTokenObj] = useState<Token>(defaultToToken);

  const [showFromSelector, setShowFromSelector] = useState(false);
  const [showToSelector, setShowToSelector] = useState(false);

  // Cross-chain support validation
  const [pairSupport, setPairSupport] = useState<{ supported: boolean; reason?: string }>({ supported: true });

  // Check if the current pair is supported
  useEffect(() => {
    const result = isSwapPairSupported(
      fromTokenObj,
      config.fromChainId,
      toTokenObj,
      config.toChainId
    );
    setPairSupport(result);
  }, [fromTokenObj, toTokenObj, config.fromChainId, config.toChainId]);

  // Session Key Gas states
  const [sessionKeyBalance, setSessionKeyBalance] = useState<string | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [showGasWarning, setShowGasWarning] = useState(false);
  const [estimatedGasNeeded, setEstimatedGasNeeded] = useState<string>('0');
  const [customGasAmount, setCustomGasAmount] = useState<string>('');
  const [isDepositingGas, setIsDepositingGas] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState(false);
  const [depositTxHash, setDepositTxHash] = useState<string | null>(null);

  // Calculate estimated gas needed based on interval
  const calculateEstimatedGas = useCallback((interval: 'daily' | 'weekly' | 'monthly') => {
    // Gas per DCA trade (Account Abstraction UserOp on Ethereum)
    const gasPerTrade = 0.0002;

    // Estimate number of trades for 30 days
    let estimatedTrades = 0;
    switch (interval) {
      case 'daily':
        estimatedTrades = 30; // 30 trades in 30 days
        break;
      case 'weekly':
        estimatedTrades = 4; // ~4 trades in 30 days
        break;
      case 'monthly':
        estimatedTrades = 1; // 1 trade in 30 days
        break;
    }

    // Add 20% buffer
    const totalGas = estimatedTrades * gasPerTrade * 1.2;
    return totalGas.toFixed(6);
  }, []);

  // Check session key balance
  const checkSessionKeyBalance = useCallback(async (smartAccountAddress: string) => {
    if (!smartAccountAddress) return;

    setCheckingBalance(true);
    try {
      // Get smart account details to get session key address
      const smartAccount = smartAccounts.find(acc => acc.address === smartAccountAddress);
      if (!smartAccount?.sessionKeyAddress) {
        console.error('Session key address not found');
        return;
      }

      // Check balance on the selected chain
      const balance = await getSessionKeyBalance(smartAccount.sessionKeyAddress, config.fromChainId);
      setSessionKeyBalance(balance);

      console.log('Session Key Balance:', balance, 'ETH');
    } catch (error) {
      console.error('Error checking session key balance:', error);
      setSessionKeyBalance('0');
    } finally {
      setCheckingBalance(false);
    }
  }, [smartAccounts, config.fromChainId]);

  // Check balance when smart account or interval changes
  useEffect(() => {
    if (isOpen && config.smartAccountId) {
      void checkSessionKeyBalance(config.smartAccountId);
      const estimated = calculateEstimatedGas(config.interval);
      setEstimatedGasNeeded(estimated);
      setCustomGasAmount(estimated); // Set as default
      setDepositError(null); // Clear previous errors
      setDepositSuccess(false); // Reset success state
      setDepositTxHash(null);
    }
  }, [isOpen, config.smartAccountId, config.interval, checkSessionKeyBalance, calculateEstimatedGas]);

  useEffect(() => {
    if (!isOpen) {
      const resetFromNetwork = networks.find(n => n.chainId === 1) || networks[0];
      const resetFromToken = resetFromNetwork.tokens[0];
      const resetToToken = resetFromNetwork.tokens.find(t => t.symbol === 'USDC') || resetFromNetwork.tokens[1];

      setFromNetwork(resetFromNetwork);
      setToNetwork(resetFromNetwork);
      setFromTokenObj(resetFromToken);
      setToTokenObj(resetToToken);

      setConfig({
        smartAccountId: '',
        fromToken: resetFromToken.address,
        fromTokenSymbol: resetFromToken.symbol,
        toToken: resetToToken.address,
        toTokenSymbol: resetToToken.symbol,
        fromChainId: resetFromNetwork.chainId,
        toChainId: resetFromNetwork.chainId,
        amount: '',
        interval: 'daily',
      });
    } else if (smartAccounts.length > 0 && !config.smartAccountId) {
      setConfig(prev => ({ ...prev, smartAccountId: smartAccounts[0].address }));
    }
  }, [isOpen, smartAccounts, config.smartAccountId]);

  if (!isOpen) return null;

  const handleSubmit = (skipGasWarning = false) => {
    if (!config.smartAccountId || !config.amount || Number(config.amount) <= 0) {
      return;
    }

    // Show gas warning if balance is low (but allow user to proceed)
    if (!skipGasWarning && sessionKeyBalance !== null && parseFloat(sessionKeyBalance) < parseFloat(estimatedGasNeeded)) {
      setShowGasWarning(true);
      return;
    }

    // Calculate next execution time based on interval
    const intervalSeconds = {
      daily: 86400,      // 24 hours
      weekly: 604800,    // 7 days
      monthly: 2592000   // 30 days
    }[config.interval];

    const nextExecution = Date.now() + (intervalSeconds * 1000);

    // Data structure being sent to backend
    const dcaStrategyRequest = {
      smartAccountId: config.smartAccountId,
      fromToken: config.fromToken,
      toToken: config.toToken,
      fromChainId: config.fromChainId,
      toChainId: config.toChainId,
      amount: config.amount,
      interval: config.interval,
    };

    // Additional metadata for display purposes
    const dcaMetadata = {
      smartWallet: {
        address: config.smartAccountId,
        name: smartAccounts.find(acc => acc.address === config.smartAccountId)?.name || 'Unknown',
      },
      quoteParams: {
        fromTokenSymbol: config.fromTokenSymbol,
        fromChainName: fromNetwork.name,
        toTokenSymbol: config.toTokenSymbol,
        toChainName: toNetwork.name,
      },
      timing: {
        interval: config.interval,
        intervalDescription: config.interval === 'daily' ? 'Every 24 hours' : config.interval === 'weekly' ? 'Every 7 days' : 'Every 30 days',
        nextExecution,
        nextExecutionFormatted: new Date(nextExecution).toISOString(),
      },
      createdAt: Date.now(),
      createdAtFormatted: new Date().toISOString(),
    };

    console.log('\n=== DCA RECURRING BUY - REQUEST TO BACKEND ===');
    console.log('API Request Data:', JSON.stringify(dcaStrategyRequest, null, 2));
    console.log('\n=== ADDITIONAL METADATA ===');
    console.log('Smart Wallet:', dcaMetadata.smartWallet);
    console.log('Quote Details:', dcaMetadata.quoteParams);
    console.log('Timing:', dcaMetadata.timing);
    console.log('Created At:', dcaMetadata.createdAtFormatted);
    console.log('==============================================\n');

    onConfirm(config);
  };

  // Deposit gas to session key
  const handleDepositGas = async () => {
    if (!account || !config.smartAccountId) {
      return;
    }

    // Validate custom amount
    if (!customGasAmount || parseFloat(customGasAmount) <= 0) {
      setDepositError('Please enter a valid amount');
      return;
    }

    const smartAccount = smartAccounts.find(acc => acc.address === config.smartAccountId);
    if (!smartAccount?.sessionKeyAddress) {
      setDepositError('Session key address not found');
      return;
    }

    setIsDepositingGas(true);
    setDepositError(null);

    try {
      const { createThirdwebClient, prepareTransaction, sendTransaction, toWei, defineChain } = await import('thirdweb');
      const { THIRDWEB_CLIENT_ID } = await import('@/shared/config/thirdweb');

      const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID || '' });

      // Transfer ETH from user's wallet to session key (use custom amount)
      const transaction = prepareTransaction({
        to: smartAccount.sessionKeyAddress as `0x${string}`,
        value: toWei(customGasAmount),
        chain: defineChain(config.fromChainId),
        client,
      });

      const result = await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Gas deposited to session key!');
      console.log('Transaction Hash:', result.transactionHash);

      // Set success state
      setDepositSuccess(true);
      setDepositTxHash(result.transactionHash);
      setDepositError(null);

      // Refresh balance
      await checkSessionKeyBalance(config.smartAccountId);
    } catch (error: any) {
      console.error('❌ Error depositing gas:', error);

      // Parse error for better user feedback
      let errorMessage = 'Failed to deposit gas. Please try again.';

      if (error.message || error.code) {
        const errMsg = error.message?.toLowerCase() || '';
        const errCode = error.code;

        if (errCode === -32603 || errMsg.includes('invalid nonce') || errMsg.includes('nonce')) {
          errorMessage = 'Transaction nonce conflict detected. Please wait a moment and try again, or reset your MetaMask account (Settings > Advanced > Clear activity tab data).';
        } else if (errCode === 4001 || errMsg.includes('user rejected') || errMsg.includes('user denied')) {
          errorMessage = 'Transaction was rejected. Please try again when ready.';
        } else if (errMsg.includes('insufficient funds')) {
          errorMessage = `Insufficient ETH in your wallet. You need at least ${customGasAmount} ETH plus gas fees.`;
        } else if (errMsg.includes('gas')) {
          errorMessage = 'Gas estimation failed. Try lowering the amount or wait for network congestion to clear.';
        } else if (error.message) {
          errorMessage = error.message;
        }
      }

      setDepositError(errorMessage);
    } finally {
      setIsDepositingGas(false);
    }
  };

  // Continue to create strategy after gas deposit
  const handleContinueAfterDeposit = () => {
    setShowGasWarning(false);
    setDepositSuccess(false);
    setDepositTxHash(null);
    setDepositError(null);
    // Call handleSubmit with skipGasWarning to proceed directly
    handleSubmit(true);
  };

  // Create strategy anyway with low gas (user's choice)
  const handleCreateAnyway = () => {
    setShowGasWarning(false);
    setDepositError(null);
    // Call handleSubmit with skipGasWarning to bypass gas check
    handleSubmit(true);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center pt-4 md:pt-0 p-4 pb-20 md:pb-4 overflow-y-auto">
        <div className="w-full max-w-md bg-[#202020]/85 backdrop-blur-xl rounded-2xl p-5 shadow-[0px_16px_57.7px_0px_rgba(0,0,0,0.42)] border border-white/10 max-h-[70vh] md:max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Create Recurring Buy</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            {/* Smart Wallet Selection */}
            <div className="bg-[#2A2A2A]/80 rounded-xl p-3 border border-white/10">
              <label className="text-xs text-gray-400 mb-2 block">Smart Wallet</label>
              <select
                value={config.smartAccountId}
                onChange={(e) => setConfig({ ...config, smartAccountId: e.target.value })}
                disabled={loading}
                className="w-full bg-transparent text-sm text-white outline-none"
              >
                {smartAccounts.map((account) => (
                  <option key={account.address} value={account.address} className="bg-[#2A2A2A]">
                    {account.name} ({account.address.slice(0, 6)}...{account.address.slice(-4)})
                  </option>
                ))}
              </select>
            </div>

            {/* Sell Section */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Sell</label>
              <div className="bg-[#2A2A2A]/80 rounded-xl p-3 border border-white/10">
                <input
                  type="text"
                  value={config.amount}
                  onChange={(e) => setConfig({ ...config, amount: e.target.value })}
                  placeholder="0"
                  className="bg-transparent text-3xl font-light text-white outline-none w-full mb-2"
                  disabled={loading}
                />
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => setShowFromSelector(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-black hover:bg-gray-200 transition-colors text-sm"
                    type="button"
                  >
                    <Image
                      src={fromTokenObj.icon || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'}
                      alt={fromTokenObj.symbol}
                      width={20}
                      height={20}
                      className="w-5 h-5 rounded-full"
                      unoptimized
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                      }}
                    />
                    <span className="font-medium">{fromTokenObj.symbol}</span>
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
                type="button"
                className="bg-[#2A2A2A]/80 border border-white/10 rounded-lg p-1.5 hover:bg-[#343434]/80 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>

            {/* Buy Section */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Buy</label>
              <div className="bg-[#2A2A2A]/80 rounded-xl p-3 border border-white/10">
                <div className="text-2xl font-light text-gray-500 mb-2">Auto</div>
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => setShowToSelector(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-black hover:bg-gray-200 transition-colors text-sm"
                    type="button"
                  >
                    <Image
                      src={toTokenObj.icon || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'}
                      alt={toTokenObj.symbol}
                      width={20}
                      height={20}
                      className="w-5 h-5 rounded-full"
                      unoptimized
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                      }}
                    />
                    <span className="font-medium">{toTokenObj.symbol}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Interval Selection */}
            <div className="bg-[#2A2A2A]/80 rounded-xl p-3 border border-white/10">
              <label className="text-xs text-gray-400 mb-2 block">Purchase Interval</label>
              <select
                value={config.interval}
                onChange={(e) => setConfig({ ...config, interval: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                disabled={loading}
                className="w-full bg-transparent text-sm text-white outline-none"
              >
                <option value="daily" className="bg-[#2A2A2A]">Daily (Every 24 hours)</option>
                <option value="weekly" className="bg-[#2A2A2A]">Weekly (Every 7 days)</option>
                <option value="monthly" className="bg-[#2A2A2A]">Monthly (Every 30 days)</option>
              </select>
            </div>

            {/* Session Key Balance Info */}
            {config.smartAccountId && (
              <div className="bg-[#2A2A2A]/80 rounded-xl p-3 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Session Key Gas</span>
                  {checkingBalance ? (
                    <span className="text-xs text-gray-400">Checking...</span>
                  ) : (
                    <span className={`text-xs font-semibold ${
                      sessionKeyBalance && parseFloat(sessionKeyBalance) < parseFloat(estimatedGasNeeded)
                        ? 'text-orange-400'
                        : 'text-green-400'
                    }`}>
                      {sessionKeyBalance || '0'} ETH
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Recommended</span>
                  <span className="text-xs font-semibold text-white">
                    {estimatedGasNeeded} ETH
                  </span>
                </div>
                {sessionKeyBalance && parseFloat(sessionKeyBalance) < parseFloat(estimatedGasNeeded) && (
                  <p className="mt-2 text-[10px] text-orange-400">
                    ⚠️ Low gas balance. You can deposit now or create anyway and deposit later.
                  </p>
                )}
              </div>
            )}

            {/* Cross-chain not supported warning */}
            {!pairSupport.supported && (
              <div className="bg-orange-500/10 border border-orange-500/40 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-orange-400 flex-shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-orange-400 mb-1">Pair Not Supported</p>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{pairSupport.reason}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Create Button */}
            <button
              onClick={() => handleSubmit(false)}
              disabled={!config.smartAccountId || !config.amount || Number(config.amount) <= 0 || loading || !pairSupport.supported}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:cursor-not-allowed ${
                !pairSupport.supported
                  ? 'bg-gray-600 text-gray-400 opacity-50'
                  : 'bg-white text-black hover:bg-gray-100 disabled:opacity-50'
              }`}
            >
              {loading ? 'Creating...' : !pairSupport.supported ? 'Pair Not Supported' : 'Create Recurring Buy'}
            </button>

            {/* Description */}
            <div className="mt-2 text-center">
              <p className="text-xs text-gray-400 leading-relaxed">
                Automate your crypto purchases with Dollar Cost Averaging
              </p>
            </div>

            {/* Powered by Uniswap */}
            <div className="mt-1 flex items-center justify-center gap-2 text-xs text-gray-400">
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
          </div>
        </div>
      </div>

      {/* Gas Warning Modal */}
      {showGasWarning && (
        <>
          <div
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            onClick={() => setShowGasWarning(false)}
          />
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#202020]/85 backdrop-blur-xl rounded-[25px] p-5 shadow-[0px_16px_57.7px_0px_rgba(0,0,0,0.42)] border border-white/10">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-orange-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-white">Low Gas Balance</h2>
                </div>
                <button
                  onClick={() => setShowGasWarning(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                {depositSuccess ? (
                  <>
                    {/* Success State */}
                    <div className="flex flex-col items-center text-center py-4">
                      <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mb-4">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-green-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Gas Deposited Successfully!</h3>
                      <p className="text-sm text-gray-400 mb-4">
                        Your session key now has enough gas to execute recurring buys.
                      </p>
                    </div>

                    {/* Updated Balance */}
                    <div className="bg-[#2A2A2A]/80 rounded-xl p-3 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Session Key Balance</span>
                        <span className="text-xs font-semibold text-green-400">
                          {sessionKeyBalance || '0.000000'} ETH
                        </span>
                      </div>
                      {depositTxHash && (
                        <div className="pt-2 border-t border-white/10">
                          <a
                            href={`https://etherscan.io/tx/${depositTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                          >
                            View transaction
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        onClick={handleContinueAfterDeposit}
                        className="w-full py-3 rounded-xl font-semibold text-sm transition-all bg-white text-black hover:bg-gray-100"
                      >
                        Continue to Create Strategy
                      </button>
                      <button
                        onClick={() => {
                          setShowGasWarning(false);
                          setDepositSuccess(false);
                          setDepositTxHash(null);
                        }}
                        className="w-full py-3 rounded-xl font-semibold text-sm transition-all bg-transparent text-gray-400 hover:text-white border border-white/10 hover:border-white/20"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Deposit Form */}
                    <p className="text-sm text-gray-400">
                      Your session key has low gas. We recommend depositing more ETH for smooth execution.
                    </p>

                    {/* Balance Info */}
                    <div className="bg-[#2A2A2A]/80 rounded-xl p-3 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Current Balance</span>
                        <span className="text-xs font-semibold text-orange-400">
                          {sessionKeyBalance || '0.000000'} ETH
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Recommended Amount</span>
                        <span className="text-xs font-semibold text-white">
                          {estimatedGasNeeded} ETH
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <span className="text-xs font-medium text-gray-300">Suggested Deposit</span>
                        <span className="text-sm font-bold text-green-400">
                          {(parseFloat(estimatedGasNeeded) - parseFloat(sessionKeyBalance || '0')).toFixed(6)} ETH
                        </span>
                      </div>
                    </div>

                    {/* Deposit Amount Input */}
                    <div>
                      <label className="text-xs text-gray-400 mb-2 block">Amount to Deposit</label>
                      <div className="bg-[#2A2A2A]/80 rounded-xl p-3 border border-white/10">
                        <input
                          type="text"
                          value={customGasAmount}
                          onChange={(e) => setCustomGasAmount(e.target.value)}
                          placeholder="0"
                          className="bg-transparent text-3xl font-light text-white outline-none w-full mb-2"
                          disabled={isDepositingGas}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">ETH</span>
                          <button
                            onClick={() => setCustomGasAmount(estimatedGasNeeded)}
                            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                            type="button"
                          >
                            Use Recommended
                          </button>
                        </div>
                      </div>

                      {/* Quick presets */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['0.001', '0.005', '0.01'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setCustomGasAmount(preset)}
                            disabled={isDepositingGas}
                            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                          >
                            {preset} ETH
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Info Box */}
                    <div className="bg-[#2A2A2A]/80 rounded-xl p-3 border border-white/10">
                      <p className="text-xs font-medium text-cyan-400 mb-2">Why does my session key need gas?</p>
                      <ul className="space-y-1 text-[11px] text-gray-400">
                        <li>• The session key signs and pays for DCA transactions automatically</li>
                        <li>• Estimated for {config.interval} purchases over 30 days</li>
                        <li>• Includes 20% safety buffer for gas price fluctuations</li>
                      </ul>
                    </div>

                    {/* Error Message */}
                    {depositError && (
                      <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-3">
                        <div className="flex items-start gap-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-red-400 flex-shrink-0 mt-0.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-xs text-red-400 leading-relaxed">{depositError}</p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="space-y-2 pt-2">
                      <button
                        onClick={handleDepositGas}
                        disabled={isDepositingGas || !customGasAmount || parseFloat(customGasAmount) <= 0}
                        className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white text-black hover:bg-gray-100"
                      >
                        {isDepositingGas ? 'Depositing...' : `Deposit ${customGasAmount || '0'} ETH`}
                      </button>

                      <div className="flex gap-2">
                        <button
                          onClick={handleCreateAnyway}
                          disabled={isDepositingGas}
                          className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-transparent text-white hover:bg-white/10 border border-white/20 hover:border-white/30"
                        >
                          Create Anyway
                        </button>
                        <button
                          onClick={() => {
                            setShowGasWarning(false);
                            setDepositError(null);
                          }}
                          disabled={isDepositingGas}
                          className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-transparent text-gray-400 hover:text-white border border-white/10 hover:border-white/20"
                        >
                          Cancel
                        </button>
                      </div>

                      <p className="text-[10px] text-center text-gray-500 pt-1">
                        You can create the strategy now and deposit gas later
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Token Selector Modal - From */}
      {showFromSelector && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm"
            onClick={() => setShowFromSelector(false)}
          />
          <div className="fixed inset-0 z-[70] flex items-start md:items-center justify-center pt-4 md:pt-0 p-4 pb-20 md:pb-4 overflow-y-auto">
            <div className="w-full max-w-md bg-[#1A1A1A] rounded-2xl border border-white/10 shadow-2xl max-h-[65vh] md:max-h-[75vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Select a token</h3>
                <button
                  onClick={() => setShowFromSelector(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 border-b border-white/10">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {networks.map((network) => {
                    const isChainCrossChainSupported = CROSS_CHAIN_SUPPORTED_CHAIN_IDS.includes(network.chainId);
                    return (
                      <button
                        key={network.chainId}
                        onClick={() => {
                          setFromNetwork(network);
                          setFromTokenObj(network.tokens[0]);
                          setConfig({
                            ...config,
                            fromChainId: network.chainId,
                            fromToken: network.tokens[0].address,
                            fromTokenSymbol: network.tokens[0].symbol,
                          });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          fromNetwork.chainId === network.chainId
                            ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30'
                            : !isChainCrossChainSupported
                              ? 'bg-[#2A2A2A] text-gray-500 hover:text-gray-400 opacity-70'
                              : 'bg-[#2A2A2A] text-gray-400 hover:text-white'
                        }`}
                        title={!isChainCrossChainSupported ? 'Cross-chain swaps not supported from this network' : undefined}
                      >
                        {network.name}
                        {!isChainCrossChainSupported && ' ⚠️'}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  {fromNetwork.tokens.map((token) => {
                    const isCrossChainSupported = CROSS_CHAIN_SUPPORTED_SYMBOLS.includes(token.symbol);
                    return (
                      <button
                        key={token.address}
                        onClick={() => {
                          setFromTokenObj(token);
                          setConfig({
                            ...config,
                            fromToken: token.address,
                            fromTokenSymbol: token.symbol,
                          });
                          setShowFromSelector(false);
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#2A2A2A] transition-colors ${
                          !isCrossChainSupported ? 'opacity-60' : ''
                        }`}
                      >
                        <Image
                          src={token.icon || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'}
                          alt={token.symbol}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full"
                          unoptimized
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                          }}
                        />
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{token.symbol}</span>
                            {!isCrossChainSupported && (
                              <span className="px-1.5 py-0.5 text-[9px] font-medium bg-gray-600/50 text-gray-400 rounded">
                                Same-chain only
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">{fromNetwork.name}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Token Selector Modal - To */}
      {showToSelector && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm"
            onClick={() => setShowToSelector(false)}
          />
          <div className="fixed inset-0 z-[70] flex items-start md:items-center justify-center pt-4 md:pt-0 p-4 pb-20 md:pb-4 overflow-y-auto">
            <div className="w-full max-w-md bg-[#1A1A1A] rounded-2xl border border-white/10 shadow-2xl max-h-[65vh] md:max-h-[75vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Select a token</h3>
                <button
                  onClick={() => setShowToSelector(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 border-b border-white/10">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {networks.map((network) => (
                    <button
                      key={network.chainId}
                      onClick={() => {
                        setToNetwork(network);
                        setToTokenObj(network.tokens[0]);
                        setConfig({
                          ...config,
                          toChainId: network.chainId,
                          toToken: network.tokens[0].address,
                          toTokenSymbol: network.tokens[0].symbol,
                        });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                        toNetwork.chainId === network.chainId
                          ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30'
                          : 'bg-[#2A2A2A] text-gray-400 hover:text-white'
                      }`}
                    >
                      {network.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  {toNetwork.tokens.map((token) => (
                    <button
                      key={token.address}
                      onClick={() => {
                        setToTokenObj(token);
                        setConfig({
                          ...config,
                          toToken: token.address,
                          toTokenSymbol: token.symbol,
                        });
                        setShowToSelector(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#2A2A2A] transition-colors"
                    >
                      <Image
                        src={token.icon || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'}
                        alt={token.symbol}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full"
                        unoptimized
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                        }}
                      />
                      <div className="flex-1 text-left">
                        <div className="text-white font-medium">{token.symbol}</div>
                        <div className="text-xs text-gray-400">{toNetwork.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function DCAPage() {
  const account = useActiveAccount();
  const router = useRouter();

  const [exploreDropdownOpen, setExploreDropdownOpen] = useState(false);
  const [smartAccounts, setSmartAccounts] = useState<SmartAccount[]>([]);
  const [strategies, setStrategies] = useState<DCAStrategy[]>([]);
  const [history, setHistory] = useState<ExecutionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadSmartAccounts = useCallback(async () => {
    if (!account?.address) {
      setSmartAccounts([]);
      setInitializing(false);
      return;
    }

    setInitializing(true);
    try {
      const accounts = await getUserAccounts(account.address);
      setSmartAccounts(accounts);

      // Load strategies for all accounts
      if (accounts.length > 0) {
        const allStrategies: DCAStrategy[] = [];
        for (const acc of accounts) {
          const accountStrategies = await getAccountStrategies(acc.address, account.address);
          allStrategies.push(...accountStrategies);
        }
        setStrategies(allStrategies);

        // Load history for first account
        if (accounts[0]) {
          const execHistory = await getExecutionHistory(accounts[0].address, 10, account.address);
          setHistory(execHistory);
        }
      }
    } catch (err) {
      console.error('[DCAPage] Failed to load data:', err);
      setError(
        err instanceof DCAApiError
          ? err.message
          : 'Failed to load your data.',
      );
    } finally {
      setInitializing(false);
    }
  }, [account?.address]);

  useEffect(() => {
    void loadSmartAccounts();
  }, [loadSmartAccounts]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 6000);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timer);
  }, [error]);

  const handleCreateStrategy = async (config: DCAConfig) => {
    if (!account) {
      setError('Wallet not connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createStrategy({
        smartAccountId: config.smartAccountId,
        fromToken: config.fromToken,
        toToken: config.toToken,
        fromChainId: config.fromChainId,
        toChainId: config.toChainId,
        amount: config.amount,
        interval: config.interval,
      }, account.address);

      setSuccess('Recurring buy created successfully!');
      setShowCreateModal(false);
      await loadSmartAccounts();
    } catch (err) {
      console.error('[DCAPage] Error creating strategy:', err);
      if (err instanceof DCAApiError) {
        setError(err.message);
      } else {
        setError('Failed to create recurring buy. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStrategy = async (strategyId: string, currentStatus: boolean) => {
    if (!account) {
      setError('Wallet not connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await toggleStrategy(strategyId, !currentStatus, account.address);
      setSuccess(`Strategy ${!currentStatus ? 'activated' : 'paused'} successfully!`);
      await loadSmartAccounts();
    } catch (err) {
      console.error('[DCAPage] Error toggling strategy:', err);
      setError('Failed to update strategy status.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStrategy = async (strategyId: string) => {
    if (!account) {
      setError('Wallet not connected');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this recurring buy?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await deleteStrategy(strategyId, account.address);
      setSuccess('Recurring buy deleted successfully!');
      await loadSmartAccounts();
    } catch (err) {
      console.error('[DCAPage] Error deleting strategy:', err);
      setError('Failed to delete recurring buy.');
    } finally {
      setLoading(false);
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

  const hasSmartWallets = smartAccounts.length > 0;
  const activeStrategies = useMemo(
    () => strategies.filter(s => s.isActive),
    [strategies]
  );

  return (
    <>
      <div className="h-screen text-white flex flex-col overflow-hidden relative">
        {/* Animated Background */}
        <AnimatedBackground />

        {/* Top Navbar */}
        <header className="flex-shrink-0 bg-black/40 backdrop-blur-md border-b-2 border-white/15 px-4 md:px-6 py-3 z-50">
          <div className="flex items-center justify-between max-w-[1920px] mx-auto">
            {/* Left: Logo */}
            <div className="flex items-center gap-2">
              <Image src={zicoBlue} alt="Panorama Block" width={28} height={28} />
              <span className="text-white font-semibold text-sm tracking-wide hidden md:inline">PANORAMA BLOCK</span>
            </div>

            {/* Right: Explore + Docs + Notifications + Wallet Address */}
            <div className="flex items-center gap-2 md:gap-3">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setExploreDropdownOpen(!exploreDropdownOpen)}
                className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-400" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {/* Navigation Menu */}
              <nav className="hidden sm:flex items-center gap-3 md:gap-6 text-sm mr-3">
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
                          <button
                            onClick={() => {
                              setExploreDropdownOpen(false);
                              router.push('/chat?open=lending');
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
                              router.push('/chat?open=staking');
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
                            className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full text-left bg-gray-800/50"
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
              {(account?.address || getWalletAddress()) && (
                <div className="flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/30">
                  <div className="w-2 h-2 rounded-full bg-[#00FFC3]"></div>
                  <span className="hidden sm:inline text-white text-xs font-mono">
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

        {/* Main Content - Mobile: top aligned, Desktop: centered */}
        <div className="flex-1 overflow-y-auto flex items-start justify-center py-4 md:py-6">
          <Container size="xl" className="px-4 md:px-6 space-y-4 md:space-y-6 md:my-auto">
            {/* Hero Section */}
            <div className="text-center space-y-2 md:space-y-3 mb-6 md:mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full bg-cyan-400/20 border border-cyan-400/30 mb-3 md:mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
                Recurring Buys
              </h1>
              <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
                Automate your crypto purchases with Dollar Cost Averaging on Ethereum
              </p>
            </div>

            {/* No Smart Wallet State */}
            {!initializing && !hasSmartWallets && (
              <Card className="border border-orange-500/40 bg-orange-500/10 backdrop-blur-sm">
                <CardContent className="flex flex-col items-center text-center py-8 md:py-12 px-4 md:px-6">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-orange-500/20 flex items-center justify-center mb-4 md:mb-6">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-orange-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">
                    Smart Wallet Required
                  </h3>
                  <p className="text-gray-300 mb-6 max-w-md">
                    To use recurring buys, you need to create a Smart Wallet first. Smart Wallets enable secure automated transactions.
                  </p>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => router.push('/account')}
                    className="bg-cyan-400 hover:bg-cyan-500 text-black"
                  >
                    Create Smart Wallet
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Has Smart Wallets */}
            {hasSmartWallets && (
              <>
                {/* Stats Overview */}
                <Card className="bg-[#1A1A1A]/95 backdrop-blur-xl border border-white/10 shadow-2xl">
                  <CardHeader className="border-b border-white/5 pb-6">
                    <CardTitle className="text-lg md:text-xl text-white flex items-center gap-2">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="bg-[#252525]/50 border border-white/10 rounded-xl p-4 hover:border-cyan-400/30 transition-all">
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Total Strategies</p>
                        <p className="text-2xl font-bold text-white mb-1">
                          {initializing ? '—' : strategies.length}
                        </p>
                        <p className="text-xs text-gray-400">
                          {activeStrategies.length} active now
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-green-500/10 to-cyan-500/10 border border-green-500/30 rounded-xl p-4 hover:border-green-400/50 transition-all">
                        <p className="text-xs font-medium uppercase tracking-wider text-green-400 mb-2">Active Buys</p>
                        <p className="text-2xl font-bold text-white mb-1">
                          {initializing ? '—' : activeStrategies.length}
                        </p>
                        <p className="text-xs text-gray-400">Running automatically</p>
                      </div>
                      <div className="bg-[#252525]/50 border border-white/10 rounded-xl p-4 hover:border-cyan-400/30 transition-all">
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Executions</p>
                        <p className="text-2xl font-bold text-white mb-1">
                          {initializing ? '—' : history.length}
                        </p>
                        <p className="text-xs text-gray-400">Total purchases</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {error && (
                  <Card className="border border-red-500/40 bg-red-500/10 backdrop-blur-sm">
                    <CardContent className="flex items-start gap-3 text-sm p-4">
                      <span className="text-2xl">⚠️</span>
                      <div>
                        <p className="font-semibold text-red-400 mb-1">Something went wrong</p>
                        <p className="text-gray-300">{error}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {success && (
                  <Card className="border border-green-500/40 bg-green-500/10 backdrop-blur-sm">
                    <CardContent className="flex items-start gap-3 text-sm p-4">
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="font-semibold text-green-400 mb-1">Success!</p>
                        <p className="text-gray-300">{success}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Active Strategies */}
                <Card className="border border-white/10 bg-[#1A1A1A]/95 backdrop-blur-xl shadow-2xl">
                  <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-6">
                    <div>
                      <CardTitle className="text-lg md:text-xl text-white flex items-center gap-2">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Your Recurring Buys
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Manage your automated purchase strategies
                      </CardDescription>
                    </div>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setShowCreateModal(true)}
                      className="bg-cyan-400 hover:bg-cyan-500 text-black font-semibold"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mr-2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      New Recurring Buy
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {initializing ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {Array.from({ length: 2 }).map((_, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-white/10 bg-[#252525]/50 p-4 animate-pulse space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="h-5 w-32 rounded bg-white/10" />
                              <div className="h-6 w-16 rounded-full bg-white/10" />
                            </div>
                            <div className="h-4 w-full rounded bg-white/5" />
                            <div className="space-y-2">
                              <div className="h-8 w-full rounded bg-black/20" />
                              <div className="h-8 w-full rounded bg-black/20" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : strategies.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-400/10 border border-cyan-400/30 mb-4">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-gray-400 text-sm mb-4">
                          No recurring buys yet. Create your first one!
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCreateModal(true)}
                          className="text-cyan-400 border-cyan-400/30 hover:bg-cyan-400/10"
                        >
                          Create Recurring Buy
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {strategies.map((strategy, index) => {
                          const smartAccount = smartAccounts.find(acc => acc.address === strategy.smartAccountId);
                          const nextExecution = new Date(strategy.nextExecution * 1000);
                          const formattedNext = nextExecution.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          });

                          // Create unique key from strategy properties
                          const uniqueKey = strategy.strategyId || `${strategy.smartAccountId}-${strategy.nextExecution}-${index}`;

                          return (
                            <Card
                              key={uniqueKey}
                              variant="interactive"
                              size="sm"
                              className="h-full bg-[#252525]/70 backdrop-blur-sm border border-white/10 hover:border-cyan-400/40 transition-all group"
                            >
                              <CardHeader className="space-y-3 pb-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <CardTitle className="text-base text-white font-semibold group-hover:text-cyan-400 transition-colors">
                                      {smartAccount?.name || 'Smart Wallet'}
                                    </CardTitle>
                                    <CardDescription className="text-[11px] text-gray-500 mt-1">
                                      {(() => {
                                        const fromNetwork = networks.find(n => n.chainId === strategy.fromChainId);
                                        const toNetwork = networks.find(n => n.chainId === strategy.toChainId);
                                        const fromToken = fromNetwork?.tokens.find(t => t.address.toLowerCase() === strategy.fromToken.toLowerCase());
                                        const toToken = toNetwork?.tokens.find(t => t.address.toLowerCase() === strategy.toToken.toLowerCase());
                                        return `${fromToken?.symbol || 'Token'} → ${toToken?.symbol || 'Token'} • ${strategy.amount} ${fromToken?.symbol || ''}`;
                                      })()}
                                    </CardDescription>
                                  </div>
                                  <span
                                    className={cn(
                                      'inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider flex-shrink-0',
                                      strategy.isActive
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/50',
                                    )}
                                  >
                                    {strategy.isActive ? 'Active' : 'Paused'}
                                  </span>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3 text-sm">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between py-1.5 px-2 rounded bg-black/20">
                                    <span className="text-xs text-gray-400">Next Purchase</span>
                                    <span className="font-semibold text-white text-xs">
                                      {formattedNext}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between py-1.5 px-2 rounded bg-black/20">
                                    <span className="text-xs text-gray-400">Network{strategy.fromChainId !== strategy.toChainId ? 's' : ''}</span>
                                    <span className="font-semibold text-white text-xs">
                                      {(() => {
                                        const fromNetwork = networks.find(n => n.chainId === strategy.fromChainId);
                                        const toNetwork = networks.find(n => n.chainId === strategy.toChainId);
                                        if (strategy.fromChainId === strategy.toChainId) {
                                          return fromNetwork?.name || 'Unknown';
                                        }
                                        return `${fromNetwork?.name || 'Unknown'} → ${toNetwork?.name || 'Unknown'}`;
                                      })()}
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                              <CardFooter className="flex flex-col gap-2 pt-4 border-t border-white/5">
                                <div className="flex gap-2 w-full">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="flex-1 bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-400 border-cyan-400/30"
                                    onClick={() => handleToggleStrategy(strategy.strategyId || uniqueKey, strategy.isActive)}
                                    disabled={loading}
                                  >
                                    {strategy.isActive ? 'Pause' : 'Resume'}
                                  </Button>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"
                                    onClick={() => handleDeleteStrategy(strategy.strategyId || uniqueKey)}
                                    disabled={loading}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </CardFooter>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Execution History */}
                {history.length > 0 && (
                  <Card className="border border-white/10 bg-[#1A1A1A]/95 backdrop-blur-xl shadow-2xl">
                    <CardHeader className="border-b border-white/5 pb-6">
                      <CardTitle className="text-lg text-white flex items-center gap-2">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Recent Purchases
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        {history.map((exec, idx) => {
                          const date = new Date(exec.timestamp * 1000);
                          const formattedDate = date.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          });

                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 rounded-lg bg-[#252525]/50 border border-white/10 hover:border-white/20 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                                  exec.status === 'success'
                                    ? "bg-green-500/20 border border-green-500/50"
                                    : "bg-red-500/20 border border-red-500/50"
                                )}>
                                  {exec.status === 'success' ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-green-400">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-red-400">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-white">
                                    {exec.amount} ETH
                                  </p>
                                  <p className="text-xs text-gray-400">{formattedDate}</p>
                                </div>
                              </div>
                              <a
                                href={`https://etherscan.io/tx/${exec.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 transition-colors text-xs font-mono"
                              >
                                View →
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </Container>
        </div>
      </div>

      <CreateDCAModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={handleCreateStrategy}
        loading={loading}
        smartAccounts={smartAccounts}
        chainId={1}
      />
    </>
  );
}
