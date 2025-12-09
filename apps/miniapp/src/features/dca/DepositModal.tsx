/**
 * Modal to deposit funds into the Smart Account
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useActiveAccount, useActiveWalletChain } from 'thirdweb/react';
import { sendTransaction, prepareTransaction, toWei, defineChain } from 'thirdweb';
import { createThirdwebClient, type Address } from 'thirdweb';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { networks, Token } from '@/features/swap/tokens';
import { Button } from '@/components/ui/button';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  smartAccountAddress: string;
  smartAccountName: string;
}

// Helper function to get explorer URL for transaction
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

export default function DepositModal({
  isOpen,
  onClose,
  smartAccountAddress,
  smartAccountName,
}: DepositModalProps) {
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();
  const [chainId, setChainId] = useState<number>(8453); // Base default
  const [amount, setAmount] = useState('0.01');
  const [isDepositing, setIsDepositing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sessionKeyAddress, setSessionKeyAddress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string>('0');
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);

  // Session Key funding state
  const [showSessionKeyStep, setShowSessionKeyStep] = useState(false);
  const [plannedTrades, setPlannedTrades] = useState<number>(5);
  const [isDepositingToSessionKey, setIsDepositingToSessionKey] = useState(false);
  const [sessionKeyTxHash, setSessionKeyTxHash] = useState<string | null>(null);

  const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID || '' });

  useEffect(() => {
    if (activeChain?.id != null) {
      setWalletChainId(activeChain.id);
    }
  }, [activeChain]);

  // Get current network
  const currentNetwork = useMemo(() => {
    const found = networks.find((n) => n.chainId === chainId);
    return found;
  }, [chainId]);

  // Get native token for current network
  const nativeToken = useMemo(() => {
    return currentNetwork?.nativeCurrency || {
      symbol: 'ETH',
      address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      icon: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
      decimals: 18,
      name: 'Ethereum'
    };
  }, [currentNetwork]);

  // Fetch session key address from smart account (for display purposes only)
  useEffect(() => {
    const fetchSessionKey = async () => {
      if (!smartAccountAddress) return;

      try {
        const { DCA_API_URL } = await import('./api');
        const response = await fetch(`${DCA_API_URL}/dca/account/${smartAccountAddress}`);
        if (response.ok) {
          const data = await response.json();
          setSessionKeyAddress(data.sessionKeyAddress);
          console.log('Session Key Address (signer):', data.sessionKeyAddress);
          console.log('Smart Account Address (holds funds):', smartAccountAddress);
        }
      } catch (err) {
        console.error('Error fetching session key:', err);
      }
    };

    if (isOpen) {
      fetchSessionKey();
    }
  }, [isOpen, smartAccountAddress]);

  // Check if wallet is on wrong network
  const isWrongNetwork = useMemo(() => {
    const currentChain = walletChainId ?? activeChain?.id;
    if (currentChain == null) {
      return false;
    }
    return currentChain !== chainId;
  }, [walletChainId, activeChain, chainId]);

  // Check wallet balance
  const checkWalletBalance = async () => {
    if (!account || !currentNetwork) return;

    // TypeScript narrowing
    const activeAccount = account;

    setIsCheckingBalance(true);
    try {
      // TODO: Fix balance checking with correct Thirdweb v5 imports
      // Temporarily disabled to avoid errors
      console.log('⚠️ Balance checking temporarily disabled');
      setWalletBalance('--');
      setIsCheckingBalance(false);
      return;

      // For native tokens
      console.log('🔍 Checking native token balance for:', { chainId });

      // const balance = await getBalance({
      //   client,
      //   chain: defineChain(chainId),
      //   address: activeAccount.address as Address,
      // });

      // // Convert from wei to readable format
      // const balanceInTokens = (Number(balance.value) / Math.pow(10, 18)).toFixed(6);
      // console.log('💰 Native token balance found:', balanceInTokens);
      // setWalletBalance(balanceInTokens);
    } catch (err) {
      console.error('Error checking balance:', err);
      setWalletBalance('0');
    } finally {
      setIsCheckingBalance(false);
    }
  };

  // Check wallet balance when component mounts or chain changes
  useEffect(() => {
    if (isOpen && account && currentNetwork) {
      console.log('🔄 Checking balance for:', { token: nativeToken.symbol, chainId });
      // Reset balance first
      setWalletBalance('0');
      checkWalletBalance();
    }
  }, [isOpen, account, chainId, currentNetwork]);

  // Ensure wallet is on selected network when modal opens or selection changes
  useEffect(() => {
    if (!isOpen || !account) {
      return;
    }

    void checkCurrentNetwork();

    if (!window.ethereum) {
      return;
    }

    const handleChainChanged = (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16);
      console.log('🔄 Network changed to:', newChainId);
      setWalletChainId(newChainId);
    };

    const ethereum = window.ethereum as any;
    ethereum.on?.('chainChanged', handleChainChanged);

    return () => {
      ethereum.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [isOpen, account, chainId]);

  const checkCurrentNetwork = async () => {
    if (!window.ethereum) return;

    try {
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      const currentChainIdNumber = parseInt(currentChainId, 16);

      console.log('🔍 Current network detected:', currentChainIdNumber);

      setWalletChainId(currentChainIdNumber);

      if (currentChainIdNumber !== chainId) {
        console.log(`🔄 Trying to switch to selected network (Chain ID: ${chainId})...`);
        await switchToChain(chainId);
      }
    } catch (err) {
      console.error('Error checking current network:', err);
    }
  };

  const switchToChain = async (targetChainId: number) => {
    if (!window.ethereum) return;

    const chainIdHex = `0x${targetChainId.toString(16)}`;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } catch (err: any) {
      // Chain not added to MetaMask
      if (err?.code === 4902 && targetChainId === 11155111) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: chainIdHex,
                chainName: 'Sepolia Test Network',
                nativeCurrency: {
                  name: 'Sepolia ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['https://rpc.sepolia.org'],
                blockExplorerUrls: ['https://sepolia.etherscan.io'],
              },
            ],
          });

          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }],
          });
          return;
        } catch (addError) {
          console.error('Error adding Sepolia network:', addError);
          throw addError;
        }
      }

      console.error('Error switching network:', err);
      throw err;
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

    // Check if wallet is on the correct network
    const currentWalletChainId = walletChainId ?? activeChain?.id;

    if (typeof currentWalletChainId === 'number' && currentWalletChainId !== chainId) {
      const expectedNetwork = currentNetwork?.name || `Chain ID: ${chainId}`;
      const currentWalletNetwork = activeChain?.name || `Chain ID: ${currentWalletChainId}`;

      setError(`⚠️ Your wallet is on ${currentWalletNetwork}, but you selected ${expectedNetwork}.\n\nPlease switch your wallet to ${expectedNetwork} in MetaMask.`);
      return;
    }

    // Validate Smart Account address
    if (!smartAccountAddress || smartAccountAddress.length !== 42 || !smartAccountAddress.startsWith('0x')) {
      setError('Invalid Smart Account address');
      return;
    }

    setIsDepositing(true);
    setError(null);
    setTxHash(null);

    try {
      // IMPORTANT: Always deposit to the SMART ACCOUNT, not the session key!
      // The smart account is a contract that holds the funds
      // The session key only signs transactions on behalf of the smart account
      const depositAddress = smartAccountAddress;

      console.log('💰 Depositing to Smart Account (Account Abstraction)...');
      console.log('From (your wallet):', account.address);
      console.log('To (Smart Account - contract):', depositAddress);
      console.log('Authorized signer (Session Key):', sessionKeyAddress);
      console.log('Amount:', amount, nativeToken.symbol);
      console.log('Network:', currentNetwork.name);
      console.log('Chain ID:', chainId);

      // Native token transfer
      console.log('🔄 Making native token transfer...', { chainId });

      const transaction = prepareTransaction({
        to: depositAddress as Address,
        value: toWei(amount),
        chain: defineChain(chainId),
        client,
      });

      const result = await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Native token deposit completed!');
      console.log('Transaction Hash:', result.transactionHash);
      setTxHash(result.transactionHash);

      // Scroll to success message
      setTimeout(() => {
        const successElement = document.querySelector('.bg-green-500\\/10');
        if (successElement) {
          successElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

      // After successful deposit to smart account, show session key funding step
      setTimeout(() => {
        setShowSessionKeyStep(true);
      }, 2000);
    } catch (err: any) {
      console.error('❌ Error depositing:', err);

      // Parse error message for better user experience
      let errorMessage = 'Error making deposit. Please try again.';
      
      if (err.message) {
        if (err.message.includes('insufficient funds') || err.message.includes('transfer amount exceeds balance')) {
          errorMessage = `❌ Insufficient balance on ${currentNetwork?.name}!\n\nYou don't have ${amount} ${nativeToken.symbol} available in your wallet.\n\nPlease:\n• Add funds to your wallet\n• Or try a smaller amount`;
        } else if (err.message.includes('user rejected')) {
          errorMessage = 'Transaction cancelled by user.';
        } else if (err.message.includes('gas')) {
          errorMessage = 'Gas error. Try increasing the gas limit or check your connection.';
        } else if (err.message.includes('network')) {
          errorMessage = 'Network error. Check your connection and try again.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsDepositing(false);
    }
  };

  // Calculate estimated gas needed for session key based on planned trades
  const calculateSessionKeyGas = useMemo(() => {
    // Estimated gas per DCA trade on Ethereum mainnet
    // Based on Account Abstraction UserOp: ~0.0002 ETH per trade
    const gasPerTrade = 0.0002;

    // Add 20% buffer for safety
    const buffer = 1.2;

    const totalGas = plannedTrades * gasPerTrade * buffer;

    return {
      gasPerTrade,
      totalGas: totalGas.toFixed(6),
      breakdown: `${plannedTrades} trades × ${gasPerTrade} ETH + 20% buffer`
    };
  }, [plannedTrades]);

  // Deposit ETH from Smart Account to Session Key
  const handleDepositToSessionKey = async () => {
    if (!account || !sessionKeyAddress) {
      setError('Session key address not found');
      return;
    }

    // Validate session key address
    if (!sessionKeyAddress || sessionKeyAddress.length !== 42 || !sessionKeyAddress.startsWith('0x')) {
      setError('Invalid session key address');
      return;
    }

    setIsDepositingToSessionKey(true);
    setError(null);
    setSessionKeyTxHash(null);

    try {
      const depositAmount = calculateSessionKeyGas.totalGas;

      console.log('💰 Depositing to Session Key...');
      console.log('From (Smart Account):', smartAccountAddress);
      console.log('To (Session Key):', sessionKeyAddress);
      console.log('Amount:', depositAmount, 'ETH');
      console.log('Planned trades:', plannedTrades);

      // Transfer ETH from current wallet to session key
      // Note: This transfers from the user's wallet, not the smart account
      // In a production environment, you might want to implement a way to transfer from smart account
      const transaction = prepareTransaction({
        to: sessionKeyAddress as Address,
        value: toWei(depositAmount),
        chain: defineChain(chainId),
        client,
      });

      const result = await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Session Key deposit completed!');
      console.log('Transaction Hash:', result.transactionHash);
      setSessionKeyTxHash(result.transactionHash);

      // Close modal after 5 seconds
      setTimeout(() => {
        setAmount('0.01');
        setShowSessionKeyStep(false);
        onClose();
      }, 5000);
    } catch (err: any) {
      console.error('❌ Error depositing to session key:', err);

      let errorMessage = 'Error depositing to session key. Please try again.';

      if (err.message) {
        if (err.message.includes('insufficient funds')) {
          errorMessage = `❌ Insufficient balance!\n\nYou don't have ${calculateSessionKeyGas.totalGas} ETH available.\n\nPlease add funds to your wallet.`;
        } else if (err.message.includes('user rejected')) {
          errorMessage = 'Transaction cancelled by user.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setIsDepositingToSessionKey(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center px-2 sm:px-4 py-4 sm:py-6">
        <div className="w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl border border-pano-border/60 bg-pano-surface shadow-2xl shadow-black/40">
          <div className="flex items-start justify-between border-b border-pano-border/40 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-pano-text-primary">Deposit funds</h2>
              <p className="text-[10px] sm:text-xs text-pano-text-muted">
                Add balance to the smart wallet.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-pano-border-subtle bg-pano-surface-elevated p-1.5 sm:p-2 text-pano-text-muted transition-colors hover:text-pano-text-primary flex-shrink-0 ml-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-3 sm:space-y-5 px-4 sm:px-6 py-4 sm:py-5">
            {/* Session Key Funding Step */}
            {showSessionKeyStep && sessionKeyAddress ? (
              <>
                <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm">
                  <h3 className="font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Fund Your Session Key
                  </h3>
                  <p className="text-xs text-pano-text-muted mb-3">
                    To execute DCA trades automatically, the session key needs ETH to pay for gas.
                    Let&apos;s calculate how much you need based on the number of planned trades.
                  </p>
                </div>

                <div className="rounded-lg border border-pano-border-subtle bg-pano-surface px-4 py-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-pano-text-primary">How many DCA trades do you plan to execute?</label>
                    <div className="mt-2 flex gap-2 items-center">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={plannedTrades}
                        onChange={(e) => setPlannedTrades(parseInt(e.target.value) || 1)}
                        className="flex-1 rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-4 py-3 text-sm text-pano-text-primary focus:outline-none focus:ring-2 focus:ring-pano-primary/40"
                        placeholder="5"
                        disabled={isDepositingToSessionKey}
                      />
                      <div className="text-sm text-pano-text-muted">trades</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[5, 10, 20, 50].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPlannedTrades(preset)}
                        disabled={isDepositingToSessionKey}
                        className="rounded-md border border-pano-border-subtle px-3 py-1.5 text-xs text-pano-text-secondary transition-colors hover:border-pano-primary/60 hover:text-pano-text-primary disabled:opacity-50"
                      >
                        {preset} trades
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/5 px-4 py-4 space-y-3">
                  <h4 className="text-sm font-semibold text-pano-text-primary">Estimated Gas Calculation</h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-black/20">
                      <span className="text-pano-text-muted">Gas per trade</span>
                      <span className="font-semibold text-pano-text-primary">
                        {calculateSessionKeyGas.gasPerTrade} ETH
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-black/20">
                      <span className="text-pano-text-muted">Number of trades</span>
                      <span className="font-semibold text-pano-text-primary">
                        {plannedTrades}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-black/20">
                      <span className="text-pano-text-muted">Safety buffer</span>
                      <span className="font-semibold text-pano-text-primary">
                        +20%
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 px-3 rounded bg-cyan-500/20 border border-cyan-500/30">
                      <span className="text-cyan-400 font-semibold">Total required</span>
                      <span className="font-bold text-cyan-400 text-base">
                        {calculateSessionKeyGas.totalGas} ETH
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-pano-text-muted">
                    {calculateSessionKeyGas.breakdown}
                  </p>
                </div>

                <div className="rounded-lg border border-pano-border-subtle bg-pano-surface px-4 py-3 text-xs space-y-2">
                  <p className="font-medium text-pano-text-primary">Why does the session key need funds?</p>
                  <ul className="space-y-1 text-pano-text-muted list-disc list-inside">
                    <li>The session key signs transactions automatically without popup</li>
                    <li>It pays for transaction gas with its own balance</li>
                    <li>Trade funds stay in the Smart Account (secure)</li>
                    <li>You can recover unused ETH later</li>
                  </ul>
                </div>

                {sessionKeyTxHash && (
                  <div className="rounded-lg border border-pano-success/40 bg-pano-success/10 px-4 py-4 text-sm text-pano-success space-y-2">
                    <div className="flex items-center gap-2 font-medium">
                      <span className="text-lg">✅</span>
                      Session key funded successfully!
                    </div>
                    <a
                      className="block truncate text-xs font-mono text-pano-text-primary hover:text-pano-primary"
                      href={getExplorerUrl(chainId, sessionKeyTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {sessionKeyTxHash}
                    </a>
                    <p className="text-[11px] text-pano-text-muted">
                      Now you can execute up to {plannedTrades} DCA trades automatically!
                    </p>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-pano-error/40 bg-pano-error/10 px-4 py-3 text-sm text-pano-error">
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-3 md:flex-row">
                  <Button
                    variant="ghost"
                    size="md"
                    fullWidth
                    onClick={() => {
                      setShowSessionKeyStep(false);
                      onClose();
                    }}
                    disabled={isDepositingToSessionKey}
                  >
                    Skip (do later)
                  </Button>

                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    onClick={handleDepositToSessionKey}
                    disabled={isDepositingToSessionKey || !sessionKeyAddress || plannedTrades < 1}
                    loading={isDepositingToSessionKey}
                  >
                    Deposit {calculateSessionKeyGas.totalGas} ETH
                  </Button>
                </div>
              </>
            ) : (
              <>
            {activeChain && activeChain.id !== chainId && (
              <div className="rounded-lg border border-pano-warning/40 bg-pano-warning/10 px-3 py-2 text-[11px] text-pano-warning">
                Your wallet is on {activeChain.name || 'another network'}. Switch to {currentNetwork?.name || `Chain ID ${chainId}`} before continuing.
              </div>
            )}

            <div className="rounded-lg border border-pano-border-subtle bg-pano-surface px-4 py-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-pano-text-primary">Smart Account (Account Abstraction)</p>
                  <p className="text-xs text-pano-text-muted">
                    Funds are stored in the smart account contract, not in the session key.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const explorerUrls: Record<number, string> = {
                      1: 'https://etherscan.io/address/',
                      8453: 'https://basescan.org/address/',
                      42161: 'https://arbiscan.io/address/',
                      10: 'https://optimistic.etherscan.io/address/',
                      137: 'https://polygonscan.com/address/',
                      43114: 'https://snowtrace.io/address/',
                      11155111: 'https://sepolia.etherscan.io/address/',
                    };
                    const explorerUrl = (explorerUrls[chainId] || 'https://etherscan.io/address/') + smartAccountAddress;
                    window.open(explorerUrl, '_blank');
                  }}
                  className="text-xs text-pano-text-accent hover:text-pano-primary"
                >
                  View explorer
                </Button>
              </div>

              <div className="grid gap-2 text-xs text-pano-text-muted">
                <div className="flex items-center justify-between gap-3">
                  <span>Name</span>
                  <span className="font-mono text-pano-text-primary">{smartAccountName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Smart Account (contract)</span>
                  <span className="font-mono text-pano-text-primary">
                    {smartAccountAddress
                      ? `${smartAccountAddress.slice(0, 6)}...${smartAccountAddress.slice(-4)}`
                      : 'Loading...'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Session Key (signer)</span>
                  <span className="font-mono text-pano-text-primary">
                    {sessionKeyAddress
                      ? `${sessionKeyAddress.slice(0, 6)}...${sessionKeyAddress.slice(-4)}`
                      : 'Loading...'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Selected network</span>
                  <span className="font-medium text-pano-text-primary">
                    {currentNetwork?.name || `Chain ID: ${chainId}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-pano-text-secondary">Network</label>
                <select
                  value={chainId}
                  onChange={(e) => setChainId(Number(e.target.value))}
                  disabled={isDepositing}
                  className="w-full rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-3 py-2 text-sm text-pano-text-primary focus:outline-none focus:ring-2 focus:ring-pano-primary/40 disabled:opacity-50"
                >
                  {networks.map((network) => (
                    <option key={network.chainId} value={network.chainId}>
                      {network.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-pano-text-secondary">Token</label>
                <div className="w-full flex items-center gap-2 px-4 py-3 rounded-lg border border-pano-border-subtle bg-pano-surface-elevated">
                  <div className="flex items-center gap-2">
                    {nativeToken.icon && (
                      <img
                        src={nativeToken.icon}
                        alt={nativeToken.symbol}
                        className="w-6 h-6 rounded-full"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                        }}
                      />
                    )}
                    <div className="text-left">
                      <div className="text-sm font-medium text-pano-text-primary">{nativeToken.symbol}</div>
                      <div className="text-xs text-pano-text-muted">{nativeToken.name}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-pano-border-subtle bg-pano-surface px-4 py-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-pano-text-primary">Amount to deposit</label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0.000001"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1 rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-4 py-3 text-sm text-pano-text-primary focus:outline-none focus:ring-2 focus:ring-pano-primary/40 disabled:opacity-50"
                    placeholder="0.01"
                    disabled={isDepositing}
                  />
                  <div className="flex items-center rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-4 text-sm font-medium text-pano-text-muted">
                    {nativeToken.symbol}
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-pano-text-muted">
                  This amount will be transferred directly from your wallet to the smart wallet.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {["0.001", "0.005", "0.01"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    disabled={isDepositing}
                    className="rounded-md border border-pano-border-subtle px-3 py-1.5 text-xs text-pano-text-secondary transition-colors hover:border-pano-primary/60 hover:text-pano-text-primary disabled:opacity-50"
                  >
                    {preset} {nativeToken.symbol}
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-3 py-2 text-xs text-pano-text-secondary">
                <div className="flex items-center justify-between gap-2">
                  <span>Available balance</span>
                  <div className="flex items-center gap-2 text-pano-text-primary">
                    {isCheckingBalance ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border border-pano-primary border-t-transparent" />
                        Checking...
                      </span>
                    ) : (
                      <>
                        <span className="font-medium">
                          {walletBalance} {nativeToken.symbol}
                        </span>
                        <button
                          type="button"
                          onClick={checkWalletBalance}
                          className="text-pano-text-muted hover:text-pano-primary transition-colors"
                          disabled={isCheckingBalance}
                          title="Refresh balance"
                        >
                          ↻
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-pano-text-muted">
                  Reserve a fraction of {nativeToken.symbol} to pay gas for this and future transactions.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-pano-warning/40 bg-pano-warning/10 px-4 py-3 text-[11px] text-pano-warning">
              To avoid gas errors, leave at least 0.001 {nativeToken.symbol} available after the deposit.
            </div>

            {txHash && (
              <div className="rounded-lg border border-pano-success/40 bg-pano-success/10 px-4 py-4 text-sm text-pano-success space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <span className="text-lg">✅</span>
                  Deposit confirmed! The smart account now has balance.
                </div>
                <a
                  className="block truncate text-xs font-mono text-pano-text-primary hover:text-pano-primary"
                  href={getExplorerUrl(chainId, txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {txHash}
                </a>
                <p className="text-[11px] text-pano-text-muted">
                  This modal will close automatically shortly.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-pano-error/40 bg-pano-error/10 px-4 py-3 text-sm text-pano-error space-y-2">
                <span>{error}</span>
                {error.includes('Unsupported network') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (window.ethereum) {
                        window.ethereum.request({
                          method: 'wallet_switchEthereumChain',
                          params: [{ chainId: '0x1' }],
                        });
                      }
                    }}
                    className="w-fit text-xs"
                  >
                    Switch to Ethereum Mainnet
                  </Button>
                )}
              </div>
            )}

            <div className="rounded-lg border border-pano-border-subtle bg-pano-surface px-4 py-3 text-[11px] text-pano-text-muted">
              After the deposit, the smart wallet can be used in automated flows without requiring new signatures.
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <Button
                variant="ghost"
                size="md"
                fullWidth
                onClick={onClose}
                disabled={isDepositing}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={handleDeposit}
                disabled={isDepositing || !account || !amount || parseFloat(amount) <= 0 || isWrongNetwork}
                loading={isDepositing}
              >
                {isWrongNetwork
                  ? `Switch to ${currentNetwork?.name || 'correct network'}`
                  : `Deposit ${amount} ${nativeToken.symbol}`}
              </Button>
            </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
