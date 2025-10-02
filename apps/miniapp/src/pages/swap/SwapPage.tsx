import React, { useMemo } from 'react';

function pickReadableColor(theme: any): string {
  if (!theme) return '#0f172a';
  const text = theme.text_color;
  if (text) return text.hex;
  return '#0f172a';
}

// Telegram user not needed in miniapp flow
import { SmartWalletConnectPanel } from '../../features/wallets/evm/SmartWalletConnectPanel';
import { AppContainer, Spinner } from '../../shared/ui';

const SwapCardLazy = React.lazy(() =>
  import('../../features/swap/SwapCard').then((m) => ({ default: m.SwapCard })),
);

export function SwapPage() {
  const debugMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === '1';
  }, []);
  const headingColor = useMemo(() => {
    if (typeof window === 'undefined') return '#0f172a';
    const theme = (window as any)?.Telegram?.WebApp?.themeParams;
    return pickReadableColor(theme);
  }, []);

  return (
    <AppContainer>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ color: headingColor, fontSize: 24, fontWeight: 600, margin: 0 }}>
            Swap Tokens
          </h1>
          <button
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('page', 'chat');
              window.location.href = url.toString();
            }}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--tg-theme-button-color, #007aff)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            🤖 Chat
          </button>
        </div>
        
        <SmartWalletConnectPanel />
        
        <React.Suspense
          fallback={
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Spinner size={32} />
            </div>
          }
        >
          <SwapCardLazy />
        </React.Suspense>

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