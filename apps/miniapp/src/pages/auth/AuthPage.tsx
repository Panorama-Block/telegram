import React, { useMemo } from 'react';

function parseHexColor(input?: string) {
  if (!input) return null;
  const hex = input.trim().replace(/^#/, '');
  if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) return null;
  const normalized = hex.length === 3
    ? hex.split('').map((c) => c + c).join('')
    : hex.toLowerCase();
  const int = parseInt(normalized, 16);
  const r = (int >> 16) & 0xff;
  const g = (int >> 8) & 0xff;
  const b = int & 0xff;
  return { r, g, b, hex: `#${normalized}` };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const srgb = [r, g, b].map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function pickReadableColor(theme: any): string {
  const text = parseHexColor(theme?.text_color || theme?.hint_color);
  const bg = parseHexColor(theme?.bg_color || theme?.secondary_bg_color);
  if (text && bg) {
    const contrast = Math.abs(relativeLuminance(text) - relativeLuminance(bg));
    if (contrast < 0.25) {
      return relativeLuminance(bg) > 0.5 ? '#0f172a' : '#f8fafc';
    }
    return text.hex;
  }
  if (text) return text.hex;
  return '#0f172a';
}

import { useTelegramUser } from '../../features/auth/useTelegramUser';
import { WalletConnectPanel } from '../../features/wallets/evm/WalletConnectPanel';
import { AppContainer, Spinner } from '../../shared/ui';

export function AuthPage() {
  const { user, loading, error } = useTelegramUser();
  const debugMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === '1';
  }, []);
  const headingColor = useMemo(() => {
    if (typeof window === 'undefined') return '#0f172a';
    const theme = (window as any)?.Telegram?.WebApp?.themeParams;
    return pickReadableColor(theme);
  }, []);

  if (loading) {
    return (
      <AppContainer>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ marginBottom: 12, fontSize: 16 }}>Validando sessão...</div>
          <Spinner size={32} />
        </div>
      </AppContainer>
    );
  }

  if (error) {
    return (
      <AppContainer>
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
          <h3 style={{ marginBottom: 8 }}>Erro na verificação</h3>
          <div>{error}</div>
        </div>
      </AppContainer>
    );
  }

  const username = user?.username || 'guest';

  return (
    <AppContainer>
      {debugMode && (
        <pre
          style={{
            background: '#111',
            color: '#0f0',
            padding: 12,
            borderRadius: 8,
            whiteSpace: 'pre-wrap',
            marginBottom: 16,
            maxWidth: 480,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
{`DEBUG
href: ${window.location.href}
origin: ${window.location.origin}
hasTG: ${Boolean((window as any)?.Telegram?.WebApp)}
UA: ${navigator.userAgent}
VITE_GATEWAY_BASE: ${(import.meta as any).env?.VITE_GATEWAY_BASE ?? 'unset'}
`}
        </pre>
      )}

      <main
        style={{
          minHeight: 'calc(100vh - 40px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          <header style={{ textAlign: 'center' }}>
            <p style={{
              margin: 0,
              fontSize: 14,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: 'var(--tg-theme-hint-color, #687280)',
            }}>
              Conectar Carteira
            </p>
            <h1
              style={{
                margin: '8px 0 0',
                fontSize: 28,
                fontWeight: 700,
                color: headingColor,
              }}
            >
              {username}
            </h1>
            <p style={{
              marginTop: 8,
              color: 'var(--tg-theme-hint-color, #687280)',
              fontSize: 14,
            }}>
              Conecte sua carteira para acessar todas as funcionalidades do Zico Agent.
            </p>
          </header>

          <WalletConnectPanel />
        </div>
      </main>
    </AppContainer>
  );
}

export default AuthPage;
