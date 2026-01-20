/**
 * Modal to deposit funds into the Smart Account
 * Styled with glass morphism to match Portfolio page
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActiveAccount, useActiveWalletChain } from 'thirdweb/react';
import { sendTransaction, prepareTransaction, toWei, defineChain } from 'thirdweb';
import { createThirdwebClient, type Address } from 'thirdweb';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { networks } from '@/features/swap/tokens';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  X,
  Wallet,
  ArrowDownToLine,
  ExternalLink,
  Loader2,
  Check,
  AlertCircle,
  ChevronDown,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSmartAccount } from './api';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  smartAccountAddress: string;
  smartAccountName: string;
}

function getExplorerUrl(chainId: number, txHash: string): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io/tx/',
    56: 'https://bscscan.com/tx/',
    137: 'https://polygonscan.com/tx/',
    43114: 'https://snowtrace.io/tx/',
    42161: 'https://arbiscan.io/tx/',
    8453: 'https://basescan.org/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
  };
  return `${explorers[chainId] || 'https://etherscan.io/tx/'}${txHash}`;
}

function getAddressExplorerUrl(chainId: number, address: string): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io/address/',
    56: 'https://bscscan.com/address/',
    137: 'https://polygonscan.com/address/',
    43114: 'https://snowtrace.io/address/',
    42161: 'https://arbiscan.io/address/',
    8453: 'https://basescan.org/address/',
    10: 'https://optimistic.etherscan.io/address/',
  };
  return `${explorers[chainId] || 'https://etherscan.io/address/'}${address}`;
}

export default function DepositModal({
  isOpen,
  onClose,
  smartAccountAddress,
  smartAccountName,
}: DepositModalProps) {
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();
  const [chainId, setChainId] = useState<number>(8453);
  const [amount, setAmount] = useState('0.01');
  const [isDepositing, setIsDepositing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sessionKeyAddress, setSessionKeyAddress] = useState<string>('');
  const [isLoadingSessionKey, setIsLoadingSessionKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);

  const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID || '' });

  useEffect(() => {
    if (activeChain?.id != null) {
      setWalletChainId(activeChain.id);
    }
  }, [activeChain]);

  const currentNetwork = useMemo(() => {
    return networks.find((n) => n.chainId === chainId);
  }, [chainId]);

  const nativeToken = useMemo(() => {
    return currentNetwork?.nativeCurrency || {
      symbol: 'ETH',
      address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      icon: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
      decimals: 18,
      name: 'Ethereum'
    };
  }, [currentNetwork]);

  // Fetch session key address using authenticated API
  useEffect(() => {
    const fetchSessionKey = async () => {
      if (!smartAccountAddress || !isOpen || !account?.address) return;

      setIsLoadingSessionKey(true);
      try {
        const accountData = await getSmartAccount(smartAccountAddress, account.address);
        if (accountData?.sessionKeyAddress) {
          setSessionKeyAddress(accountData.sessionKeyAddress);
        }
      } catch (err) {
        console.error('Error fetching session key:', err);
      } finally {
        setIsLoadingSessionKey(false);
      }
    };

    if (isOpen) {
      fetchSessionKey();
    }
  }, [isOpen, smartAccountAddress, account?.address]);

  const isWrongNetwork = useMemo(() => {
    const currentChain = walletChainId ?? activeChain?.id;
    if (currentChain == null) return false;
    return currentChain !== chainId;
  }, [walletChainId, activeChain, chainId]);

  const switchToChain = async (targetChainId: number) => {
    if (!window.ethereum) return;

    const chainIdHex = `0x${targetChainId.toString(16)}`;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
      setWalletChainId(targetChainId);
    } catch (err: any) {
      console.error('Error switching network:', err);
    }
  };

  const handleDeposit = async () => {
    if (!account) {
      setError('Connect your wallet first!');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Enter a valid value greater than 0');
      return;
    }

    if (!currentNetwork) {
      setError('Select a valid network');
      return;
    }

    if (isWrongNetwork) {
      setError(`Switch your wallet to ${currentNetwork?.name} to continue`);
      return;
    }

    if (!smartAccountAddress || smartAccountAddress.length !== 42 || !smartAccountAddress.startsWith('0x')) {
      setError('Invalid Smart Account address');
      return;
    }

    setIsDepositing(true);
    setError(null);
    setTxHash(null);

    try {
      const transaction = prepareTransaction({
        to: smartAccountAddress as Address,
        value: toWei(amount),
        chain: defineChain(chainId),
        client,
      });

      const result = await sendTransaction({
        transaction,
        account,
      });

      setTxHash(result.transactionHash);
    } catch (err: any) {
      console.error('Error depositing:', err);

      let errorMessage = 'Error making deposit. Please try again.';

      if (err.message) {
        if (err.message.includes('insufficient funds') || err.message.includes('transfer amount exceeds balance')) {
          errorMessage = `Insufficient balance on ${currentNetwork?.name}!`;
        } else if (err.message.includes('user rejected')) {
          errorMessage = 'Transaction cancelled by user.';
        } else if (err.message.includes('gas')) {
          errorMessage = 'Gas error. Try increasing the gas limit.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setIsDepositing(false);
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTxHash(null);
      setError(null);
      setAmount('0.01');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <GlassCard className="w-full max-w-lg bg-[#0A0A0A]/95 border-cyan-500/20 overflow-hidden my-auto">
              {/* Header */}
              <div className="relative p-6 border-b border-white/5">
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-cyan-500/10 to-transparent pointer-events-none" />

                <div className="relative flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                      <ArrowDownToLine className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Deposit Funds</h2>
                      <p className="text-sm text-zinc-400 mt-1">
                        Add balance to your Smart Wallet
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                {/* Success State */}
                {txHash ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center py-8"
                  >
                    <div className="w-16 h-16 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-4">
                      <Check className="w-8 h-8 text-cyan-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Deposit Successful!</h3>
                    <p className="text-sm text-zinc-400 text-center mb-4">
                      {amount} {nativeToken.symbol} has been deposited to your Smart Wallet.
                    </p>
                    <a
                      href={getExplorerUrl(chainId, txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <span className="font-mono">{txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={onClose}
                      className="mt-6 px-6 py-2 rounded-xl bg-cyan-500 text-white font-medium hover:bg-cyan-400 transition-colors"
                    >
                      Done
                    </button>
                  </motion.div>
                ) : (
                  <>
                    {/* Error Message */}
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20"
                      >
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <p className="text-sm text-red-400">{error}</p>
                      </motion.div>
                    )}

                    {/* Wrong Network Warning */}
                    {isWrongNetwork && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between p-4 rounded-xl bg-orange-500/10 border border-orange-500/20"
                      >
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0" />
                          <p className="text-sm text-orange-400">
                            Switch to {currentNetwork?.name} to continue
                          </p>
                        </div>
                        <button
                          onClick={() => switchToChain(chainId)}
                          className="px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-medium hover:bg-orange-500/30 transition-colors"
                        >
                          Switch
                        </button>
                      </motion.div>
                    )}

                    {/* Smart Account Info */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-cyan-400" />
                          <span className="text-sm font-medium text-white">Smart Account</span>
                        </div>
                        <a
                          href={getAddressExplorerUrl(chainId, smartAccountAddress)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          View
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Name</span>
                          <span className="text-white font-medium">{smartAccountName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Address</span>
                          <span className="text-white font-mono">
                            {smartAccountAddress.slice(0, 6)}...{smartAccountAddress.slice(-4)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Session Key</span>
                          <span className="text-white font-mono">
                            {isLoadingSessionKey ? (
                              <Loader2 className="w-3 h-3 animate-spin inline" />
                            ) : sessionKeyAddress ? (
                              `${sessionKeyAddress.slice(0, 6)}...${sessionKeyAddress.slice(-4)}`
                            ) : (
                              'Not available'
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Network Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">Network</label>
                      <div className="relative">
                        <select
                          value={chainId}
                          onChange={(e) => setChainId(Number(e.target.value))}
                          disabled={isDepositing}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all disabled:opacity-50 appearance-none cursor-pointer"
                        >
                          {networks.map((network) => (
                            <option key={network.chainId} value={network.chainId}>
                              {network.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Token Display */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">Token</label>
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                        {nativeToken.icon && (
                          <img
                            src={nativeToken.icon}
                            alt={nativeToken.symbol}
                            className="w-8 h-8 rounded-full"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-white">{nativeToken.symbol}</div>
                          <div className="text-xs text-zinc-500">{nativeToken.name}</div>
                        </div>
                      </div>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">Amount</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0.000001"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          disabled={isDepositing}
                          placeholder="0.01"
                          className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all disabled:opacity-50"
                        />
                        <div className="flex items-center px-4 rounded-xl bg-white/5 border border-white/10 text-zinc-400 font-medium">
                          {nativeToken.symbol}
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500">
                        This will be transferred from your wallet to the Smart Wallet.
                      </p>
                    </div>

                    {/* Quick Amounts */}
                    <div className="flex flex-wrap gap-2">
                      {['0.001', '0.005', '0.01', '0.05'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAmount(preset)}
                          disabled={isDepositing}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                            amount === preset
                              ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-400"
                              : "bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
                          )}
                        >
                          {preset} {nativeToken.symbol}
                        </button>
                      ))}
                    </div>

                    {/* Info Note */}
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                      <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-zinc-400">
                        Leave some {nativeToken.symbol} in your main wallet to pay for gas fees when depositing.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              {!txHash && (
                <div className="p-6 pt-0 flex gap-3">
                  <button
                    onClick={onClose}
                    disabled={isDepositing}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeposit}
                    disabled={isDepositing || !amount || parseFloat(amount) <= 0 || isWrongNetwork}
                    className={cn(
                      "flex-1 px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                      isDepositing || !amount || parseFloat(amount) <= 0 || isWrongNetwork
                        ? "bg-cyan-500/20 text-cyan-400/50 cursor-not-allowed"
                        : "bg-cyan-500 text-white hover:bg-cyan-400"
                    )}
                  >
                    {isDepositing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Depositing...
                      </>
                    ) : isWrongNetwork ? (
                      `Switch to ${currentNetwork?.name}`
                    ) : (
                      <>
                        <ArrowDownToLine className="w-4 h-4" />
                        Deposit {amount} {nativeToken.symbol}
                      </>
                    )}
                  </button>
                </div>
              )}
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
