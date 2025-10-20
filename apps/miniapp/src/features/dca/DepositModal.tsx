/**
 * Modal para depositar fundos na Smart Account
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useActiveAccount, useActiveWalletChain } from 'thirdweb/react';
import { sendTransaction, prepareTransaction, toWei, getContract, defineChain } from 'thirdweb';
import { createThirdwebClient, type Address } from 'thirdweb';
import { approve, allowance } from 'thirdweb/extensions/erc20';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { networks } from '@/features/swap/tokens';
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
  const [isTestnet, setIsTestnet] = useState<boolean>(false); // Toggle between Mainnet/Testnet
  const [chainId, setChainId] = useState<number>(1); // Ethereum mainnet default
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [amount, setAmount] = useState('0.01');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sessionKeyAddress, setSessionKeyAddress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string>('0');
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);

  const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID || '' });

  useEffect(() => {
    if (activeChain?.id != null) {
      setWalletChainId(activeChain.id);
    }
  }, [activeChain]);

  // Update chainId when testnet toggle changes
  useEffect(() => {
    setChainId(isTestnet ? 11155111 : 1); // Sepolia : Ethereum
  }, [isTestnet]);

  // Get current network (ETH Mainnet or Sepolia)
  const currentNetwork = useMemo(() => {
    const allowedNetworks = isTestnet
      ? networks.filter(n => n.chainId === 11155111) // Sepolia
      : networks.filter(n => n.chainId === 1); // Ethereum mainnet

    const found = allowedNetworks.find((n) => n.chainId === chainId);

    if (found) return found;

    // Fallback network definition with native token
    return {
      name: isTestnet ? 'Sepolia Testnet' : 'Ethereum Mainnet',
      chainId: isTestnet ? 11155111 : 1,
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      icon: '⚡',
      tokens: [
        {
          address: '0x0000000000000000000000000000000000000000',
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18,
          icon: '⚡'
        }
      ]
    };
  }, [chainId, isTestnet]);

  // Fetch session key address from smart account
  useEffect(() => {
    const fetchSessionKey = async () => {
      if (!smartAccountAddress) return;

      try {
        const response = await fetch(`http://localhost:3004/dca/account/${smartAccountAddress}`);
        if (response.ok) {
          const data = await response.json();
          setSessionKeyAddress(data.sessionKeyAddress);
          console.log('Session Key Address:', data.sessionKeyAddress);
        }
      } catch (err) {
        console.error('Error fetching session key:', err);
      }
    };

    if (isOpen) {
      fetchSessionKey();
    }
  }, [isOpen, smartAccountAddress]);

  // Set default token when network changes
  useEffect(() => {
    if (currentNetwork?.tokens && currentNetwork.tokens.length > 0) {
      setSelectedToken(currentNetwork.tokens[0].address);
    }
  }, [currentNetwork]);

  // Get selected token info
  const tokenInfo = useMemo(() => {
    if (!currentNetwork || !selectedToken) return null;
    return currentNetwork.tokens.find((t) => t.address === selectedToken);
  }, [currentNetwork, selectedToken]);

  // Check if token is native (ETH, AVAX, etc)
  const isNativeToken = useMemo(() => {
    return selectedToken === '0x0000000000000000000000000000000000000000' ||
           selectedToken === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  }, [selectedToken]);

  // Check if token is ETH (only valid on Ethereum)
  const isETH = useMemo(() => {
    return selectedToken === '0x0000000000000000000000000000000000000000' && chainId === 1;
  }, [selectedToken, chainId]);

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

      if (isNativeToken) {
        // For native tokens (ETH on Ethereum)
        console.log('🔍 Checking native token balance for:', { chainId, isETH });

        // const balance = await getBalance({
        //   client,
        //   chain: defineChain(chainId),
        //   address: activeAccount.address as Address,
        // });

        // // Convert from wei to readable format
        // const balanceInTokens = (Number(balance.value) / Math.pow(10, 18)).toFixed(6);
        // console.log('💰 Native token balance found:', balanceInTokens);
        // setWalletBalance(balanceInTokens);
      } else {
        // For ERC20 tokens (Ethereum only)
        if (chainId !== 1) {
          console.warn('ERC20 tokens only supported on Ethereum');
          setWalletBalance('0');
          return;
        }

        if (!selectedToken || selectedToken === '0x0000000000000000000000000000000000000000') {
          console.warn('No valid token selected for ERC20 balance check');
          setWalletBalance('0');
          return;
        }

        console.log('🔍 Checking ERC20 balance for token:', selectedToken, 'on Ethereum');

        // Validate token address
        if (!selectedToken || selectedToken.length !== 42 || !selectedToken.startsWith('0x')) {
          throw new Error(`Invalid token address: ${selectedToken}`);
        }

        const contract = getContract({
          client,
          chain: defineChain(1),
          address: selectedToken as Address,
        });

        const { balanceOf } = await import('thirdweb/extensions/erc20');
        const balance = await balanceOf({
          contract,
          address: activeAccount.address as Address,
        });

        console.log('🔍 Raw balance response:', balance);

        // Handle different response formats
        let balanceValue: bigint;
        if (typeof balance === 'bigint') {
          balanceValue = balance;
        } else if (balance && typeof balance === 'object') {
          // Handle object with value property
          const balanceObj = balance as any;
          if (balanceObj.value !== undefined && typeof balanceObj.value === 'bigint') {
            balanceValue = balanceObj.value;
          } else {
            console.error('Invalid balance response format:', balance);
            setWalletBalance('0');
            return;
          }
        } else {
          console.error('Invalid balance response format:', balance);
          setWalletBalance('0');
          return;
        }

        const balanceInWei = BigInt(balanceValue);
        const balanceInTokens = (Number(balanceInWei) / Math.pow(10, 18)).toFixed(6);
        
        // Validate the balance
        if (isNaN(Number(balanceInTokens))) {
          console.error('Invalid balance conversion:', { balanceValue: balanceValue.toString(), balanceInWei: balanceInWei.toString() });
          setWalletBalance('0');
          return;
        }
        
        console.log('💰 ERC20 balance found:', balanceInTokens, 'wei:', balanceInWei.toString());
        setWalletBalance(balanceInTokens);
      }
    } catch (err) {
      console.error('Error checking balance:', err);
      setWalletBalance('0');
    } finally {
      setIsCheckingBalance(false);
    }
  };

  // Check wallet balance when component mounts or chain changes
  useEffect(() => {
    if (isOpen && account && currentNetwork && selectedToken) {
      console.log('🔄 Checking balance for:', { selectedToken, chainId, isNativeToken });
      // Reset balance first
      setWalletBalance('0');
      checkWalletBalance();
    }
  }, [isOpen, account, chainId, currentNetwork, selectedToken, isNativeToken]);

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
      console.log('🔄 Rede mudou para:', newChainId);
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

      console.log('🔍 Rede atual detectada:', currentChainIdNumber);

      setWalletChainId(currentChainIdNumber);

      if (currentChainIdNumber !== chainId) {
        console.log(`🔄 Tentando mudar para a rede selecionada (Chain ID: ${chainId})...`);
        await switchToChain(chainId);
      }
    } catch (err) {
      console.error('Erro ao verificar rede atual:', err);
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
          console.error('Erro ao adicionar a rede Sepolia:', addError);
          throw addError;
        }
      }

      console.error('Erro ao mudar de rede:', err);
      throw err;
    }
  };

  // Check if approval is needed for ERC20 tokens
  useEffect(() => {
    async function checkApproval() {
      if (!account || !selectedToken || isNativeToken || !amount || parseFloat(amount) <= 0) {
        setNeedsApproval(false);
        return;
      }

      try {
        const contract = getContract({
          client,
          chain: defineChain(chainId),
          address: selectedToken as Address,
        });

        const currentAllowance = await allowance({
          contract,
          owner: account.address,
          spender: smartAccountAddress as Address,
        });

        const amountInWei = toWei(amount);
        setNeedsApproval(currentAllowance < amountInWei);
      } catch (err) {
        console.error('Error checking allowance:', err);
        setNeedsApproval(true);
      }
    }

    void checkApproval();
  }, [account, selectedToken, amount, isNativeToken, chainId, smartAccountAddress, client]);

  const handleApprove = async () => {
    if (!account || !selectedToken || isNativeToken) {
      return;
    }

    setIsApproving(true);
    setError(null);

    try {
      console.log('🔓 Aprovando token...');

      const contract = getContract({
        client,
        chain: defineChain(chainId),
        address: selectedToken as Address,
      });

      const transaction = approve({
        contract,
        spender: smartAccountAddress as Address,
        amount: toWei(amount) as any,
      });

      const result = await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Token aprovado!');
      console.log('Transaction Hash:', result.transactionHash);

      // Recheck approval status
      setNeedsApproval(false);
    } catch (err: any) {
      console.error('❌ Erro ao aprovar token:', err);
      setError(err.message || 'Erro ao aprovar token. Tente novamente.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeposit = async () => {
    if (!account) {
      setError('Conecte sua carteira primeiro!');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Digite um valor válido maior que 0');
      return;
    }

    if (!currentNetwork || !tokenInfo) {
      setError('Selecione uma rede e token válidos');
      return;
    }

    // Check if user is on a supported network (ETH Mainnet or Sepolia)
    const supportedChainIds = [1, 11155111]; // Ethereum Mainnet and Sepolia
    if (!supportedChainIds.includes(chainId)) {
      setError(`Rede não suportada! Você está na rede ${currentNetwork?.name || 'desconhecida'} (Chain ID: ${chainId}). Por favor, mude para Ethereum Mainnet (Chain ID: 1) ou Sepolia Testnet (Chain ID: 11155111).`);
      return;
    }

    // Check if wallet is on the correct network
    const currentWalletChainId = walletChainId ?? activeChain?.id;

    if (typeof currentWalletChainId === 'number' && currentWalletChainId !== chainId) {
      const expectedNetwork = isTestnet ? 'Sepolia Testnet' : 'Ethereum Mainnet';
      const currentWalletNetwork =
        activeChain?.name ||
        (currentWalletChainId === 11155111 ? 'Sepolia Testnet' : `Chain ID: ${currentWalletChainId}`);

      setError(`⚠️ Sua carteira está em ${currentWalletNetwork}, mas você selecionou ${expectedNetwork}.\n\nPor favor, troque sua carteira para ${expectedNetwork} (Chain ID: ${chainId}) no MetaMask.`);
      return;
    }

    // Validate Smart Account address
    if (!smartAccountAddress || smartAccountAddress.length !== 42 || !smartAccountAddress.startsWith('0x')) {
      setError('Endereço da Smart Account inválido');
      return;
    }

    // Balance validation removed - let wallet handle it during transaction

    // For ERC20 tokens (including WAVAX), check if approval is needed
    if (!isNativeToken && needsApproval) {
      setError('Token precisa ser aprovado primeiro. Clique em "Aprovar Token" antes de depositar.');
      return;
    }

    // Balance validation removed for ERC20 tokens - let wallet handle it

    setIsDepositing(true);
    setError(null);
    setTxHash(null);

    try {
      // Use session key address as destination instead of smart account
      const depositAddress = sessionKeyAddress || smartAccountAddress;

      console.log('💰 Depositando na Session Key Wallet...');
      console.log('De (sua carteira):', account.address);
      console.log('Para (Session Key Wallet):', depositAddress);
      console.log('Valor:', amount, tokenInfo.symbol);
      console.log('Rede:', currentNetwork.name);
      console.log('Chain ID:', chainId);
      console.log('Token Address:', selectedToken);

      if (isNativeToken) {
        // Native token transfer (ETH on Ethereum)
        console.log('🔄 Fazendo transferência de token nativo...', { chainId, isETH });

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

        console.log('✅ Depósito de token nativo realizado!');
        console.log('Transaction Hash:', result.transactionHash);
        setTxHash(result.transactionHash);

        // Scroll to success message
        setTimeout(() => {
          const successElement = document.querySelector('.bg-green-500\\/10');
          if (successElement) {
            successElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      } else {
        // ERC20 token transfer (Ethereum only)
        if (chainId !== 1) {
          throw new Error('Tokens ERC20 só são suportados na rede Ethereum');
        }

        console.log('🔄 Fazendo transferência ERC20...');

        const contract = getContract({
          client,
          chain: defineChain(1),
          address: selectedToken as Address,
        });

        // Use transfer function from ERC20 extension
        const { transfer } = await import('thirdweb/extensions/erc20');

        const amountInWei = toWei(amount);
        console.log('💰 Amount in wei:', amountInWei.toString());

        const transaction = transfer({
          contract,
          to: depositAddress as Address,
          amount: amountInWei as any,
        });

        console.log('📤 Enviando transação ERC20...');
        console.log('📋 Transaction details:', {
          to: depositAddress,
          amount: amountInWei.toString(),
          token: selectedToken
        });
        
        const result = await sendTransaction({
          transaction,
          account,
        });

        console.log('✅ Depósito ERC20 realizado!');
        console.log('Transaction Hash:', result.transactionHash);
        setTxHash(result.transactionHash);

        // Scroll to success message
        setTimeout(() => {
          const successElement = document.querySelector('.bg-green-500\\/10');
          if (successElement) {
            successElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }

      // Limpar form e fechar modal após 5 segundos
      setTimeout(() => {
        setAmount('0.01');
        onClose();
      }, 5000);
    } catch (err: any) {
      console.error('❌ Erro ao depositar:', err);
      
      // Parse error message for better user experience
      let errorMessage = 'Erro ao fazer depósito. Tente novamente.';
      
      if (err.message) {
        if (err.message.includes('insufficient funds')) {
          errorMessage = `Saldo insuficiente! Você precisa de mais ${tokenInfo?.symbol || 'tokens'} para cobrir o valor + taxas de gas.`;
        } else if (err.message.includes('user rejected')) {
          errorMessage = 'Transação cancelada pelo usuário.';
        } else if (err.message.includes('gas')) {
          errorMessage = 'Erro de gas. Tente aumentar o limite de gas ou verifique sua conexão.';
        } else if (err.message.includes('network')) {
          errorMessage = 'Erro de rede. Verifique sua conexão e tente novamente.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsDepositing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-pano-border/60 bg-pano-surface shadow-2xl shadow-black/40">
          <div className="flex items-start justify-between border-b border-pano-border/40 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-pano-text-primary">Depositar fundos</h2>
              <p className="text-xs text-pano-text-muted">
                Adicione saldo à smart wallet derivada selecionada.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-pano-border-subtle bg-pano-surface-elevated p-2 text-pano-text-muted transition-colors hover:text-pano-text-primary"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{isTestnet ? '🧪' : '🌐'}</span>
                  <div>
                    <p className="text-sm font-medium text-pano-text-primary">
                      {isTestnet ? 'Modo teste (Sepolia)' : 'Modo principal (Mainnet)'}
                    </p>
                    <p className="text-xs text-pano-text-muted">
                      {isTestnet
                        ? 'Utilize ETH de faucet para experimentar o fluxo.'
                        : 'Transações executadas na rede principal Ethereum.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTestnet(!isTestnet)}
                  className={isTestnet ? 'relative inline-flex h-6 w-12 items-center rounded-full bg-pano-primary transition-colors' : 'relative inline-flex h-6 w-12 items-center rounded-full bg-pano-border-subtle transition-colors'}
                >
                  <span
                    className={isTestnet ? 'inline-block h-4 w-4 translate-x-6 transform rounded-full bg-black transition-transform' : 'inline-block h-4 w-4 translate-x-1 transform rounded-full bg-black transition-transform'}
                  />
                </button>
              </div>
              {activeChain && activeChain.id !== chainId && (
                <div className="rounded-lg border border-pano-warning/40 bg-pano-warning/10 px-3 py-2 text-[11px] text-pano-warning">
                  Sua carteira está em {activeChain.name || 'outra rede'}. Altere para {isTestnet ? 'Sepolia Testnet' : 'Ethereum Mainnet'} antes de continuar.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-pano-border-subtle bg-pano-surface px-4 py-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-pano-text-primary">Smart wallet destino</p>
                  <p className="text-xs text-pano-text-muted">
                    Transação assinada automaticamente pela session key autorizada.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const addressToShow = sessionKeyAddress || smartAccountAddress;
                    const explorerUrl = isTestnet
                      ? 'https://sepolia.etherscan.io/address/' + addressToShow
                      : 'https://etherscan.io/address/' + addressToShow;
                    window.open(explorerUrl, '_blank');
                  }}
                  className="text-xs text-pano-text-accent hover:text-pano-primary"
                >
                  Ver explorer
                </Button>
              </div>

              <div className="grid gap-2 text-xs text-pano-text-muted">
                <div className="flex items-center justify-between gap-3">
                  <span>Conta</span>
                  <span className="font-mono text-pano-text-primary">{smartAccountName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Session key wallet</span>
                  <span className="font-mono text-pano-text-primary">
                    {sessionKeyAddress
                      ? `${sessionKeyAddress.slice(0, 6)}...${sessionKeyAddress.slice(-4)}`
                      : 'Carregando...'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Rede selecionada</span>
                  <span className="font-medium text-pano-text-primary">
                    {isTestnet ? 'Sepolia Testnet' : 'Ethereum Mainnet'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-pano-text-secondary">Rede</label>
                <select
                  value={chainId}
                  onChange={(e) => setChainId(Number(e.target.value))}
                  disabled={isDepositing || isApproving}
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
                <select
                  value={selectedToken}
                  onChange={(e) => setSelectedToken(e.target.value)}
                  disabled={isDepositing || isApproving || !currentNetwork}
                  className="w-full rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-3 py-2 text-sm text-pano-text-primary focus:outline-none focus:ring-2 focus:ring-pano-primary/40 disabled:opacity-50"
                >
                  {currentNetwork?.tokens.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-pano-border-subtle bg-pano-surface px-4 py-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-pano-text-primary">Valor para depositar</label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0.000001"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1 rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-4 py-3 text-sm text-pano-text-primary focus:outline-none focus:ring-2 focus:ring-pano-primary/40 disabled:opacity-50"
                    placeholder="0.01"
                    disabled={isDepositing || isApproving}
                  />
                  <div className="flex items-center rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-4 text-sm font-medium text-pano-text-muted">
                    {tokenInfo?.symbol || 'TOKEN'}
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-pano-text-muted">
                  Esse valor será transferido diretamente da sua carteira para a smart wallet.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {["0.001", "0.005", "0.01"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    disabled={isDepositing || isApproving}
                    className="rounded-md border border-pano-border-subtle px-3 py-1.5 text-xs text-pano-text-secondary transition-colors hover:border-pano-primary/60 hover:text-pano-text-primary disabled:opacity-50"
                  >
                    {preset} {tokenInfo?.symbol || 'ETH'}
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-3 py-2 text-xs text-pano-text-secondary">
                <div className="flex items-center justify-between gap-2">
                  <span>Saldo disponível</span>
                  <div className="flex items-center gap-2 text-pano-text-primary">
                    {isCheckingBalance ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border border-pano-primary border-t-transparent" />
                        Verificando...
                      </span>
                    ) : (
                      <>
                        <span className="font-medium">
                          {walletBalance} {tokenInfo?.symbol}
                        </span>
                        <button
                          type="button"
                          onClick={checkWalletBalance}
                          className="text-pano-text-muted hover:text-pano-primary transition-colors"
                          disabled={isCheckingBalance}
                          title="Atualizar saldo"
                        >
                          ↻
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-pano-text-muted">
                  {isNativeToken
                    ? 'Reserve uma fração de ETH para pagar o gas desta e de futuras transações.'
                    : 'O saldo considera o token ERC20 selecionado.'}
                </p>
              </div>
            </div>

            {isNativeToken && (
              <div className="rounded-lg border border-pano-warning/40 bg-pano-warning/10 px-4 py-3 text-[11px] text-pano-warning">
                Para evitar erros de gas, deixe pelo menos 0.001 ETH disponível após o depósito.
              </div>
            )}

            {needsApproval && !isNativeToken && (
              <div className="rounded-lg border border-pano-warning/40 bg-pano-warning/10 px-4 py-3 text-[11px] text-pano-warning">
                Tokens ERC20 exigem aprovação antes do depósito. Execute a aprovação e, em seguida, confirme o envio.
              </div>
            )}

            {txHash && (
              <div className="rounded-lg border border-pano-success/40 bg-pano-success/10 px-4 py-4 text-sm text-pano-success space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <span className="text-lg">✅</span>
                  Depósito confirmado! A session key já possui saldo.
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
                  Este modal será fechado automaticamente em instantes.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-pano-error/40 bg-pano-error/10 px-4 py-3 text-sm text-pano-error space-y-2">
                <span>{error}</span>
                {error.includes('Rede não suportada') && (
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
                    Ajustar para Ethereum Mainnet
                  </Button>
                )}
              </div>
            )}

            <div className="rounded-lg border border-pano-border-subtle bg-pano-surface px-4 py-3 text-[11px] text-pano-text-muted">
              Após o depósito, a smart wallet pode ser utilizada em fluxos automáticos sem exigir novas assinaturas.
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <Button
                variant="ghost"
                size="md"
                fullWidth
                onClick={onClose}
                disabled={isDepositing || isApproving}
              >
                Cancelar
              </Button>

              {needsApproval && !isNativeToken ? (
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={handleApprove}
                  disabled={isApproving || !account || !amount || parseFloat(amount) <= 0}
                  loading={isApproving}
                >
                  Aprovar {tokenInfo?.symbol}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={handleDeposit}
                  disabled={isDepositing || !account || !amount || parseFloat(amount) <= 0 || isWrongNetwork}
                  loading={isDepositing}
                >
                  {isWrongNetwork
                    ? `Troque para ${isTestnet ? 'Sepolia' : 'Mainnet'}`
                    : `Depositar ${amount} ${tokenInfo?.symbol}`}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
