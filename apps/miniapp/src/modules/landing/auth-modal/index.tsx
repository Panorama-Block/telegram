'use client'

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { ConnectButton, useActiveAccount, useActiveWallet, useDisconnect } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { signLoginPayload } from 'thirdweb/auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import zicoBlue from '../../../../public/icons/zico_blue.svg';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const router = useRouter();
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const client = useMemo(() => {
    const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || undefined;
    if (!clientId) {
      console.warn('No THIRDWEB_CLIENT_ID found')
      return null;
    }
    try {
      return createThirdwebClient({ clientId });
    } catch (err) {
      console.error('Failed to create thirdweb client', err);
      return null;
    }
  }, []);

  const wallets = useMemo(() => {
    if (typeof window === 'undefined') return [inAppWallet()];
    const WebApp = (window as any).Telegram?.WebApp;
    const isTelegram = !!WebApp;
    const isiOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const mode = isTelegram ? 'redirect' : 'popup';
    const redirectUrl = isTelegram ? `${window.location.origin}/miniapp/auth/callback` : undefined;

    if (isiOS) {
      return [
        inAppWallet({
          auth: {
            options: ['email', 'passkey', 'guest'],
            mode,
            redirectUrl,
          },
        }),
      ];
    }
    return [
      inAppWallet({ auth: { options: ['google', 'telegram', 'email'], mode, redirectUrl } }),
      createWallet('io.metamask', { preferDeepLink: true }),
    ];
  }, []);

  const openGoogleInBrowser = useCallback(() => {
    try {
      const WebApp = (window as any).Telegram?.WebApp;
      const url = `${window.location.origin}/miniapp/auth/external?strategy=google`;
      if (WebApp?.openLink) {
        WebApp.openLink(url, { try_instant_view: false });
      } else {
        window.open(url, '_blank');
      }
    } catch {
      window.open(`${window.location.origin}/miniapp/auth/external?strategy=google`, '_blank');
    }
  }, []);

  const authenticateWithBackend = useCallback(async () => {
    if (!account || !client) {
      return;
    }

    const authApiBase = process.env.VITE_AUTH_API_BASE || 'http://localhost:3001';

    try {
      setIsAuthenticating(true);
      setError(null);

      // 1. Obter payload do backend
      const normalizedAddress = account.address;
      const loginPayload = { address: normalizedAddress };

      console.log('🔍 [AUTH MODAL] Autenticando com:', authApiBase);

      const loginResponse = await fetch(`${authApiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginPayload)
      });

      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        throw new Error(error.error || 'Erro ao gerar payload');
      }

      const { payload } = await loginResponse.json();

      // Verificar se os endereços batem
      if (account.address.toLowerCase() !== payload.address.toLowerCase()) {
        throw new Error(`Endereço da wallet (${account.address}) não confere com o payload (${payload.address})`);
      }

      // 2. Assinar payload usando Thirdweb
      let signature;

      try {
        const signResult = await signLoginPayload({
          account: account,
          payload: payload
        });

        if (typeof signResult === 'string') {
          signature = signResult;
        } else if (signResult && signResult.signature) {
          signature = signResult.signature;
        } else if (signResult && typeof signResult === 'object') {
          const possibleSignature = signResult.signature || (signResult as any).sig || (signResult as any).signatureHex;
          if (possibleSignature) {
            signature = possibleSignature;
          } else {
            throw new Error('Formato de assinatura inválido - nenhuma assinatura encontrada');
          }
        } else {
          throw new Error('Formato de assinatura inválido');
        }

      } catch (error) {
        console.error('❌ [AUTH MODAL] Erro na assinatura via Thirdweb:', error);

        // Fallback para método direto se signLoginPayload falhar
        try {
          if (activeWallet && typeof (activeWallet as any).signMessage === 'function') {
            const messageToSign = JSON.stringify(payload);
            signature = await (activeWallet as any).signMessage({ message: messageToSign });
          } else {
            throw new Error('Método de assinatura não disponível');
          }
        } catch (fallbackError) {
          console.error('❌ [AUTH MODAL] Fallback também falhou:', fallbackError);
          throw new Error(`Erro na assinatura: ${error}. Fallback: ${fallbackError}`);
        }
      }

      // 3. Verificar assinatura no backend
      const verifyPayload = { payload, signature };

      const verifyResponse = await fetch(`${authApiBase}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyPayload)
      });

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        throw new Error(error.error || 'Erro na verificação');
      }

      const verifyResult = await verifyResponse.json();
      const { token: authToken } = verifyResult;

      // 4. Salvar dados de autenticação
      localStorage.setItem('authPayload', JSON.stringify(payload));
      localStorage.setItem('authSignature', signature);
      localStorage.setItem('authToken', authToken);

      setIsAuthenticated(true);

      console.log('✅ [AUTH MODAL] Autenticação bem-sucedida! Redirecionando para /chat...');

      // 5. Redirecionar para /chat após pequeno delay
      setTimeout(() => {
        router.push('/chat');
      }, 500);

    } catch (err: any) {
      console.error('❌ [AUTH MODAL] Authentication failed:', err);

      let errorMessage = err?.message || 'Falha na autenticação';

      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        errorMessage = `Erro de conexão com ${authApiBase}. Verifique se o servidor está rodando e acessível.`;
      }

      setError(errorMessage);
      setIsAuthenticated(false);
    } finally {
      setIsAuthenticating(false);
    }
  }, [account, client, activeWallet, router]);

  // Autenticação automática quando a conta estiver conectada
  useEffect(() => {
    if (account && client && !isAuthenticated && !isAuthenticating) {
      authenticateWithBackend();
    }
  }, [account, client, isAuthenticated, isAuthenticating, authenticateWithBackend]);

  async function handleDisconnect() {
    setError(null);
    try {
      if (activeWallet) {
        await disconnect(activeWallet);
      }
      setIsAuthenticated(false);
      localStorage.removeItem('authToken');
      localStorage.removeItem('authPayload');
      localStorage.removeItem('authSignature');
    } catch (err: any) {
      console.error('wallet disconnect failed', err);
      setError(err?.message || 'Failed to disconnect');
    }
  }

  const connected = Boolean(account?.address);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#0d1117] border border-cyan-500/30 rounded-2xl p-8 max-w-md w-full mx-4 shadow-xl shadow-cyan-500/10">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <Image
              src={zicoBlue}
              alt="Zico"
              width={80}
              height={80}
              className="w-20 h-20"
            />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-gray-400 text-sm">
            Get started with AI-powered DeFi tools
          </p>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {typeof window !== 'undefined' && (window as any).Telegram?.WebApp && /iPhone|iPad|iPod/i.test(navigator.userAgent) && (
            <div className="text-yellow-300/90 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
              On iOS (Telegram), Google blocks sign-in inside webviews. Use Email/Passkey or
              <button
                onClick={openGoogleInBrowser}
                className="ml-1 underline text-yellow-300 hover:text-yellow-200"
              >
                open in browser
              </button>
              .
            </div>
          )}
          {!connected ? (
            client ? (
              <ConnectButton
                client={client}
                wallets={wallets}
                connectModal={{ size: 'compact' }}
                connectButton={{
                  label: 'Connect Wallet',
                  style: {
                    width: '100%',
                    padding: '16px 24px',
                    borderRadius: 12,
                    fontWeight: 600,
                    fontSize: 16,
                    background: '#06b6d4',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                  },
                }}
                theme="dark"
              />
            ) : (
              <div className="text-red-400 text-sm p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                Missing THIRDWEB client configuration.
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div className="border border-cyan-500/30 bg-[#1a1a1a] rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Connected wallet</p>
                <p className="font-mono text-sm text-cyan-400 font-semibold">
                  {shortAddress(account!.address)}
                </p>
                <div className="text-sm mt-2">
                  {isAuthenticating ? (
                    <div className="flex items-center gap-2 text-cyan-400">
                      <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </div>
                  ) : isAuthenticated ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Authenticated! Redirecting...</span>
                    </div>
                  ) : (
                    <span className="text-gray-400">Waiting for authentication</span>
                  )}
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                className="w-full px-4 py-3 rounded-lg bg-transparent text-red-400 border border-red-400 hover:bg-red-500/10 transition-all font-medium"
              >
                Disconnect
              </button>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
