'use client';

import { useEffect, useState } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';

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

        const manifestUrl = `${window.location.origin}/miniapp/manifest.json`;
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
