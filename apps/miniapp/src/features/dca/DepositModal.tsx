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
  const [chainId, setChainId] = useState<number>(1); // Ethereum mainnet default
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [amount, setAmount] = useState('0.01');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID || '' });

  // Get current network
  const currentNetwork = useMemo(() => {
    return networks.find((n) => n.chainId === chainId);
  }, [chainId]);

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

    setIsDepositing(true);
    setError(null);
    setTxHash(null);

    try {
      console.log('💰 Depositando na Smart Account...');
      console.log('De (sua carteira):', account.address);
      console.log('Para (Smart Account):', smartAccountAddress);
      console.log('Valor:', amount, tokenInfo.symbol);
      console.log('Rede:', currentNetwork.name);

      if (isNativeToken) {
        // Native token transfer (ETH, AVAX, etc)
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

        console.log('✅ Depósito realizado!');
        console.log('Transaction Hash:', result.transactionHash);
        setTxHash(result.transactionHash);
      } else {
        // ERC20 token transfer
        const contract = getContract({
          client,
          chain: defineChain(chainId),
          address: selectedToken as Address,
        });

        // Use transfer function from ERC20 extension
        const { transfer } = await import('thirdweb/extensions/erc20');

        const transaction = transfer({
          contract,
          to: smartAccountAddress as Address,
          amount: toWei(amount),
        });

        const result = await sendTransaction({
          transaction,
          account,
        });

        console.log('✅ Depósito realizado!');
        console.log('Transaction Hash:', result.transactionHash);
        setTxHash(result.transactionHash);
      }

      // Limpar form
      setTimeout(() => {
        setAmount('0.01');
        onClose();
      }, 3000);
    } catch (err: any) {
      console.error('❌ Erro ao depositar:', err);
      setError(err.message || 'Erro ao fazer depósito. Tente novamente.');
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
            <h2 className="text-xl font-bold text-white">💰 Depositar na Smart Account</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Info */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="text-sm text-blue-400 mb-2">
                <strong>Como funciona:</strong>
              </div>
              <ul className="text-xs text-gray-300 space-y-1">
                <li>• Você transfere tokens da sua carteira para a Smart Account</li>
                <li>• A Smart Account fica com saldo próprio</li>
                <li>• Session Keys podem usar esse saldo automaticamente</li>
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
                  step="0.01"
                  min="0"
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
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2">
              <button
                onClick={() => setAmount('0.01')}
                disabled={isDepositing || isApproving}
                className="px-3 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-xs text-white transition-all disabled:opacity-50"
              >
                0.01 {tokenInfo?.symbol}
              </button>
              <button
                onClick={() => setAmount('0.1')}
                disabled={isDepositing || isApproving}
                className="px-3 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-xs text-white transition-all disabled:opacity-50"
              >
                0.1 {tokenInfo?.symbol}
              </button>
              <button
                onClick={() => setAmount('1')}
                disabled={isDepositing || isApproving}
                className="px-3 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-xs text-white transition-all disabled:opacity-50"
              >
                1 {tokenInfo?.symbol}
              </button>
            </div>

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
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="text-sm font-semibold text-green-400 mb-2">
                  ✅ Depósito realizado com sucesso!
                </div>
                <div className="text-xs text-gray-300 mb-2">
                  Transaction Hash:
                </div>
                <a
                  href={getExplorerUrl(chainId, txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-cyan-400 hover:text-cyan-300 break-all underline"
                >
                  {txHash}
                </a>
                <div className="text-xs text-green-400 mt-2">
                  🎉 Agora sua Smart Account tem saldo de {tokenInfo?.symbol || 'tokens'}!
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="text-sm text-red-400">{error}</div>
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
                  disabled={isDepositing || !account || !amount || parseFloat(amount) <= 0}
                  className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDepositing ? '⏳ Depositando...' : `💰 Depositar ${amount} ${tokenInfo?.symbol}`}
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
