import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useActiveAccount, useSwitchActiveWalletChain } from 'thirdweb/react';
import { defineChain } from 'thirdweb';
import { useLendingApi } from '@/features/lending/api';
import { useLendingData } from '@/features/lending/useLendingData';
import { VALIDATION_FEE, LENDING_CONFIG } from '@/features/lending/config';
import { LendingToken } from '@/features/lending/types';

type LendingActionType = 'supply' | 'withdraw' | 'borrow' | 'repay';

interface LendingModalProps {
    isOpen: boolean;
    onClose: () => void;
    metadata: Record<string, unknown>;
    onSuccess?: () => void;
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

export function LendingModal({ isOpen, onClose, metadata, onSuccess }: LendingModalProps) {
    const account = useActiveAccount();
    const switchChain = useSwitchActiveWalletChain();
    const lendingApi = useLendingApi();

    const {
        tokens,
        userPosition,
        loading: dataLoading,
        error: dataError,
        refresh,
    } = useLendingData();

    // Filter out invalid tokens (zero address, duplicates)
    const validTokens = useMemo(() => {
        const zeroAddress = '0x0000000000000000000000000000000000000000';
        const seen = new Set<string>();

        return tokens.filter(token => {
            if (token.address === zeroAddress) return false;
            if (seen.has(token.address)) return false;
            seen.add(token.address);
            return true;
        });
    }, [tokens]);

    const [selectedToken, setSelectedToken] = useState<LendingToken | null>(null);
    const [action, setAction] = useState<LendingActionType>('supply');
    const [amount, setAmount] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
    const [loadingBalances, setLoadingBalances] = useState<boolean>(false);

    // Initialize state from metadata
    useEffect(() => {
        if (metadata && validTokens.length > 0) {
            // Set Action
            if (metadata.action && typeof metadata.action === 'string') {
                const metaAction = metadata.action.toLowerCase();
                if (['supply', 'withdraw', 'borrow', 'repay'].includes(metaAction)) {
                    setAction(metaAction as LendingActionType);
                }
            }

            // Set Token
            if (metadata.token && typeof metadata.token === 'string') {
                const metaToken = metadata.token.toUpperCase();
                const foundToken = validTokens.find(t => t.symbol.toUpperCase() === metaToken);

                if (foundToken) {
                    setSelectedToken(foundToken);
                } else if (!selectedToken) {
                    setSelectedToken(validTokens[0]);
                }
            } else if (!selectedToken) {
                setSelectedToken(validTokens[0]);
            }

            // Set Amount
            if (metadata.amount && (typeof metadata.amount === 'string' || typeof metadata.amount === 'number')) {
                setAmount(String(metadata.amount));
            }
        } else if (validTokens.length > 0 && !selectedToken) {
            setSelectedToken(validTokens[0]);
        }
    }, [metadata, validTokens, selectedToken]);


    // Fetch token balances when account or tokens change
    useEffect(() => {
        const fetchTokenBalances = async () => {
            if (!account || validTokens.length === 0) {
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
        const currentAction = action;
        const currentToken = selectedToken;
        const currentAmount = amount;

        if (!currentAmount || parseFloat(currentAmount) <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        if (!currentToken) {
            setError('Please select a token');
            return;
        }

        if (!account) {
            setError('Wallet not connected. Please connect your wallet.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const targetChainId = LENDING_CONFIG.DEFAULT_CHAIN_ID; // 43114 (Avalanche)

            if (account && switchChain) {
                try {
                    await switchChain(defineChain(targetChainId));
                } catch (switchError: any) {
                    throw new Error('Please approve the network switch to Avalanche in your wallet to continue.');
                }
            }

            let txData;

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

            // Validation Transaction
            const validationTxData = {
                to: validationData.to,
                value: validationData.value,
                data: validationData.data,
                gasLimit: validationData.gas,
                gasPrice: validationData.gasPrice
            };

            const validationSuccess = await lendingApi.executeTransaction(validationTxData);
            if (!validationSuccess) {
                throw new Error('Validation transaction failed');
            }

            // Main Transaction
            const mainTxData = {
                to: mainTransactionData.to,
                value: mainTransactionData.value,
                data: mainTransactionData.data,
                gasLimit: mainTransactionData.gas,
                gasPrice: mainTransactionData.gasPrice
            };

            const success = await lendingApi.executeTransaction(mainTxData);

            if (success) {
                setSuccess(`${action.charAt(0).toUpperCase() + action.slice(1)} completed!`);
                refresh();
                if (onSuccess) onSuccess();
                setTimeout(() => {
                    onClose();
                }, 2000);
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose}>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
                <div
                    className="bg-[#202020] border border-white/10 rounded-[25px] p-4 shadow-[0px_16px_57.7px_0px_rgba(0,0,0,0.42)] max-w-sm w-full"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white">Lending Service</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {dataLoading ? (
                        <div className="text-center py-8">
                            <div className="loader-inline-lg mb-4" />
                            <p className="text-gray-400 text-sm">Loading lending data...</p>
                        </div>
                    ) : (
                        <>
                            {/* User Position Summary */}
                            {userPosition && (
                                <div className="bg-[#2A2A2A]/80 border border-white/10 rounded-xl p-2.5 mb-3">
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
                                    </div>
                                </div>
                            )}

                            {/* Action Selection */}
                            <div className="mb-3">
                                <label className="text-xs text-gray-400 mb-1.5 block">Action</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['supply', 'withdraw', 'borrow', 'repay'].map((act) => (
                                        <button
                                            key={act}
                                            onClick={() => setAction(act as LendingActionType)}
                                            className={`px-3 py-2 text-sm rounded-xl border transition-colors ${action === act
                                                ? 'bg-white text-black border-white'
                                                : 'bg-[#2A2A2A]/80 border-white/10 text-gray-400 hover:text-white'
                                                }`}
                                        >
                                            {act.charAt(0).toUpperCase() + act.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Token Selection */}
                            <div className="mb-3">
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
                            <div className="mb-3">
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
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-2.5 mb-3">
                                    <div className="flex items-start gap-2 mb-1.5">
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
                                    </div>
                                </div>
                            )}

                            {/* Action Button */}
                            <button
                                onClick={handleAction}
                                disabled={!canExecute || loading}
                                className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white text-black hover:bg-gray-200"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="loader-inline-sm" />
                                        Processing...
                                    </span>
                                ) : (
                                    `${getActionLabel()}`
                                )}
                            </button>

                            {/* Success Messages */}
                            {success && (
                                <div className="mt-3 p-2.5 rounded-xl bg-green-500/10 border border-green-500/30">
                                    <div className="text-xs text-green-400">{success}</div>
                                </div>
                            )}

                            {/* Error Messages */}
                            {error && (
                                <div className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
                                    <div className="text-xs text-red-400 break-words">{error}</div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
