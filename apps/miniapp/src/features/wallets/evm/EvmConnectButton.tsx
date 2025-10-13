import React, { useMemo } from 'react';
import { ConnectButton } from 'thirdweb/react';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { createThirdwebClient } from 'thirdweb';


import { Card } from '../../../shared/ui';

export function EvmConnectButton() {
  const client = useMemo(() => {
    const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || '';
    try {
      return createThirdwebClient({ clientId });
    } catch (e) {
      return null as any;
    }
  }, []);

  const wallets = useMemo(() => {
    const isTelegram = typeof window !== 'undefined' && (window as any).Telegram?.WebApp;
    const isiOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const redirectUrl = isTelegram ? `${window.location.origin}/miniapp/auth/callback` : undefined;

    if (isTelegram && isiOS) {
      return [
        inAppWallet({
          auth: {
            options: ['email', 'passkey', 'guest'],
            mode: 'redirect',
            redirectUrl,
          },
        }),
      ];
    }

    return [
      inAppWallet({
        auth: {
          options: ['google', 'telegram', 'email'],
          mode: isTelegram ? 'redirect' : 'popup',
          redirectUrl,
        },
      }),
      createWallet('io.metamask', { preferDeepLink: true }),
    ];
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
      <p style={{ color: 'var(--tg-theme-hint-color, #666)', margin: 0 }}>
        Connect an EVM wallet (WalletConnect supported). Some wallets may not work inside Telegram’s webview.
      </p>
    </Card>
  );
}

export default EvmConnectButton;
