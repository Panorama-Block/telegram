import React, { useMemo } from 'react';
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
    const telegramAuthOptions = ['telegram', 'email'] as const;

    if (isiOS) {
      return [inAppWallet({
        auth: {
          options: isTelegram ? telegramAuthOptions : ['email', 'passkey', 'guest'],
          mode,
          redirectUrl,
        },
      })];
    }

    return isTelegram
      ? [inAppWallet({
          auth: {
            options: telegramAuthOptions,
            mode,
            redirectUrl,
          },
        })]
      : [
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
