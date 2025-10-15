/**
 * Modal para depositar fundos na Smart Account
 */

'use client';

import React, { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { sendTransaction, prepareTransaction, toWei } from 'thirdweb';
import { createThirdwebClient } from 'thirdweb';
import { avalancheFuji } from 'thirdweb/chains';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  smartAccountAddress: string;
  smartAccountName: string;
}

export default function DepositModal({
  isOpen,
  onClose,
  smartAccountAddress,
  smartAccountName,
}: DepositModalProps) {
  const account = useActiveAccount();
  const [amount, setAmount] = useState('0.01');
  const [isDepositing, setIsDepositing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID || '' });

  const handleDeposit = async () => {
    if (!account) {
      setError('Conecte sua carteira primeiro!');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Digite um valor válido maior que 0');
      return;
    }

    setIsDepositing(true);
    setError(null);
    setTxHash(null);

    try {
      console.log('💰 Depositando na Smart Account...');
      console.log('De (sua carteira):', account.address);
      console.log('Para (Smart Account):', smartAccountAddress);
      console.log('Valor:', amount, 'AVAX');

      // Preparar transação de transferência
      const transaction = prepareTransaction({
        to: smartAccountAddress,
        value: toWei(amount),
        chain: avalancheFuji,
        client,
      });

      // Enviar transação (vai pedir aprovação no popup)
      const result = await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Depósito realizado!');
      console.log('Transaction Hash:', result.transactionHash);

      setTxHash(result.transactionHash);

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
                <li>• Você transfere AVAX da sua carteira para a Smart Account</li>
                <li>• A Smart Account fica com saldo próprio</li>
                <li>• Session Keys podem usar esse saldo automaticamente</li>
                <li>• Sua carteira principal fica segura!</li>
              </ul>
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
                  disabled={isDepositing}
                />
                <div className="px-4 py-3 bg-gray-800/50 border border-cyan-500/30 rounded-lg text-gray-400 font-semibold">
                  AVAX
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
                disabled={isDepositing}
                className="px-3 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-xs text-white transition-all disabled:opacity-50"
              >
                0.01 AVAX
              </button>
              <button
                onClick={() => setAmount('0.05')}
                disabled={isDepositing}
                className="px-3 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-xs text-white transition-all disabled:opacity-50"
              >
                0.05 AVAX
              </button>
              <button
                onClick={() => setAmount('0.1')}
                disabled={isDepositing}
                className="px-3 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-xs text-white transition-all disabled:opacity-50"
              >
                0.1 AVAX
              </button>
            </div>

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
                  href={`https://testnet.snowtrace.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-cyan-400 hover:text-cyan-300 break-all underline"
                >
                  {txHash}
                </a>
                <div className="text-xs text-green-400 mt-2">
                  🎉 Agora sua Smart Account tem saldo!
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
                disabled={isDepositing}
                className="flex-1 py-3 rounded-xl font-semibold border border-gray-600 text-gray-300 hover:bg-gray-800 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeposit}
                disabled={isDepositing || !account || !amount || parseFloat(amount) <= 0}
                className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDepositing ? '⏳ Depositando...' : `💰 Depositar ${amount} AVAX`}
              </button>
            </div>

            {/* Warning */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-400">
              ⚠️ Você precisará aprovar esta transação na sua carteira (popup normal).
              Depois disso, a Smart Account terá saldo para transações automáticas!
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
