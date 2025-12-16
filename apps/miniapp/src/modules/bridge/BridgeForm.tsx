'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useActiveAccount, ConnectButton, useWalletBalance } from 'thirdweb/react';
import { createThirdwebClient, defineChain } from 'thirdweb';
import { inAppWallet } from 'thirdweb/wallets';
import { tacApi } from '@/features/tac/client';
import { useAuth } from '@/shared/contexts/AuthContext';

export const BridgeForm = () => {
    const [tonConnectUI] = useTonConnectUI();
    const tonWallet = useTonWallet();
    const smartAccount = useActiveAccount(); // From thirdweb
    const { user } = useAuth();
    const [amount, setAmount] = useState<string>('');
    const [usdEstimate, setUsdEstimate] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [bridgeId, setBridgeId] = useState<string | null>(null);
    const [tonBalance, setTonBalance] = useState<string | null>(null);

    const TOKEN_SYMBOL = 'TON'; // Bridge currently supports TON only
    const evmChainId = Number(process.env.NEXT_PUBLIC_TAC_EVM_CHAIN_ID || 1);
    const thirdwebClientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || process.env.THIRDWEB_CLIENT_ID;
    const thirdwebClient = useMemo(() => thirdwebClientId ? createThirdwebClient({ clientId: thirdwebClientId }) : null, [thirdwebClientId]);
    const wallets = useMemo(() => [inAppWallet({
        auth: {
            options: ['telegram'],
            mode: 'popup'
        }
    })], []);

    const evmBalance = useWalletBalance({
        chain: defineChain(evmChainId),
        address: smartAccount?.address,
        client: thirdwebClient || undefined
    });

    const ensuredEvmWalletRef = useRef<boolean>(false);
    useEffect(() => {
        const ensureEvmWallet = async () => {
            if (!smartAccount?.address || ensuredEvmWalletRef.current) return;
            try {
                // Resolve user id: prefer AuthContext, else fallback to stored telegram_user
                let telegramUserId: string | undefined = user ? String(user.id) : undefined;
                if (!telegramUserId && typeof window !== 'undefined') {
                    try {
                        const stored = localStorage.getItem('telegram_user');
                        if (stored) {
                            const parsed = JSON.parse(stored);
                            if (parsed?.id) telegramUserId = String(parsed.id);
                        }
                    } catch {
                        // ignore parse errors
                    }
                }
                await tacApi.ensureEvmWallet({
                    chainId: String(evmChainId),
                    address: smartAccount.address,
                    provision: false,
                    telegramUserId
                });
                ensuredEvmWalletRef.current = true;
            } catch (err) {
                console.warn('[Bridge] ensureEvmWallet failed', err);
            }
        };
        ensureEvmWallet();
    }, [smartAccount?.address, evmChainId, user]);

    useEffect(() => {
        const fetchTonBalance = async () => {
            if (!tonWallet?.account?.address) return;
            try {
                const res = await fetch(`https://toncenter.com/api/v2/getAddressBalance?address=${tonWallet.account.address}`);
                const data = await res.json();
                if (data.ok && data.result) {
                    const ton = Number(data.result) / 1e9;
                    setTonBalance(ton.toFixed(4));
                } else {
                    setTonBalance(null);
                }
            } catch {
                setTonBalance(null);
            }
        };
        fetchTonBalance();
    }, [tonWallet?.account?.address]);

    // Estimate USD value for the entered TON amount
    useEffect(() => {
        const estimate = async () => {
            const amt = parseFloat(amount);
            if (!amount || isNaN(amt) || amt <= 0) {
                setUsdEstimate(null);
                return;
            }
            try {
                const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');
                const data = await res.json();
                const price = data?.['the-open-network']?.usd;
                if (price && typeof price === 'number') {
                    setUsdEstimate((amt * price).toFixed(2));
                } else {
                    setUsdEstimate(null);
                }
            } catch {
                setUsdEstimate(null);
            }
        };
        estimate();
    }, [amount]);

    const handleBridge = async () => {
        if (!tonWallet) {
            setStatus('Please connect your TON wallet first.');
            return;
        }
        if (!smartAccount) {
            setStatus('No Ethereum Smart Wallet found. Please connect/create one.');
            return;
        }
        if (!amount || isNaN(Number(amount))) {
            setStatus('Please enter a valid amount.');
            return;
        }

        setIsLoading(true);
        setStatus('Initiating bridge...');

        try {
            const bridgeBase =
                process.env.NEXT_PUBLIC_TAC_BRIDGE_BASE ||
                (process.env.NEXT_PUBLIC_TAC_API_BASE || '').replace(/\/api\/tac$/, '') ||
                '';

            const endpoint = bridgeBase
                ? `${bridgeBase.replace(/\/+$/, '')}/api/bridge/ton/out`
                : '/api/bridge/ton/out';

            const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                body: JSON.stringify({
                    amount,
                    tonAddress: tonWallet.account.address,
                    destinationAddress: smartAccount.address,
                    token: TOKEN_SYMBOL, // must be TON for current bridge
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to initiate bridge');
            }

            const result = await response.json();
            const payload =
                result?.data?.bridge?.metadata?.transactionPayload ||
                result?.transactionPayload ||
                result?.metadata?.transactionPayload;
            const newBridgeId =
                result?.data?.bridge?.bridgeId ||
                result?.data?.bridgeId ||
                result?.bridgeId ||
                null;

            if (!payload) {
                throw new Error('Bridge payload not returned by backend');
            }

            if (newBridgeId) {
                setBridgeId(newBridgeId);
            }

            // 2. Send Transaction via TON Connect
            setStatus('Please sign the transaction in your TON wallet...');

            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
                messages: [
                    {
                        address: payload.to,
                        amount: payload.value.toString(),
                        payload: payload.body, // The BOC payload from backend
                    },
                ],
            };

            await tonConnectUI.sendTransaction(transaction);

            setStatus('Transaction sent! Waiting for LayerZero confirmation...');

        } catch (error: any) {
            console.error('Bridge Error:', error);
            setStatus(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-md mx-auto bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
            <h2 className="text-2xl font-bold mb-6 text-white">Bridge TON to Ethereum</h2>

            <div className="space-y-4">
                {/* TON Wallet Connection */}
                <div className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
                    <span className="text-gray-300">From (TON)</span>
                    {tonWallet ? (
                        <div className="flex flex-col items-end">
                            <span className="text-green-400 font-mono text-sm">
                                {tonWallet.account.address.slice(0, 4)}...{tonWallet.account.address.slice(-4)}
                            </span>
                            <span className="text-xs text-gray-400">
                                Balance: {tonBalance ?? '...'} TON
                            </span>
                        </div>
                    ) : (
                        <button
                            onClick={() => tonConnectUI.openModal()}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
                        >
                            Connect TON
                        </button>
                    )}
                </div>

                {/* EVM Wallet Display */}
                <div className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
                    <span className="text-gray-300">To (Ethereum)</span>
                    {smartAccount ? (
                        <div className="flex flex-col items-end">
                            <span className="text-blue-400 font-mono text-sm">
                                {smartAccount.address.slice(0, 6)}...{smartAccount.address.slice(-4)}
                            </span>
                            <span className="text-xs text-gray-400">
                                Balance: {evmBalance.data ? Number(evmBalance.data.displayValue).toFixed(4) : '...'} {evmBalance.data?.symbol || 'ETH'}
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-yellow-500 text-sm">Not Connected</span>
                            {thirdwebClient && (
                                <ConnectButton
                                    client={thirdwebClient}
                                    wallets={wallets}
                                    theme="dark"
                                    auth={{}}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Amount Input */}
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Amount to bridge ({TOKEN_SYMBOL} only)</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.0 TON"
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <div className="text-xs text-gray-400 mt-1">
                        This bridge supports TON only; USDT/jettons are not sent here.
                    </div>
                    {usdEstimate && (
                        <div className="text-xs text-gray-300 mt-1">
                            Est. USD value: <span className="font-semibold">${usdEstimate}</span>
                        </div>
                    )}
                </div>

                {/* Amount Preview */}
                <div className="p-3 bg-black/15 rounded-lg text-sm text-gray-300 border border-white/5">
                    <div className="flex justify-between">
                        <span>Sending</span>
                        <span className="font-semibold text-white">{amount || '0'} {TOKEN_SYMBOL}</span>
                    </div>
                    {tonBalance && Number(amount) > 0 && (
                        <div className="flex justify-between mt-1 text-xs text-gray-400">
                            <span>Estimated remaining TON</span>
                            <span>{(Number(tonBalance) - Number(amount)).toFixed(4)} TON</span>
                        </div>
                    )}
                </div>

                {/* Action Button */}
                <button
                    onClick={handleBridge}
                    disabled={isLoading || !tonWallet || !smartAccount}
                    className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${isLoading || !tonWallet || !smartAccount
                            ? 'bg-gray-600 cursor-not-allowed opacity-50'
                            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-blue-900/20'
                        }`}
                >
                    {isLoading ? 'Processing...' : 'Bridge Assets'}
                </button>

                {/* Status Message */}
                {status && (
                    <div className={`p-3 rounded-lg text-sm text-center ${status.includes('Error') ? 'bg-red-500/20 text-red-200' : 'bg-blue-500/20 text-blue-200'}`}>
                        {status}
                    </div>
                )}
                {bridgeId && !status.includes('Error') && (
                    <div className="p-3 rounded-lg text-xs text-gray-300 bg-white/5 border border-white/10">
                        Bridge ID: <span className="font-mono break-all">{bridgeId}</span>
                        <div className="text-[11px] text-gray-400 mt-1">Use the Bridge status page to track confirmations.</div>
                    </div>
                )}
            </div>
        </div>
    );
};
