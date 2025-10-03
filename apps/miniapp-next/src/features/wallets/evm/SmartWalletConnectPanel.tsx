import React, { useMemo, useState } from 'react';
import { ConnectButton, useActiveAccount, useActiveWallet, useDisconnect } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { signLoginPayload } from 'thirdweb/auth';

import { Button, Card } from '../../../shared/ui';

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

  const clientId = (import.meta as any).env?.VITE_THIRDWEB_CLIENT_ID as string | undefined;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);

  // Verificar se já está autenticado via JWT
  const addressFromToken = useMemo(() => getAddressFromToken(), []);
  const isAlreadyAuthenticated = !!addressFromToken;

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
          {client && (
            <ConnectButton
              client={client}
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
              Pronto para executar transações
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => wallet && disconnect(wallet)}
            style={{ padding: '8px 16px', fontSize: 14 }}
          >
            Desconectar
          </Button>
        </div>
        
        {/* Botão para ir para o swap */}
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            // Navegar para a página de swap
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('page', 'swap');
            window.location.href = currentUrl.toString();
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
        {client && (
          <ConnectButton
            client={client}
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
      </div>
    </Card>
  );
}
