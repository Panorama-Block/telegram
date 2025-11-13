/**
 * Componente para testar assinatura de mensagens com Session Key
 * Valida o uso de Account Abstraction
 */

'use client';

import React, { useState } from 'react';
import { createThirdwebClient } from 'thirdweb';
import { privateKeyToAccount } from 'thirdweb/wallets';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { useSessionKey } from './useSessionKey';

export default function SignMessageTest() {
  const { sessionKey, hasSessionKey } = useSessionKey();
  const [message, setMessage] = useState('Validando Account Abstraction com Session Key');
  const [signature, setSignature] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID || '' });

  const handleSignMessage = async () => {
    if (!hasSessionKey || !sessionKey) {
      setError('Session key não configurada. Crie uma Smart Account primeiro!');
      return;
    }

    setIsSigning(true);
    setError(null);
    setSignature(null);

    try {
      console.log('🔑 Assinando mensagem com Session Key...');
      console.log('Session Key Address:', sessionKey.address);
      console.log('Smart Account:', sessionKey.smartAccountAddress);
      console.log('Mensagem:', message);

      // Criar account a partir da session key private key
      const account = privateKeyToAccount({
        client,
        privateKey: sessionKey.privateKey,
      });

      console.log('Account criado:', account.address);

      // Assinar mensagem
      const sig = await account.signMessage({
        message,
      });

      console.log('✅ Mensagem assinada com sucesso!');
      console.log('Assinatura:', sig);

      setSignature(sig);
    } catch (err: any) {
      console.error('❌ Erro ao assinar mensagem:', err);
      setError(err.message || 'Erro ao assinar mensagem');
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-purple-500/30 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-xl font-bold text-white">✍️ Teste de Assinatura</h3>
        {hasSessionKey && (
          <span className="px-3 py-1 text-xs font-semibold bg-green-500/20 text-green-400 rounded-full">
            Session Key Ativa
          </span>
        )}
      </div>

      <p className="text-sm text-gray-400">
        Assine uma mensagem usando a Session Key da sua Smart Account. Isso valida o uso de Account Abstraction!
      </p>

      {!hasSessionKey && (
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <div className="text-sm text-yellow-400">
            ⚠️ Você precisa criar uma Smart Account primeiro para ter uma Session Key ativa.
          </div>
        </div>
      )}

      {hasSessionKey && sessionKey && (
        <>
          {/* Session Key Info */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
            <div className="text-xs text-gray-400">Session Key Information:</div>
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-gray-500">Address:</span>
                <span className="text-cyan-400">{sessionKey.address.slice(0, 10)}...{sessionKey.address.slice(-8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Smart Account:</span>
                <span className="text-purple-400">{sessionKey.smartAccountAddress.slice(0, 10)}...{sessionKey.smartAccountAddress.slice(-8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Expira em:</span>
                <span className="text-white">{new Date(sessionKey.expiresAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          </div>

          {/* Message Input */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Mensagem para assinar:
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500 resize-none"
              placeholder="Digite a mensagem que deseja assinar..."
            />
          </div>

          {/* Sign Button */}
          <button
            onClick={handleSignMessage}
            disabled={isSigning || !message.trim()}
            className="w-full py-4 rounded-xl font-semibold text-base transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-purple-500 to-pink-500 text-white"
          >
            {isSigning ? '⏳ Assinando...' : '✍️ Assinar Mensagem com Session Key'}
          </button>

          {/* Success Result */}
          {signature && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="text-sm font-semibold text-green-400 mb-3">
                ✅ Mensagem assinada com sucesso!
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Mensagem:</div>
                  <div className="text-sm text-white bg-gray-800/50 rounded p-2 break-words">
                    &ldquo;{message}&rdquo;
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Assinatura:</div>
                  <div className="text-xs font-mono text-green-400 bg-gray-800/50 rounded p-2 break-all">
                    {signature}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  🎉 Esta assinatura foi criada AUTOMATICAMENTE usando a Session Key, sem nenhum popup de aprovação!
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="text-sm text-red-400">{error}</div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
            <div className="text-sm font-semibold text-blue-400 mb-2">💡 Como usar:</div>
            <ul className="space-y-1 text-xs text-gray-300">
              <li>• A mensagem será assinada AUTOMATICAMENTE</li>
              <li>• Sem popup de aprovação!</li>
              <li>• Usa a Session Key da sua Smart Account</li>
              <li>• Perfeito para autenticação automática</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
