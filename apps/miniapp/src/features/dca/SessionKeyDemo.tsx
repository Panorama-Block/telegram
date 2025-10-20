/**
 * Componente de demonstração de Session Keys
 * Mostra como executar transações automaticamente sem popups de aprovação
 */

'use client';

import React, { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { prepareTransaction, toWei } from 'thirdweb';
import { sepolia } from 'thirdweb/chains';
import { useSessionKey } from './useSessionKey';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';

export default function SessionKeyDemo() {
  const account = useActiveAccount();
  const {
    sessionKey,
    hasSessionKey,
    saveSessionKey,
    removeSessionKey,
    executeWithSessionKey,
  } = useSessionKey();

  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID || '' });

  // Simular salvamento de session key (em produção viria do backend após criar smart account)
  const handleCreateSessionKey = () => {
    // NOTA: Em produção, a session key vem do backend após criar a smart account
    // Este é apenas um exemplo de como armazenar
    const mockSessionKey = {
      privateKey: '0x1234...', // Viria do backend
      address: '0xSessionKeyAddress',
      smartAccountAddress: '0xSmartAccountAddress',
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 dias
    };

    saveSessionKey(mockSessionKey);
    setResult('Session key salva! Agora você pode executar transações automaticamente.');
  };

  // Exemplo: Enviar ETH sem popup de aprovação!
  const handleAutoTransfer = async () => {
    if (!hasSessionKey || !account) {
      setError('Session key não configurada ou carteira não conectada');
      return;
    }

    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      // Preparar transação
      const transaction = prepareTransaction({
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Endereço de destino
        value: toWei('0.001'), // 0.001 ETH
        chain: sepolia,
        client,
      });

      console.log('🚀 Executando transação AUTOMATICAMENTE com Session Key...');

      // Executar AUTOMATICAMENTE sem popup!
      const txResult = await executeWithSessionKey(client, transaction);

      console.log('✅ Transação executada:', txResult.transactionHash);

      setResult(`✅ Transação executada automaticamente!
Hash: ${txResult.transactionHash}
SEM POPUP DE APROVAÇÃO!`);
    } catch (err: any) {
      console.error('❌ Erro:', err);
      setError(err.message || 'Erro ao executar transação');
    } finally {
      setIsExecuting(false);
    }
  };

  // Exemplo: Assinar mensagem com session key
  const handleSignMessage = async () => {
    if (!hasSessionKey) {
      setError('Session key não configurada');
      return;
    }

    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      // Pegar account da session key
      const { getSessionAccount } = useSessionKey();
      const sessionAccount = getSessionAccount(client);

      if (!sessionAccount) {
        throw new Error('Não foi possível criar account da session key');
      }

      const message = 'Autenticando com Session Key - sem popup!';

      // Assinar com session key
      const { signMessage } = await import('thirdweb/utils');
      const signature = await signMessage({
        message,
        account: sessionAccount,
      });

      console.log('✅ Mensagem assinada:', signature);

      setResult(`✅ Mensagem assinada automaticamente!
Mensagem: "${message}"
Assinatura: ${signature.slice(0, 20)}...
SEM POPUP!`);
    } catch (err: any) {
      console.error('❌ Erro:', err);
      setError(err.message || 'Erro ao assinar mensagem');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-cyan-500/30 rounded-xl p-6 space-y-4">
      <h3 className="text-xl font-bold text-white">🔑 Session Key Demo</h3>

      {/* Status */}
      <div className={`p-4 rounded-lg border ${hasSessionKey ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-800/50 border-gray-600'}`}>
        <div className="text-sm font-semibold mb-1">
          {hasSessionKey ? '✅ Session Key Ativa' : '⚠️ Sem Session Key'}
        </div>
        {sessionKey && (
          <div className="text-xs text-gray-400 space-y-1">
            <div>Address: {sessionKey.address.slice(0, 10)}...</div>
            <div>Smart Account: {sessionKey.smartAccountAddress.slice(0, 10)}...</div>
            <div>Expira: {new Date(sessionKey.expiresAt).toLocaleDateString('pt-BR')}</div>
          </div>
        )}
      </div>

      {/* Explicação */}
      <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-4 text-sm text-gray-300">
        <p className="font-semibold text-cyan-400 mb-2">Como funciona:</p>
        <ul className="space-y-1 text-xs">
          <li>• Session Key = chave temporária com permissões limitadas</li>
          <li>• Pode assinar transações AUTOMATICAMENTE (sem popup!)</li>
          <li>• Perfeito para DCA, automações, jogos, etc.</li>
          <li>• Segura: limites de gastos + prazo de validade</li>
        </ul>
      </div>

      {/* Ações */}
      <div className="space-y-3">
        {!hasSessionKey ? (
          <button
            onClick={handleCreateSessionKey}
            className="w-full py-3 rounded-lg bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-all"
          >
            Criar Session Key (Demo)
          </button>
        ) : (
          <>
            <button
              onClick={handleAutoTransfer}
              disabled={isExecuting || !account}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExecuting ? '⏳ Executando...' : '⚡ Transferir ETH AUTOMATICAMENTE'}
            </button>

            <button
              onClick={handleSignMessage}
              disabled={isExecuting}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExecuting ? '⏳ Assinando...' : '✍️ Assinar Mensagem AUTOMATICAMENTE'}
            </button>

            <button
              onClick={removeSessionKey}
              disabled={isExecuting}
              className="w-full py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/20 transition-all disabled:opacity-50"
            >
              🗑️ Remover Session Key
            </button>
          </>
        )}
      </div>

      {/* Resultado */}
      {result && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
          <div className="text-sm text-green-400 whitespace-pre-wrap">{result}</div>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="text-sm text-red-400">{error}</div>
        </div>
      )}

      {/* Nota importante */}
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-400">
        ⚠️ <strong>NOTA:</strong> Este é um exemplo didático. Em produção:
        <ul className="mt-2 space-y-1 ml-4 list-disc">
          <li>A session key vem do backend após criar a Smart Account</li>
          <li>Use Smart Accounts reais (não mock data)</li>
          <li>Configure permissões corretas (limites de gastos, contratos aprovados)</li>
        </ul>
      </div>
    </div>
  );
}
