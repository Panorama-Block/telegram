import React, { useMemo } from 'react';

function pickReadableColor(theme: any): string {
  if (!theme) return '#0f172a';
  const text = theme.text_color;
  if (text) return text.hex;
  return '#0f172a';
}

// Telegram user not needed in miniapp flow
import { WalletConnectPanel } from '../../features/wallets/evm/WalletConnectPanel';
import { AppContainer, Spinner } from '../../shared/ui';

export function DashboardPage() {
  const debugMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === 'true';
  }, []);
  const headingColor = useMemo(() => {
    if (typeof window === 'undefined') return '#0f172a';
    const theme = (window as any)?.Telegram?.WebApp?.themeParams;
    return pickReadableColor(theme);
  }, []);

  return (
    <AppContainer>
      <div style={{ padding: 16 }}>
        <h1 style={{ color: headingColor, marginBottom: 24, fontSize: 24, fontWeight: 600 }}>
          Dashboard
        </h1>
        
        <WalletConnectPanel />

        {debugMode && (
          <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f3f4f6', borderRadius: 8 }}>
            <h3 style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Debug Info</h3>
            <pre style={{ fontSize: 12, overflow: 'auto' }}>
              {JSON.stringify(
                {
                  url: window.location.href,
                  userAgent: navigator.userAgent,
                  theme: (window as any)?.Telegram?.WebApp?.themeParams,
                },
                null,
                2,
              )}
            </pre>
          </div>
        )}
      </div>
    </AppContainer>
  );
}