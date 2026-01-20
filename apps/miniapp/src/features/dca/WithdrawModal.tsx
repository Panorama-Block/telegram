/**
 * Modal to withdraw funds from Smart Account
 * Styled with glass morphism to match Portfolio page
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActiveAccount } from 'thirdweb/react';
import { createThirdwebClient, defineChain, eth_getBalance, getRpcClient, getContract, type Address } from 'thirdweb';
import { balanceOf } from 'thirdweb/extensions/erc20';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { withdrawFromSmartAccount, withdrawTokenFromSmartAccount, DCAApiError, getSmartAccount } from './api';
import { networks } from '@/features/swap/tokens';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  X,
  Wallet,
  ArrowUpFromLine,
  Loader2,
  Check,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  smartAccountAddress: string;
  smartAccountName: string;
}

export default function WithdrawModal({
  isOpen,
  onClose,
  smartAccountAddress,
  smartAccountName,
}: WithdrawModalProps) {
  const account = useActiveAccount();
  const [chainId] = useState<number>(1);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionKeyAddress, setSessionKeyAddress] = useState<string>('');
  const [isLoadingSessionKey, setIsLoadingSessionKey] = useState(false);
  const [availableBalance, setAvailableBalance] = useState<string>('0.000000');
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);

  // ERC20 token states
  const [selectedToken, setSelectedToken] = useState<'ETH' | string>('ETH');
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
  const [isFetchingTokens, setIsFetchingTokens] = useState(false);

  const client = useMemo(
    () => createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID || '' }),
    []
  );

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

  // Fetch token balances (ERC20)
  const fetchTokenBalances = useCallback(async () => {
    if (!smartAccountAddress) return;
    setIsFetchingTokens(true);
    try {
      const chain = defineChain(chainId);
      const network = networks.find(n => n.chainId === chainId);
      if (!network) return;

      const balances: Record<string, string> = {};

      await Promise.all(
        network.tokens.map(async (token) => {
          try {
            if (token.address === '0x0000000000000000000000000000000000000000' ||
                token.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
              return;
            }

            const contract = getContract({
              client,
              chain,
              address: token.address,
            });

            const balance = await balanceOf({
              contract,
              address: smartAccountAddress as Address,
            });

            const balanceFormatted = (Number(balance) / Math.pow(10, token.decimals || 18)).toFixed(6);
            if (parseFloat(balanceFormatted) > 0) {
              balances[token.address] = balanceFormatted;
            }
          } catch (err) {
            console.error(`Error fetching balance for ${token.symbol}:`, err);
          }
        })
      );

      setTokenBalances(balances);
    } catch (err) {
      console.error('Error fetching token balances:', err);
    } finally {
      setIsFetchingTokens(false);
    }
  }, [client, smartAccountAddress, chainId]);

  const fetchSessionBalance = useCallback(async () => {
    if (!smartAccountAddress) return;
    setIsFetchingBalance(true);
    try {
      const rpcClient = getRpcClient({
        client,
        chain: defineChain(chainId),
      });
      const balanceWei = await eth_getBalance(rpcClient, {
        address: smartAccountAddress as Address,
      });
      const balance = Number(balanceWei) / 1e18;
      if (Number.isFinite(balance)) {
        setAvailableBalance(balance.toFixed(6));
      } else {
        setAvailableBalance('0.000000');
      }
    } catch (err) {
      console.error('Error fetching smart account balance:', err);
      setAvailableBalance('0.000000');
    } finally {
      setIsFetchingBalance(false);
    }
  }, [client, smartAccountAddress, chainId]);

  useEffect(() => {
    if (isOpen && smartAccountAddress) {
      void fetchSessionBalance();
      void fetchTokenBalances();
    }
  }, [isOpen, smartAccountAddress, fetchSessionBalance, fetchTokenBalances]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setSuccess(null);
      setAmount('');
      setSelectedToken('ETH');
    }
  }, [isOpen]);

  const currentNetwork = useMemo(() => {
    return networks.find(n => n.chainId === chainId);
  }, [chainId]);

  const handleWithdraw = async () => {
    if (!account) {
      setError('Please connect your wallet.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || parsedAmount <= 0) {
      setError('Enter a valid withdrawal amount.');
      return;
    }

    const currentBalance = selectedToken === 'ETH' ? availableBalance : tokenBalances[selectedToken];
    const numericBalance = parseFloat(currentBalance || '0');

    if (!Number.isFinite(numericBalance) || numericBalance <= 0) {
      setError('Balance unavailable for withdrawal at the moment.');
      return;
    }

    if (parsedAmount > numericBalance) {
      setError(`Insufficient balance. Available: ${numericBalance.toFixed(6)}`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let result;
      let tokenSymbol = 'ETH';

      if (selectedToken === 'ETH') {
        result = await withdrawFromSmartAccount({
          smartAccountAddress,
          userId: account.address,
          amount,
          chainId,
        });
      } else {
        const network = networks.find(n => n.chainId === chainId);
        const token = network?.tokens.find(t => t.address === selectedToken);

        if (!token) {
          setError('Token not found.');
          return;
        }

        tokenSymbol = token.symbol;

        result = await withdrawTokenFromSmartAccount({
          smartAccountAddress,
          userId: account.address,
          tokenAddress: selectedToken,
          amount,
          decimals: token.decimals || 18,
          chainId,
        });
      }

      if (result.success) {
        setSuccess(`${amount} ${tokenSymbol} sent to ${account.address.slice(0, 6)}...${account.address.slice(-4)}`);
        setAmount('');
        void fetchSessionBalance();
        void fetchTokenBalances();
      } else {
        setError(result.error || 'Failed to process withdrawal.');
      }
    } catch (err: any) {
      console.error('Error withdrawing:', err);
      if (err instanceof DCAApiError) {
        setError(err.message);
      } else {
        setError('Error processing withdrawal. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

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
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 sm:inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <GlassCard className="w-full sm:max-w-lg bg-[#0A0A0A] border-cyan-500/20 overflow-hidden rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="relative p-4 sm:p-6 border-b border-white/5">
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-cyan-500/10 to-transparent pointer-events-none" />

                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="p-2.5 sm:p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex-shrink-0">
                      <ArrowUpFromLine className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold text-white truncate">Withdraw Funds</h2>
                      <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 sm:mt-1">
                        Transfer to your main wallet
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
                {/* Success State */}
                {success ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center py-8"
                  >
                    <div className="w-16 h-16 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-4">
                      <Check className="w-8 h-8 text-cyan-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Withdrawal Successful!</h3>
                    <p className="text-sm text-zinc-400 text-center mb-4">
                      {success}
                    </p>
                    <button
                      onClick={onClose}
                      className="mt-2 px-6 py-2 rounded-xl bg-cyan-500 text-white font-medium hover:bg-cyan-400 transition-colors"
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

                    {/* Smart Account Info */}
                    <div className="p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 sm:space-y-3">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
                        <span className="text-xs sm:text-sm font-medium text-white">Smart Account</span>
                      </div>

                      <div className="space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Name</span>
                          <span className="text-white font-medium truncate ml-2">{smartAccountName}</span>
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
                              'N/A'
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Destination</span>
                          <span className="text-white font-mono">
                            {account?.address
                              ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
                              : 'Connect'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Token Selection */}
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs sm:text-sm font-medium text-zinc-300">Select Token</label>
                        <button
                          onClick={() => {
                            void fetchSessionBalance();
                            void fetchTokenBalances();
                          }}
                          disabled={isFetchingBalance || isFetchingTokens}
                          className="flex items-center gap-1 text-[10px] sm:text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={cn("w-3 h-3", (isFetchingBalance || isFetchingTokens) && "animate-spin")} />
                          Refresh
                        </button>
                      </div>

                      {/* ETH Option */}
                      <button
                        type="button"
                        onClick={() => setSelectedToken('ETH')}
                        className={cn(
                          "w-full flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all",
                          selectedToken === 'ETH'
                            ? "border-cyan-500/30 bg-cyan-500/10"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        )}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 flex items-center justify-center text-xs sm:text-sm font-bold">
                            Ξ
                          </div>
                          <div className="text-left">
                            <p className="text-xs sm:text-sm font-medium text-white">ETH</p>
                            <p className="text-[10px] sm:text-xs text-zinc-500">{currentNetwork?.name || 'Ethereum'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs sm:text-sm font-medium text-white">
                            {isFetchingBalance ? (
                              <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                            ) : (
                              availableBalance
                            )}
                          </p>
                          <p className="text-[10px] sm:text-xs text-zinc-500">Available</p>
                        </div>
                      </button>

                      {/* ERC20 Tokens */}
                      {Object.entries(tokenBalances).map(([tokenAddress, balance]) => {
                        const network = networks.find(n => n.chainId === chainId);
                        const token = network?.tokens.find(t => t.address === tokenAddress);
                        if (!token) return null;

                        return (
                          <button
                            key={tokenAddress}
                            type="button"
                            onClick={() => setSelectedToken(tokenAddress)}
                            className={cn(
                              "w-full flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all",
                              selectedToken === tokenAddress
                                ? "border-cyan-500/30 bg-cyan-500/10"
                                : "border-white/10 bg-white/5 hover:border-white/20"
                            )}
                          >
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                                {token.icon ? (
                                  <img src={token.icon} alt={token.symbol} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" />
                                ) : (
                                  <span className="text-[10px] sm:text-xs font-medium">{token.symbol.slice(0, 2)}</span>
                                )}
                              </div>
                              <div className="text-left">
                                <p className="text-xs sm:text-sm font-medium text-white">{token.symbol}</p>
                                <p className="text-[10px] sm:text-xs text-zinc-500">{token.name}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs sm:text-sm font-medium text-white">{balance}</p>
                              <p className="text-[10px] sm:text-xs text-zinc-500">Available</p>
                            </div>
                          </button>
                        );
                      })}

                      {!isFetchingTokens && Object.keys(tokenBalances).length === 0 && (
                        <p className="text-[10px] sm:text-xs text-zinc-500 text-center py-1.5 sm:py-2">
                          No ERC20 tokens found
                        </p>
                      )}
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-sm font-medium text-zinc-300">Amount</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0.000001"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          disabled={loading}
                          placeholder="0.0"
                          className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all disabled:opacity-50"
                        />
                        <div className="flex items-center px-3 sm:px-4 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-sm font-medium">
                          {selectedToken === 'ETH'
                            ? 'ETH'
                            : networks.find(n => n.chainId === chainId)?.tokens.find(t => t.address === selectedToken)?.symbol || 'TOKEN'}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] sm:text-xs">
                        <span className="text-zinc-500">
                          Available: {selectedToken === 'ETH' ? availableBalance : tokenBalances[selectedToken] || '0'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const balance = selectedToken === 'ETH' ? availableBalance : tokenBalances[selectedToken];
                            setAmount(balance || '0');
                          }}
                          className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                        >
                          Max
                        </button>
                      </div>
                    </div>

                    {/* Warning Note */}
                    {selectedToken === 'ETH' && (
                      <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                        <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] sm:text-xs text-zinc-400">
                          Leave some ETH for future gas fees.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              {!success && (
                <div className="p-4 sm:p-6 pt-0 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 font-medium text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWithdraw}
                    disabled={loading || !amount || parseFloat(amount) <= 0}
                    className={cn(
                      "flex-1 px-4 py-2.5 sm:py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm sm:text-base",
                      loading || !amount || parseFloat(amount) <= 0
                        ? "bg-cyan-500/20 text-cyan-400/50 cursor-not-allowed"
                        : "bg-cyan-500 text-white hover:bg-cyan-400"
                    )}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Withdrawing...
                      </>
                    ) : (
                      <>
                        <ArrowUpFromLine className="w-4 h-4" />
                        Withdraw
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
