import React, { useMemo, useState } from 'react';
import { ConnectButton, useActiveAccount, useActiveWallet, useDisconnect } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { signLoginPayload } from 'thirdweb/auth';

import { Button, Card } from '../../../shared/ui';

function WalletIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
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

async function notifyGatewayOfAuthentication(address: string, sessionId: string, authToken: string) {
  try {
    console.log('📤 [GATEWAY] Notifying Gateway of authentication...');
    
    const urlParams = new URLSearchParams(window.location.search);
    const telegramUserId = urlParams.get('telegram_user_id');
    
    if (!telegramUserId) {
      console.warn('⚠️ [GATEWAY] No telegram_user_id found in URL parameters');
      return;
    }
    
    const gatewayBase = window.location.origin.replace(/\/+$/, '');
    const gatewayUrl = `${gatewayBase}/auth/telegram/verify`;
    
    console.log('🌐 [GATEWAY] Gateway URL:', gatewayUrl);
    console.log('👤 [GATEWAY] Telegram User ID:', telegramUserId);
    
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address,
        sessionKeyAddress: address,
        loginPayload: JSON.stringify({ 
          type: 'evm', 
          domain: 'panoramablock.com', 
          address, 
          statement: 'Login to Panorama Block platform', 
          version: '1' 
        }),
        signature: '0x' + '0'.repeat(130),
        telegram_user_id: telegramUserId,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [GATEWAY] Gateway notification failed:', response.status, errorText);
      return;
    }
    
    const result = await response.json();
    console.log('✅ [GATEWAY] Gateway notification successful:', result);
    
  } catch (err) {
    console.error('❌ [GATEWAY] Failed to notify Gateway:', err);
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
        </div>
      </Card>
    );
  }

  // Se tem conta ativa, mostrar status completo
  if (account) {
    return (
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
            onClick={() => disconnect()}
            style={{ padding: '8px 16px', fontSize: 14 }}
          >
            Desconectar
          </Button>
        </div>
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
      </div>
    </Card>
  );
}
