/**
 * Hook para usar Session Keys com Thirdweb Smart Accounts
 *
 * Session Keys permitem que aplicações executem transações automaticamente
 * dentro de limites predefinidos, sem necessidade de aprovação manual.
 */

import { useCallback, useEffect, useState } from 'react';
import { Account, PreparedTransaction } from 'thirdweb';
import { sendTransaction } from 'thirdweb';
import { privateKeyToAccount } from 'thirdweb/wallets';

interface SessionKeyData {
  privateKey: string;
  address: string;
  smartAccountAddress: string;
  expiresAt: number;
}

export function useSessionKey() {
  const [sessionKey, setSessionKey] = useState<SessionKeyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar session key do localStorage
  useEffect(() => {
    const loadSessionKey = () => {
      try {
        const stored = localStorage.getItem('dca_session_key');
        if (stored) {
          const data = JSON.parse(stored) as SessionKeyData;

          // Verificar se não expirou
          if (Date.now() < data.expiresAt) {
            setSessionKey(data);
          } else {
            // Remover se expirou
            localStorage.removeItem('dca_session_key');
          }
        }
      } catch (error) {
        console.error('Error loading session key:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSessionKey();
  }, []);

  // Salvar session key
  const saveSessionKey = useCallback((data: SessionKeyData) => {
    localStorage.setItem('dca_session_key', JSON.stringify(data));
    setSessionKey(data);
  }, []);

  // Remover session key
  const removeSessionKey = useCallback(() => {
    localStorage.removeItem('dca_session_key');
    setSessionKey(null);
  }, []);

  // Criar account do Thirdweb a partir da session key
  const getSessionAccount = useCallback((client: any): Account | null => {
    if (!sessionKey) return null;

    try {
      // Criar account a partir da private key
      const account = privateKeyToAccount({
        client,
        privateKey: sessionKey.privateKey,
      });

      return account;
    } catch (error) {
      console.error('Error creating session account:', error);
      return null;
    }
  }, [sessionKey]);

  // Executar transação com session key (sem popup de aprovação!)
  const executeWithSessionKey = useCallback(
    async (client: any, transaction: PreparedTransaction) => {
      if (!sessionKey) {
        throw new Error('No session key available');
      }

      const account = getSessionAccount(client);
      if (!account) {
        throw new Error('Failed to create session account');
      }

      // Enviar transação automaticamente sem aprovação manual!
      const result = await sendTransaction({
        transaction,
        account,
      });

      return result;
    },
    [sessionKey, getSessionAccount]
  );

  return {
    sessionKey,
    isLoading,
    hasSessionKey: !!sessionKey,
    saveSessionKey,
    removeSessionKey,
    getSessionAccount,
    executeWithSessionKey,
  };
}
