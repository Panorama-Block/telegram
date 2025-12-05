import React, { useMemo, useCallback } from 'react';
import { ConnectButton } from 'thirdweb/react';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { createThirdwebClient } from 'thirdweb';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';

import { Card } from '../../../shared/ui';

export function EvmConnectButton() {
  const client = useMemo(() => {
    const clientId = THIRDWEB_CLIENT_ID;
    try {
      return createThirdwebClient({ clientId });
    } catch (e) {
      return null as any;
    }
  }, []);

  const wallets = useMemo(() => {
    const WebApp = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : undefined;
    const isTelegram = !!WebApp;
    const isiOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const mode = isTelegram ? 'redirect' : 'popup';
    const redirectUrl = isTelegram ? `${window.location.origin}/miniapp/auth/callback` : undefined;

    if (isiOS) {
      return [
        inAppWallet({
          auth: {
            options: ['email', 'passkey', 'guest'],
            mode,
            redirectUrl,
          },
        }),
      ];
    }

    return [
      inAppWallet({
        auth: {
          options: ['google', 'telegram', 'email'],
          mode,
          redirectUrl,
        },
      }),
      createWallet('io.metamask', { preferDeepLink: true }),
    ];
  }, []);

  const openGoogleInBrowser = useCallback(() => {
    try {
      const WebApp = (window as any).Telegram?.WebApp;
      const url = `${window.location.origin}/miniapp/auth/external?strategy=google`;
      if (WebApp?.openLink) {
        WebApp.openLink(url, { try_instant_view: false });
      } else {
        window.open(url, '_blank');
      }
    } catch {
      window.open(`${window.location.origin}/miniapp/auth/external?strategy=google`, '_blank');
    }
  }, []);

  return (
    <Card
      title="EVM Wallet"
      action={client ? (
        <ConnectButton client={client} wallets={wallets} />
      ) : (
        <span style={{ color: '#ef4444' }}>Missing THIRDWEB_CLIENT_ID</span>
      )}
    >
      {typeof window !== 'undefined' && (window as any).Telegram?.WebApp && /iPhone|iPad|iPod/i.test(navigator.userAgent) && (
        <div style={{ fontSize: 13, color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          On iOS (Telegram), Google blocks sign-in inside webviews. Use Email/Passkey or
          <button
            onClick={openGoogleInBrowser}
            style={{ marginLeft: 6, color: '#fbbf24', textDecoration: 'underline', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            open in browser
          </button>
          .
        </div>
      )}
      <p style={{ color: 'var(--tg-theme-hint-color, #666)', margin: 0 }}>
        Connect an EVM wallet (WalletConnect supported). Some wallets may not work inside Telegram’s webview.
      </p>
    </Card>
  );
}

export default EvmConnectButton;
