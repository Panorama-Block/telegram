/**
 * Modal para depositar fundos na Smart Account
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { sendTransaction, prepareTransaction, toWei, getContract, defineChain } from 'thirdweb';
import { createThirdwebClient, type Address } from 'thirdweb';
import { approve, allowance } from 'thirdweb/extensions/erc20';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { networks } from '@/features/swap/tokens';

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
    if (account?.chain?.id != null) {
      setWalletChainId(account.chain.id);
    }
  }, [account]);

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
    const currentChain = walletChainId ?? account?.chain?.id;
    if (currentChain == null) {
      return false;
    }
    return currentChain !== chainId;
  }, [walletChainId, account, chainId]);

  // Check wallet balance
  const checkWalletBalance = async () => {
    if (!account || !currentNetwork) return;

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
        //   address: account.address as Address,
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
          address: account.address as Address,
        });

        console.log('🔍 Raw balance response:', balance);

        // Handle different response formats
        let balanceValue;
        if (typeof balance === 'bigint') {
          balanceValue = balance;
        } else if (balance && typeof balance === 'object' && balance.value !== undefined) {
          balanceValue = balance.value;
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

    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
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
          chain: chainId === 43114 ? avalanche : defineChain(chainId),
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
        chain: chainId === 43114 ? avalanche : defineChain(chainId),
        address: selectedToken as Address,
      });

      const transaction = approve({
        contract,
        spender: smartAccountAddress as Address,
        amount: toWei(amount),
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
    const currentWalletChainId = walletChainId ?? account.chain?.id;

    if (typeof currentWalletChainId === 'number' && currentWalletChainId !== chainId) {
      const expectedNetwork = isTestnet ? 'Sepolia Testnet' : 'Ethereum Mainnet';
      const currentWalletNetwork =
        account.chain?.name ||
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
          amount: amountInWei,
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
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-[#0d1117] border border-cyan-500/30 rounded-2xl w-full max-w-md shadow-xl">
          {/* Header */}
          <div className="border-b border-cyan-500/20 p-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">💰 Depositar Fundos</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Network Toggle */}
          <div className="px-6 pt-6">
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{isTestnet ? '🧪' : '🌐'}</div>
                  <div>
                    <div className="text-sm font-bold text-white">
                      {isTestnet ? 'Modo Teste (Sepolia)' : 'Modo Produção (Mainnet)'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {isTestnet ? 'ETH grátis via faucet' : 'ETH real'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsTestnet(!isTestnet)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isTestnet ? 'bg-purple-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isTestnet ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Network Warning */}
              {account?.chain && account.chain.id !== chainId && (
                <div className="mt-3 pt-3 border-t border-purple-500/20">
                  <div className="text-xs text-yellow-400 mb-2">
                    ⚠️ Sua carteira está em <strong>{account.chain.name || 'rede diferente'}</strong>
                  </div>
                  <div className="text-xs text-gray-400 mb-2">
                    Para depositar, troque para <strong>{isTestnet ? 'Sepolia Testnet' : 'Ethereum Mainnet'}</strong> no MetaMask
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Smart Account Details */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-cyan-400">📊 Destino do Depósito</h3>
                <button
                  onClick={() => {
                    // Open session key wallet in explorer
                    const addressToShow = sessionKeyAddress || smartAccountAddress;
                    const explorerUrl = isTestnet
                      ? `https://sepolia.etherscan.io/address/${addressToShow}`
                      : `https://etherscan.io/address/${addressToShow}`;
                    window.open(explorerUrl, '_blank');
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Ver no Explorer
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Nome da Conta:</span>
                  <span className="text-cyan-400 font-mono">{smartAccountName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Session Key Wallet:</span>
                  <span className="text-cyan-400 font-mono">
                    {sessionKeyAddress
                      ? `${sessionKeyAddress.slice(0, 6)}...${sessionKeyAddress.slice(-4)}`
                      : 'Carregando...'
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rede:</span>
                  <span className="text-cyan-400">
                    {isTestnet ? '🧪 Sepolia Testnet' : '🌐 Ethereum Mainnet'}
                  </span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="text-sm text-blue-400 mb-2">
                <strong>🔐 Como funciona:</strong>
              </div>
              <ul className="text-xs text-gray-300 space-y-1">
                <li>• Você deposita na Session Key Wallet (controlada pelo backend)</li>
                <li>• O backend assina transações automaticamente quando necessário</li>
                <li>• Você pode sacar a qualquer momento via botão "Withdraw"</li>
                <li>• Sua carteira principal fica segura!</li>
              </ul>
            </div>

            {/* Network and Token Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">
                  Rede:
                </label>
                <select
                  value={chainId}
                  onChange={(e) => setChainId(Number(e.target.value))}
                  disabled={isDepositing || isApproving}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800/50 border border-cyan-500/30 text-white text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                >
                  {networks.map((network) => (
                    <option key={network.chainId} value={network.chainId}>
                      {network.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">
                  Token:
                </label>
                <select
                  value={selectedToken}
                  onChange={(e) => setSelectedToken(e.target.value)}
                  disabled={isDepositing || isApproving || !currentNetwork}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800/50 border border-cyan-500/30 text-white text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                >
                  {currentNetwork?.tokens.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Smart Account Info */}
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
              <div className="text-xs text-gray-400">Smart Account de Destino:</div>
              <div className="text-sm font-semibold text-cyan-400">{smartAccountName}</div>
              <div className="text-xs font-mono text-gray-500 break-all">
                {smartAccountAddress}
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Valor para depositar:
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.001"
                  min="0.000001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg bg-gray-800/50 border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-500"
                  placeholder="0.01"
                  disabled={isDepositing || isApproving}
                />
                <div className="px-4 py-3 bg-gray-800/50 border border-cyan-500/30 rounded-lg text-gray-400 font-semibold">
                  {tokenInfo?.symbol || 'TOKEN'}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Valor que será transferido da sua carteira para a Smart Account
              </p>
              
              {/* Balance display */}
              {(isNativeToken || !isNativeToken) && (
                <div className="mt-2 p-3 rounded-lg bg-gray-800/30 border border-gray-700/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Saldo disponível:</span>
                    <div className="flex items-center gap-2">
                      {isCheckingBalance ? (
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-gray-400">Verificando...</span>
                        </div>
                      ) : (
                        <>
                          <span className="text-cyan-400 font-semibold">
                            {walletBalance} {tokenInfo?.symbol}
                          </span>
                          <button
                            onClick={checkWalletBalance}
                            disabled={isCheckingBalance}
                            className="text-gray-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
                            title="Atualizar saldo"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                              <path d="M21 3v5h-5"/>
                              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                              <path d="M3 21v-5h5"/>
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {isNativeToken ? '* Certifique-se de ter saldo suficiente para o valor + taxas de gas' : '* Saldo do token ERC20'}
                  </div>
                </div>
              )}
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2">
              <button
                onClick={() => setAmount('0.001')}
                disabled={isDepositing || isApproving}
                className="px-3 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-xs text-white transition-all disabled:opacity-50"
              >
                0.001 {tokenInfo?.symbol}
              </button>
              <button
                onClick={() => setAmount('0.005')}
                disabled={isDepositing || isApproving}
                className="px-3 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-xs text-white transition-all disabled:opacity-50"
              >
                0.005 {tokenInfo?.symbol}
              </button>
              <button
                onClick={() => setAmount('0.01')}
                disabled={isDepositing || isApproving}
                className="px-3 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-xs text-white transition-all disabled:opacity-50"
              >
                0.01 {tokenInfo?.symbol}
              </button>
            </div>

            {/* Gas Fee Warning for Native Token */}
            {isNativeToken && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <div className="text-xs text-yellow-400">
                    <strong>Atenção:</strong> Você precisa ter <strong>mais ETH</strong> do que o valor do depósito para pagar as taxas de gas.
                    Se você tem 0.01 ETH, tente depositar <strong>0.001 ou 0.005 ETH</strong> para deixar ETH sobrando para o gas.
                  </div>
                </div>
              </div>
            )}

            {/* Approval needed warning */}
            {needsApproval && !isNativeToken && (
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <div className="text-sm font-semibold text-yellow-400 mb-2">
                  🔒 Aprovação Necessária
                </div>
                <div className="text-xs text-gray-300">
                  Este token ERC20 precisa ser aprovado antes do depósito. Clique em &quot;Aprovar Token&quot; primeiro.
                </div>
              </div>
            )}

            {/* Success */}
            {txHash && (
              <div className="p-5 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/50 shadow-lg shadow-green-500/20 animate-pulse">
                <div className="text-lg font-bold text-green-400 mb-3 flex items-center gap-2">
                  <span className="text-2xl">✅</span>
                  <span>Depósito realizado com sucesso!</span>
                </div>
                <div className="bg-black/30 rounded-lg p-3 mb-3">
                  <div className="text-xs text-gray-400 mb-1">Hash da transação:</div>
                  <a
                    href={getExplorerUrl(chainId, txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-cyan-400 hover:text-cyan-300 break-all underline"
                  >
                    {txHash}
                  </a>
                </div>
                <div className="text-sm text-green-300 font-semibold flex items-center gap-2">
                  <span className="text-xl">🎉</span>
                  <span>Sua Smart Account agora tem saldo de {tokenInfo?.symbol || 'tokens'}!</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  Este modal fechará automaticamente em 5 segundos...
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="text-sm text-red-400 mb-3">{error}</div>
                {error.includes('Rede não suportada') && (
                  <button
                    onClick={() => {
                      // Switch to Ethereum
                      if (window.ethereum) {
                        window.ethereum.request({
                          method: 'wallet_switchEthereumChain',
                          params: [{ chainId: '0x1' }], // 1 in hex
                        });
                      }
                    }}
                    className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs rounded-lg transition-colors"
                  >
                    🔄 Mudar para Ethereum
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isDepositing || isApproving}
                className="flex-1 py-3 rounded-xl font-semibold border border-gray-600 text-gray-300 hover:bg-gray-800 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>

              {needsApproval && !isNativeToken ? (
                <button
                  onClick={handleApprove}
                  disabled={isApproving || !account || !amount || parseFloat(amount) <= 0}
                  className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isApproving ? '⏳ Aprovando...' : `🔓 Aprovar ${tokenInfo?.symbol}`}
                </button>
              ) : (
                <button
                  onClick={handleDeposit}
                  disabled={isDepositing || !account || !amount || parseFloat(amount) <= 0 || isWrongNetwork}
                  className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isWrongNetwork
                    ? `⚠️ Troque para ${isTestnet ? 'Sepolia' : 'Mainnet'} no MetaMask`
                    : isDepositing
                    ? '⏳ Depositando...'
                    : `💰 Depositar ${amount} ${tokenInfo?.symbol}`
                  }
                </button>
              )}
            </div>

            {/* Warning */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-300">
              <div className="font-semibold mb-1">💡 Informação:</div>
              {!isNativeToken && needsApproval ? (
                <div>
                  Para tokens ERC20, você precisa aprovar primeiro e depois depositar (2 transações).
                  {' '}
                  Para tokens nativos ({currentNetwork?.name === 'Ethereum' ? 'ETH' : 'nativos'}), é apenas 1 transação.
                </div>
              ) : (
                <div>
                  Você precisará aprovar esta transação na sua carteira. Depois disso, a Smart Account terá saldo para transações automáticas!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
