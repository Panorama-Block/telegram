import React, { useMemo, useState, useEffect } from 'react';
import { useActiveAccount, useActiveWallet, useDisconnect, ConnectButton } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { signLoginPayload } from 'thirdweb/auth';
import { Card, Button } from '@/shared/ui';
import { THIRDWEB_CLIENT_ID } from '../../../shared/config/thirdweb';
import { inAppWallet, createWallet } from 'thirdweb/wallets';


function WalletIcon({ size = 20, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <path
        d="M3 7.5C3 6.11929 4.11929 5 5.5 5H18.5C19.8807 5 21 6.11929 21 7.5V9.5H16C14.6193 9.5 13.5 10.6193 13.5 12C13.5 13.3807 14.6193 14.5 16 14.5H21V16.5C21 17.8807 19.8807 19 18.5 19H5.5C4.11929 19 3 17.8807 3 16.5V7.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 12L16 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Função para extrair endereço do JWT
function getAddressFromToken(): string | null {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.address || null;
  } catch {
    return null;
  }
}


export function SmartWalletConnectPanel() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [jwtToken, setJwtToken] = useState('');

  const clientId = THIRDWEB_CLIENT_ID || undefined;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);

  const wallets = useMemo(() => {
    if (typeof window === 'undefined') return [inAppWallet()];
    const isTelegram = (window as any).Telegram?.WebApp;
    const isiOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const redirectUrl = isTelegram ? `${window.location.origin}/miniapp/auth/callback` : undefined;

    if (isTelegram && isiOS) {
      return [
        inAppWallet({
          auth: {
            options: ['email', 'passkey', 'guest'],
            mode: 'redirect',
            redirectUrl,
          },
        }),
      ];
    }

    return [
      inAppWallet({
        auth: {
          options: ['google', 'telegram', 'email'],
          mode: isTelegram ? 'redirect' : 'popup',
          redirectUrl,
        },
      }),
      createWallet('io.metamask', { preferDeepLink: true }),
    ];
  }, []);

  const addressFromToken = useMemo(() => getAddressFromToken(), []);
  const isAlreadyAuthenticated = !!addressFromToken;

  useEffect(() => {
    if (account && client && !isAuthenticated && !isAuthenticating) {
      authenticateWithBackend();
    }
  }, [account, client, isAuthenticated, isAuthenticating]);

  const authenticateWithBackend = async () => {
    if (!account || !client) {
      setAuthMessage('❌ Conecte sua wallet primeiro');
      return;
    }

    try {
      setIsAuthenticating(true);
      setAuthMessage('🔄 Autenticando...');

      // 1. Obter payload do backend
      const normalizedAddress = account.address;

      const loginPayload = { address: normalizedAddress };

      const authApiBase = process.env.VITE_AUTH_API_BASE || 'http://localhost:3001';
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

      // 2. Assinar a mensagem com a wallet
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
        } else {
          throw new Error('Formato de assinatura inválido');
        }

      } catch (error) {
        console.error('❌ [AUTH AUTO] Erro na assinatura:', error);
        throw new Error(`Erro na assinatura: ${error}`);
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

      const { token: authToken, address, sessionId } = verifyResult;

      // 4. Salvar payload e assinatura no localStorage
      localStorage.setItem('authPayload', JSON.stringify(payload));
      localStorage.setItem('authSignature', signature);

      // 5. Salvar token no localStorage
      localStorage.setItem('authToken', authToken);
      setIsAuthenticated(true);
      setJwtToken(authToken);
      setAuthMessage('Autenticado com sucesso!');

    } catch (err: any) {
      console.error('❌ [AUTH AUTO] Authentication failed:', err);
      setAuthMessage(`❌ Erro: ${err.message}`);
      setIsAuthenticated(false);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Se já está autenticado e não tem conta ativa, mostrar apenas status
  if (isAlreadyAuthenticated && !account) {
    return (
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <WalletIcon size={24} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Carteira Autenticada
            </div>
            <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color, #687280)' }}>
              {shortAddress(addressFromToken)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #687280)', marginTop: 4 }}>
              Conecte para executar transações
            </div>
          </div>
          {client && !isAuthenticated && !isAuthenticating && (
            <ConnectButton
              client={client}
              wallets={wallets}
              connectModal={{
                size: 'compact',
                title: 'Conectar Carteira',
                showThirdwebBranding: false,
              }}
              connectButton={{
                label: 'Conectar',
                style: {
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                },
              }}
              theme="dark"
            />
          )}
        </div>
      </Card>
    );
  }

  // Se tem conta ativa, mostrar status completo
  if (account) {
    return (
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <WalletIcon size={24} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Carteira Conectada
            </div>
            <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color, #687280)' }}>
              {shortAddress(account.address)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #687280)', marginTop: 4 }}>
              {isAuthenticating ? 'Autenticando...' : isAuthenticated ? 'Autenticado com sucesso!' : 'Conecte para autenticar'}
            </div>
            {authMessage && (
              <div style={{ fontSize: 12, color: authMessage.includes('Autenticado com sucesso!') ? '#10b981' : '#ef4444', marginTop: 4 }}>
                {authMessage}
              </div>
            )}
            {jwtToken && (
              <div style={{ marginTop: 8, padding: 8, backgroundColor: '#f3f4f6', borderRadius: 4, fontSize: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>JWT Token:</div>
                <div style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  {jwtToken.slice(0, 50)}...
                </div>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (wallet) {
                disconnect(wallet);
              }
              setIsAuthenticated(false);
              setAuthMessage('');
              setJwtToken('');
              localStorage.removeItem('authToken');
              localStorage.removeItem('authPayload');
              localStorage.removeItem('authSignature');
            }}
            style={{ padding: '8px 16px', fontSize: 14 }}
          >
            Desconectar
          </Button>
        </div>
        
        {/* Botão para ir para o swap - só aparece se autenticado */}
        {isAuthenticated && (
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              // Navegar para a página de swap
              window.location.href = '/miniapp/swap';
            }}
            style={{ 
              width: '100%', 
              padding: '12px 20px', 
              fontSize: 16, 
              fontWeight: 600,
              backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
              color: 'var(--tg-theme-button-text-color, #ffffff)',
              border: 'none',
              borderRadius: 12,
            }}
          >
            🚀 Ir para Swap
          </Button>
        )}
      </Card>
    );
  }

  // Se não está autenticado, mostrar botão de conexão
  return (
    <Card style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ textAlign: 'center' }}>
        <WalletIcon size={32} style={{ marginBottom: 12, opacity: 0.6 }} />
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          Conectar Carteira
        </div>
        <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color, #687280)', marginBottom: 16 }}>
          Conecte sua carteira para executar transações
        </div>
        {client && !isAuthenticated && !isAuthenticating && (
          <ConnectButton
            client={client}
            wallets={wallets}
            connectModal={{
              size: 'compact',
              title: 'Conectar Carteira',
              showThirdwebBranding: false,
            }}
            connectButton={{
              label: 'Conectar Carteira',
              style: {
                width: '100%',
                padding: '12px 20px',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
              },
            }}
            theme="dark"
          />
        )}
        {isAuthenticating && (
          <div style={{ 
            width: '100%', 
            padding: '12px 20px', 
            textAlign: 'center',
            color: 'var(--tg-theme-hint-color, #687280)',
            fontSize: 14
          }}>
            🔄 Autenticando automaticamente...
          </div>
        )}
      </div>
    </Card>
  );
}
