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

  return (
    <Card
      title="EVM Wallet"
      action={client ? (
        <ConnectButton
          client={client}
          wallets={[
            inAppWallet({ auth: { options: ['google', 'telegram'] } }),
            createWallet('io.metamask'),
          ]}
        />
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
