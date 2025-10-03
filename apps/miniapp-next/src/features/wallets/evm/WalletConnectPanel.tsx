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


export function WalletConnectPanel() {
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const client = useMemo(() => {
    const clientId = process.env.VITE_THIRDWEB_CLIENT_ID as string | undefined;
    if (!clientId) {
      return null;
    }
    try {
      return createThirdwebClient({ clientId });
    } catch (err) {
      console.error('Failed to create thirdweb client', err);
      return null;
    }
  }, []);

  const wallets = useMemo(
    () => [
      inAppWallet({ auth: { options: ['google', 'telegram'] } }),
      createWallet('io.metamask'),
    ],
    [],
  );

  // Remover autenticação automática - só autenticar quando clicar no botão

  async function authenticateWithBackend() {
    console.log('🔐 [AUTH DEBUG] authenticateWithBackend called');
    
    if (!account || !client) {
      console.log('❌ [AUTH DEBUG] Missing account or client:', { account: !!account, client: !!client });
      return;
    }

    try {
      console.log('🔄 [AUTH DEBUG] Setting isAuthenticating to true');
      setIsAuthenticating(true);
      setError(null);

      // 1. Obter payload do backend (exatamente como na página wallet)
      const normalizedAddress = account.address;
      console.log('📤 [AUTH DEBUG] Enviando endereço para backend:', normalizedAddress);
      console.log('🌐 [AUTH DEBUG] Auth API URL:', process.env.VITE_AUTH_API_BASE);
      
      const loginPayload = { address: normalizedAddress };
      console.log('📤 [AUTH DEBUG] Login payload:', loginPayload);
      
      const loginResponse = await fetch(`http://localhost:3001/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginPayload)
      });

      console.log('📡 [AUTH DEBUG] Login response status:', loginResponse.status);
      console.log('📡 [AUTH DEBUG] Login response headers:', Object.fromEntries(loginResponse.headers.entries()));

      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        console.log('❌ [AUTH DEBUG] Login error response:', errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        throw new Error(error.error || 'Erro ao gerar payload');
      }

      const { payload } = await loginResponse.json();
      console.log('✅ [AUTH DEBUG] Payload recebido:', payload);
      console.log('🔍 [AUTH DEBUG] Account address:', account.address);
      console.log('🔍 [AUTH DEBUG] Payload address:', payload.address);

      // Verificar se os endereços batem
      if (account.address.toLowerCase() !== payload.address.toLowerCase()) {
        throw new Error(`Endereço da wallet (${account.address}) não confere com o payload (${payload.address})`);
      }

      // 2. Assinar a mensagem com a wallet usando signLoginPayload (exatamente como na página wallet)
      let signature;
      
      console.log('✍️ [AUTH DEBUG] Account address para assinatura:', account.address);
      console.log('✍️ [AUTH DEBUG] Payload address:', payload.address);

      try {
        // Usar signLoginPayload do Thirdweb v5 (mais confiável)
        console.log('🔐 [AUTH DEBUG] Usando signLoginPayload do Thirdweb v5...');
        const signResult = await signLoginPayload({
          account: account,
          payload: payload
        });
        console.log('✅ [AUTH DEBUG] Resultado da assinatura:', signResult);
        
        // signLoginPayload retorna um objeto, precisamos extrair a signature
        if (typeof signResult === 'string') {
          signature = signResult;
          console.log('📝 [AUTH DEBUG] Assinatura é string:', signature);
        } else if (signResult && signResult.signature) {
          signature = signResult.signature;
          console.log('📝 [AUTH DEBUG] Assinatura extraída do objeto:', signature);
        } else {
          console.log('❌ [AUTH DEBUG] Formato de assinatura inválido:', signResult);
          throw new Error('Formato de assinatura inválido');
        }
        
        console.log('✅ [AUTH DEBUG] Assinatura final:', signature);
      } catch (error) {
        console.error('❌ [AUTH DEBUG] Erro na assinatura com signLoginPayload:', error);
        throw new Error(`Erro na assinatura: ${error}`);
      }

      // 3. Verificar assinatura no backend (exatamente como na página wallet)
      console.log('🔍 [AUTH DEBUG] Enviando para verificação...');
      const verifyPayload = { payload, signature };
      console.log('📤 [AUTH DEBUG] Verify payload:', {
        payloadKeys: Object.keys(payload),
        signatureLength: signature.length,
        signaturePreview: signature.substring(0, 20) + '...'
      });
      
      const verifyResponse = await fetch(`http://localhost:3001/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyPayload)
      });

      console.log('📡 [AUTH DEBUG] Verify response status:', verifyResponse.status);

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        console.log('❌ [AUTH DEBUG] Verify error response:', errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        throw new Error(error.error || 'Erro na verificação');
      }

      const verifyResult = await verifyResponse.json();
      console.log('✅ [AUTH DEBUG] Verify response received:', verifyResult);
      
      const { token: authToken, address, sessionId } = verifyResult;
      console.log('✅ [AUTH DEBUG] Token recebido:', authToken ? 'SIM' : 'NÃO');
      console.log('✅ [AUTH DEBUG] Token preview:', authToken ? authToken.substring(0, 50) + '...' : 'NONE');
      console.log('✅ [AUTH DEBUG] Address:', address);
      console.log('✅ [AUTH DEBUG] SessionId:', sessionId);
      
      // 4. Salvar payload e assinatura no localStorage para uso no Gateway
      localStorage.setItem('authPayload', JSON.stringify(payload));
      localStorage.setItem('authSignature', signature);
      console.log('💾 [AUTH DEBUG] Payload e assinatura salvos no localStorage');
      
      // 5. Salvar token no localStorage (exatamente como na página wallet)
      localStorage.setItem('authToken', authToken);
      console.log('💾 [AUTH DEBUG] Token salvo no localStorage');
      setIsAuthenticated(true);
      console.log(`✅ [AUTH DEBUG] Autenticado! Endereço: ${address.slice(0, 6)}...${address.slice(-4)}`);

      // 5. Autenticação concluída - não precisa notificar Gateway

      // 6. Autenticação concluída com sucesso
      console.log('🎉 [AUTH DEBUG] Autenticação concluída! JWT salvo e pronto para uso.');

    } catch (err: any) {
      console.error('❌ [AUTH DEBUG] Authentication failed:', err);
      setError(err?.message || 'Falha na autenticação');
    } finally {
      console.log('🏁 [AUTH DEBUG] Setting isAuthenticating to false');
      setIsAuthenticating(false);
    }
  }

  async function handleDisconnect() {
    setError(null);
    try {
      if (activeWallet) {
        await disconnect(activeWallet);
      }
    } catch (err: any) {
      console.error('wallet disconnect failed', err);
      setError(err?.message || 'Failed to disconnect');
    }
  }

  const connected = Boolean(account?.address);

  return (
    <Card tone="muted" padding={20} style={{ marginTop: 0 }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <WalletIcon size={22} />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Wallet</h2>
        </div>
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
                  padding: '14px 20px',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 16,
                  background: '#7c5cff',
                  color: '#fff',
                },
              }}
              theme="dark"
            />
          ) : (
            <div style={{ color: '#ef4444', fontSize: 13 }}>
              Missing THIRDWEB client configuration.
            </div>
          )
        ) : (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                border: '1px solid rgba(15,23,42,0.12)',
                background: 'var(--tg-theme-bg-color, #fff)',
                borderRadius: 12,
                padding: 12,
                textAlign: 'left',
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: 'var(--tg-theme-hint-color, #687280)' }}>Connected wallet</p>
              <p
                style={{
                  margin: '6px 0 0',
                  fontFamily: 'monospace',
                  fontSize: 14,
                  color: 'var(--tg-theme-text-color, #111)',
                  wordBreak: 'break-all',
                }}
              >
                {shortAddress(account!.address)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              block
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              block
              onClick={authenticateWithBackend}
              disabled={!account || !client}
              style={{ marginTop: 8 }}
            >
              🔐 Autenticar
            </Button>
            <Button
              variant="primary"
              size="lg"
              block
              onClick={() => {
                // Navegar para a página de swap
                const currentUrl = new URL(window.location.href);
                currentUrl.searchParams.set('page', 'swap');
                window.location.href = currentUrl.toString();
              }}
              style={{ 
                marginTop: 12,
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
          </div>
        )}
        {error && (
          <div style={{ color: '#ef4444', fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>
    </Card>
  );
}

export default WalletConnectPanel;
