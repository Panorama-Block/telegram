'use client';

import { useEffect, useState, useRef } from 'react';
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

        // Consume start_param (deep link) to recover sessions created outside the app
        try {
          const isTelegram = (WebApp as any)?.initDataUnsafe;
          const startParam = (WebApp as any)?.initDataUnsafe?.start_param
            || new URLSearchParams(window.location.search).get('startapp')
            || '';
          const hasAuth = !!localStorage.getItem('authToken');
          if (isTelegram && startParam && !hasAuth) {
            const match = String(startParam).match(/^(code:)?(.+)$/);
            const nonce = match ? match[2] : null;
            const authApiBase = (process.env.VITE_AUTH_API_BASE || '').replace(/\/+$/, '');
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
        const thirdwebClientId = process.env.VITE_THIRDWEB_CLIENT_ID || '841b9035bb273fee8d50a503f5b09fd0';

        // Create providers component
        const ProvidersComponent = ({ children }: { children: React.ReactNode }) => {
          const [PWAInstallPrompt, setPWAInstallPrompt] = useState<any>(null);
          const [PWAUpdateNotification, setPWAUpdateNotification] = useState<any>(null);
          const [OfflineIndicator, setOfflineIndicator] = useState<any>(null);
          const [AutoConnectHandler, setAutoConnectHandler] = useState<any>(null);
          const [WalletSessionGuard, setWalletSessionGuard] = useState<any>(null);

          useEffect(() => {
            // Dynamic import PWA and wallet components to avoid SSR issues
            Promise.all([
              import('@/components/pwa/PWAInstallPrompt'),
              import('@/components/pwa/PWAUpdateNotification'),
              import('@/components/pwa/OfflineIndicator'),
              import('@/components/wallet/AutoConnectHandler'),
              import('@/components/wallet/WalletSessionGuard')
            ]).then(([installPrompt, updateNotification, offlineIndicator, autoConnect, sessionGuard]) => {
              setPWAInstallPrompt(() => installPrompt.PWAInstallPrompt);
              setPWAUpdateNotification(() => updateNotification.PWAUpdateNotification);
              setOfflineIndicator(() => offlineIndicator.OfflineIndicator);
              setAutoConnectHandler(() => autoConnect.AutoConnectHandler);
              setWalletSessionGuard(() => sessionGuard.WalletSessionGuard);
            }).catch(console.error);
          }, []);

          return (
            <AuthProvider>
              <tonConnect.TonConnectUIProvider manifestUrl={manifestUrl}>
                <thirdwebReact.ThirdwebProvider>
                  {AutoConnectHandler && <AutoConnectHandler />}
                  {WalletSessionGuard && <WalletSessionGuard />}
                  <AuthGuard>
                    {children}
                    {/* PWA Components */}
                    {PWAInstallPrompt && (
                      <PWAInstallPrompt
                        variant="toast"
                        position="bottom"
                        showOnMobile={true}
                        showOnDesktop={true}
                        autoShow={true}
                        delay={5000}
                      />
                    )}
                    {PWAUpdateNotification && (
                      <PWAUpdateNotification
                        variant="toast"
                        position="bottom"
                        autoUpdate={false}
                      />
                    )}
                    {OfflineIndicator && (
                      <OfflineIndicator
                        variant="banner"
                        position="top"
                        showOnlineStatus={true}
                      />
                    )}
                  </AuthGuard>
                </thirdwebReact.ThirdwebProvider>
              </tonConnect.TonConnectUIProvider>
            </AuthProvider>
          );
        };

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
    return null;
  }

  return <Providers>{children}</Providers>;
}
