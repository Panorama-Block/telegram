'use client';

import { useEffect, useState } from 'react';
import { AuthProvider } from '@/shared/contexts/AuthContext';
import { AuthGuard } from '@/shared/ui/AuthGuard';

interface ClientProvidersProps {
  children: React.ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  const [isReady, setIsReady] = useState(false);
  const [Providers, setProviders] = useState<any>(null);

  useEffect(() => {
    async function initProviders() {
      try {
        const [
          { default: WebApp },
          tonConnect,
          thirdwebReact,
          bufferModule,
        ] = await Promise.all([
          import('@twa-dev/sdk'),
          import('@tonconnect/ui-react'),
          import('thirdweb/react'),
          import('buffer'),
        ]);

        // Attach global shims
        const { Buffer } = bufferModule;
        (globalThis as any).global = (globalThis as any).global || globalThis;
        (globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;
        (globalThis as any).process = (globalThis as any).process || { env: {} };

        WebApp?.ready?.();

        // Consumir start_param (deep link) para recuperar sessão criada externamente
        try {
          const isTelegram = (WebApp as any)?.initDataUnsafe;
          const startParam = (WebApp as any)?.initDataUnsafe?.start_param
            || new URLSearchParams(window.location.search).get('startapp')
            || '';
          const hasAuth = !!localStorage.getItem('authToken');
          if (isTelegram && startParam && !hasAuth) {
            const match = String(startParam).match(/^(code:)?(.+)$/);
            const nonce = match ? match[2] : null;
            const authApiBase = process.env.VITE_AUTH_API_BASE || '';
            if (nonce && authApiBase) {
              const resp = await fetch(`${authApiBase}/auth/miniapp/session/consume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nonce }),
              });
              if (resp.ok) {
                const { token, walletCookie } = await resp.json();
                if (walletCookie) {
                  const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || '';
                  if (clientId) {
                    await localStorage.setItem(`walletToken-${clientId}`, walletCookie);
                  }
                }
                if (token) {
                  localStorage.setItem('authToken', token);
                  // tentar auto-conectar a in-app wallet
                  try {
                    const thirdweb = await import('thirdweb');
                    const wallets = await import('thirdweb/wallets');
                    const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || '';
                    if (clientId) {
                      const client = thirdweb.createThirdwebClient({ clientId });
                      const w = wallets.inAppWallet();
                      await w.autoConnect({ client });
                    }
                  } catch (e) {
                    console.warn('[StartParam Consume] autoConnect failed:', e);
                  }
                  // opcional: navegar para newchat
                  try {
                    const basePath = '/miniapp';
                    const current = window.location.pathname;
                    if (!current.endsWith('/newchat') && !current.endsWith('/chat')) {
                      window.location.href = `${basePath}/newchat`;
                    }
                  } catch {}
                }
              }
            }
          }
        } catch (e) {
          console.warn('[StartParam Consume] Ignored:', e);
        }

        const manifestUrl = `${window.location.origin}/miniapp/api/tonconnect-manifest`;
        const thirdwebClientId = process.env.VITE_THIRDWEB_CLIENT_ID || '';

        // Create providers component
        const ProvidersComponent = ({ children }: { children: React.ReactNode }) => (
          <AuthProvider>
            <tonConnect.TonConnectUIProvider manifestUrl={manifestUrl}>
              <thirdwebReact.ThirdwebProvider>
                <AuthGuard>
                  {children}
                </AuthGuard>
              </thirdwebReact.ThirdwebProvider>
            </tonConnect.TonConnectUIProvider>
          </AuthProvider>
        );

        setProviders(() => ProvidersComponent);
        setIsReady(true);
      } catch (err) {
        console.error('[Providers Error]', err);
        setIsReady(true);
      }
    }

    // Setup global error handlers
    window.addEventListener('error', (event) => {
      console.error('[Global Error]', event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('[Unhandled Promise Rejection]', event.reason);
    });

    initProviders();
  }, []);

  if (!isReady || !Providers) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid #e0e0e0',
          borderTop: '3px solid #007aff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto'
        }} />
      </div>
    );
  }

  return <Providers>{children}</Providers>;
}
