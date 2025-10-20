'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { createThirdwebClient, defineChain, eth_getBalance, getRpcClient, type Address } from 'thirdweb';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { withdrawFromSmartAccount, DCAApiError } from './api';

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
  smartAccountName
}: WithdrawModalProps) {
  const account = useActiveAccount();
  const [isTestnet, setIsTestnet] = useState<boolean>(false); // Toggle between Mainnet/Testnet
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionKeyAddress, setSessionKeyAddress] = useState<string>('');
  const [availableBalance, setAvailableBalance] = useState<string>('0.000000');
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const client = useMemo(
    () => createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID || '' }),
    []
  );

  const selectedChainId = isTestnet ? 11155111 : 1;

  // Fetch session key address when modal opens
  useEffect(() => {
    const fetchSessionKey = async () => {
      if (!smartAccountAddress || !isOpen) return;

      try {
        const response = await fetch(`http://localhost:3004/dca/account/${smartAccountAddress}`);
        if (response.ok) {
          const data = await response.json();
          setSessionKeyAddress(data.sessionKeyAddress);
        }
      } catch (err) {
        console.error('Error fetching session key:', err);
      }
    };

    if (isOpen) {
      fetchSessionKey();
    }
  }, [isOpen, smartAccountAddress]);

  const fetchSessionBalance = useCallback(async () => {
    if (!sessionKeyAddress) return;

    setIsFetchingBalance(true);
    setBalanceError(null);

    try {
      const rpcClient = getRpcClient({
        client,
        chain: defineChain(selectedChainId),
      });

      const balanceWei = await eth_getBalance(rpcClient, {
        address: sessionKeyAddress as Address,
      });

      const balanceAsNumber = parseFloat(balanceWei.toString()) / Math.pow(10, 18);

      if (Number.isFinite(balanceAsNumber)) {
        setAvailableBalance(balanceAsNumber.toFixed(6));
      } else {
        setAvailableBalance('0.000000');
      }
    } catch (err) {
      console.error('Error fetching session key balance:', err);
      setAvailableBalance('0.000000');
      setBalanceError('Não foi possível carregar o saldo. Atualize para tentar novamente.');
    } finally {
      setIsFetchingBalance(false);
    }
  }, [client, sessionKeyAddress, selectedChainId]);

  useEffect(() => {
    if (isOpen && sessionKeyAddress) {
      void fetchSessionBalance();
    }
  }, [isOpen, sessionKeyAddress, fetchSessionBalance]);

  if (!isOpen) return null;

  const handleWithdraw = async () => {
    if (!account) {
      setError('Por favor, conecte sua carteira.');
      return;
    }

    const parsedAmount = parseFloat(amount);

    if (!amount || parsedAmount <= 0) {
      setError('Digite um valor válido para sacar.');
      return;
    }

    const numericBalance = parseFloat(availableBalance);
    if (!Number.isFinite(numericBalance) || numericBalance <= 0) {
      setError('Saldo indisponível para saque no momento.');
      return;
    }
    if (Number.isFinite(numericBalance) && parsedAmount >= numericBalance) {
      const recommended = Math.max(numericBalance - 0.001, 0);
      setError(
        `Saldo insuficiente após taxas de gas. Tente sacar no máximo ${recommended.toFixed(6)} ETH para deixar uma margem para o gas.`,
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('🔄 Iniciando saque...');
      console.log('De:', smartAccountAddress);
      console.log('Para:', account.address);
      console.log('Valor:', amount, 'ETH');

      const result = await withdrawFromSmartAccount({
        smartAccountAddress,
        userId: account.address,
        amount,
        chainId: selectedChainId, // Sepolia : Ethereum mainnet
      });

      if (result.success) {
        setSuccess(`✅ Saque realizado com sucesso! ${amount} ETH transferido para sua carteira.`);
        console.log('✅ TX Hash:', result.transactionHash);
        setAmount('');
        void fetchSessionBalance();
        
        // Close modal after 3 seconds
        setTimeout(() => {
          onClose();
        }, 3000);
      } else {
        setError(result.error || 'Falha ao processar saque');
      }
    } catch (e: any) {
      console.error('Erro ao sacar:', e);
      if (e instanceof DCAApiError) {
        setError(e.message);
      } else {
        setError('Erro ao processar saque. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMaxClick = () => {
    if (isFetchingBalance) return;

    const parsed = parseFloat(availableBalance);

    if (Number.isFinite(parsed) && parsed > 0) {
      const buffer = 0.001;
      const recommended = Math.max(parsed - buffer, 0);
      setAmount(recommended > 0 ? recommended.toFixed(6) : '');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-[#0d1117] border border-red-500/30 rounded-2xl w-full max-w-md">
          {/* Header */}
          <div className="border-b border-red-500/20 p-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">💸 Sacar Fundos</h2>
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
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Smart Account Info */}
            <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="text-sm text-gray-400 mb-1">🔐 Sacando de:</div>
              <div className="text-lg font-bold text-white mb-1">{smartAccountName}</div>
              <div className="text-xs text-gray-400 mb-1">Session Key Wallet (Backend-Controlled)</div>
              <div className="text-xs font-mono text-gray-500">
                {sessionKeyAddress
                  ? `${sessionKeyAddress.slice(0, 6)}...${sessionKeyAddress.slice(-4)}`
                  : 'Carregando...'
                }
              </div>
              
              <div className="mt-3 pt-3 border-t border-red-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Saldo disponível:</span>
                  <div className="flex items-center gap-2 text-red-400">
                    <span className="text-lg font-bold">
                      {isFetchingBalance ? 'Carregando...' : `${availableBalance} ETH`}
                    </span>
                    <button
                      type="button"
                      onClick={() => fetchSessionBalance()}
                      disabled={isFetchingBalance}
                      className="text-xs text-gray-400 hover:text-red-300 transition-colors disabled:opacity-50"
                      title="Atualizar saldo"
                    >
                      ↻
                    </button>
                  </div>
                </div>
                {balanceError && (
                  <div className="text-[11px] text-yellow-400 mt-1">
                    {balanceError}
                  </div>
                )}
                {!balanceError && !isFetchingBalance && (
                  <div className="text-[11px] text-gray-500 mt-1">
                    Sugestão: deixe ~0.001 ETH para cobrir taxas de gas.
                  </div>
                )}
              </div>
            </div>

            {/* Destination */}
            <div className="bg-gray-800/30 border border-green-500/20 rounded-xl p-4">
              <div className="text-sm text-gray-400 mb-1">Destino:</div>
              <div className="text-sm font-bold text-green-400 mb-1">Sua Carteira Principal</div>
              <div className="text-xs font-mono text-gray-500 break-all">
                {account?.address || 'Conecte sua carteira'}
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                💰 Valor do Saque
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0.000001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-4 py-3 pr-20 rounded-lg bg-gray-800/50 border border-red-500/30 text-white text-lg font-semibold placeholder-gray-500 focus:outline-none focus:border-red-500"
                  disabled={loading}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    onClick={handleMaxClick}
                    className="px-2 py-1 text-xs font-semibold bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                    disabled={loading}
                  >
                    MAX
                  </button>
                  <span className="text-gray-400 font-semibold">ETH</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Valor será enviado para sua carteira principal
              </p>
            </div>

            {/* Security Notice */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-xl">⚠️</span>
                <div className="text-xs text-yellow-400">
                  <strong>Atenção:</strong> Esta transação será assinada de forma segura pelo backend. 
                  Certifique-se de que o valor está correto antes de confirmar.
                </div>
              </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <span className="text-xl">❌</span>
                  <div className="text-sm text-red-400">{error}</div>
                </div>
              </div>
            )}

            {success && (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                <div className="flex items-start gap-3">
                  <span className="text-xl">✅</span>
                  <div className="text-sm text-green-400">{success}</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-3 rounded-xl font-semibold border border-gray-600 text-gray-300 hover:bg-gray-800 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleWithdraw}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-red-500 to-orange-500 text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '🔄 Processando...' : '💸 Sacar'}
              </button>
            </div>

            {/* Info */}
            <div className="text-xs text-gray-500 text-center">
              🔐 Transação assinada de forma segura no backend
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
