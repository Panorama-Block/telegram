import React, { useMemo, useState, useEffect } from 'react';
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
  const [authMessage, setAuthMessage] = useState('');
  const [jwtToken, setJwtToken] = useState('');

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

  // Autenticação automática quando a conta estiver conectada
  useEffect(() => {
    if (account && client && !isAuthenticated && !isAuthenticating) {
      authenticateWithBackend();
    }
  }, [account, client, isAuthenticated, isAuthenticating, authenticateWithBackend]);

  async function authenticateWithBackend() {

    if (!account || !client) {
      return;
    }

    const authApiBase = process.env.VITE_AUTH_API_BASE || 'http://localhost:3001';

    try {
      setIsAuthenticating(true);
      setError(null);

      // 1. Obter payload do backend (exatamente como na página wallet)
      const normalizedAddress = account.address;

      const loginPayload = { address: normalizedAddress };

      console.log('🔍 [AUTH DEBUG] authApiBase:', authApiBase);
      console.log('🔍 [AUTH DEBUG] process.env.VITE_AUTH_API_BASE:', process.env.VITE_AUTH_API_BASE);
      console.log('🔍 [AUTH DEBUG] Fazendo requisição para:', `${authApiBase}/auth/login`);

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

      // 2. Assinar payload usando Thirdweb como intermediário (como no swap)
      let signature;
      

      try {
        // Usar signLoginPayload da Thirdweb (método correto para autenticação)
        const signResult = await signLoginPayload({
          account: account,
          payload: payload
        });
        
        // Extrair signature do resultado
        if (typeof signResult === 'string') {
          signature = signResult;
        } else if (signResult && signResult.signature) {
          signature = signResult.signature;
        } else if (signResult && typeof signResult === 'object') {
          // Tentar diferentes propriedades possíveis
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
        console.error('❌ [AUTH DEBUG] Erro na assinatura via Thirdweb:', error);
        
        // Fallback para método direto se signLoginPayload falhar
        try {
          
          // Para In-App Wallet, pode ser necessário usar o método de assinatura direto
          if (activeWallet && typeof (activeWallet as any).signMessage === 'function') {
            const messageToSign = JSON.stringify(payload);
            signature = await (activeWallet as any).signMessage({ message: messageToSign });
          } else {
            throw new Error('Método de assinatura não disponível');
          }
        } catch (fallbackError) {
          console.error('❌ [AUTH DEBUG] Fallback também falhou:', fallbackError);
          throw new Error(`Erro na assinatura: ${error}. Fallback: ${fallbackError}`);
        }
      }

      // 3. Verificar assinatura no backend (exatamente como na página wallet)
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
      
      // 4. Salvar payload e assinatura no localStorage para uso no Gateway
      localStorage.setItem('authPayload', JSON.stringify(payload));
      localStorage.setItem('authSignature', signature);
      
      // 5. Salvar token no localStorage (exatamente como na página wallet)
      localStorage.setItem('authToken', authToken);
      setIsAuthenticated(true);
      setJwtToken(authToken);
      setAuthMessage('✅ Autenticado com sucesso!');

      // 5. Autenticação concluída - não precisa notificar Gateway

      // 6. Autenticação concluída com sucesso

    } catch (err: any) {
      console.error('❌ [AUTH DEBUG] Authentication failed:', err);
      console.error('❌ [AUTH DEBUG] Error type:', err.name);
      console.error('❌ [AUTH DEBUG] Error stack:', err.stack);

      let errorMessage = err?.message || 'Falha na autenticação';

      // Verificar se é erro de rede/CORS
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        errorMessage = `Erro de conexão com ${authApiBase}. Verifique se o servidor está rodando e acessível.`;
      }

      setError(errorMessage);
      setAuthMessage(`❌ Erro: ${errorMessage}`);
      setIsAuthenticated(false);
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleDisconnect() {
    setError(null);
    try {
      if (activeWallet) {
        await disconnect(activeWallet);
      }
      // Limpar estado de autenticação
      setIsAuthenticated(false);
      setAuthMessage('');
      setJwtToken('');
      localStorage.removeItem('authToken');
      localStorage.removeItem('authPayload');
      localStorage.removeItem('authSignature');
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
              <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #687280)', marginTop: 4 }}>
                {isAuthenticating ? 'Autenticando...' : isAuthenticated ? 'Autenticado com sucesso!' : 'Conecte para autenticar'}
              </div>
              {authMessage && (
                <div style={{ fontSize: 12, color: authMessage.includes('✅') ? '#10b981' : '#ef4444', marginTop: 4 }}>
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
              block
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
            <Button
              variant="primary"
              size="lg"
              block
              onClick={() => {
                // Navegar para a página de swap
                window.location.href = '/miniapp/swap';
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
