import React, { useMemo } from 'react';
import { ConnectButton } from 'thirdweb/react';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { createThirdwebClient } from 'thirdweb';

export function EvmConnectButton() {
  const client = useMemo(() => {
    const cid = (import.meta as any).env?.VITE_THIRDWEB_CLIENT_ID || '';
    try {
      return createThirdwebClient({ clientId: cid });
    } catch (e) {
      // Return a dummy object to avoid crashing render; UI will show hint below
      return null as any;
    }
  }, []);
  return (
    <div style={{
      marginTop: 16,
      background: 'var(--tg-theme-secondary-bg-color, #f6f7f9)',
      borderRadius: 12,
      padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0 }}>EVM Wallet</h3>
        {client ? (
          <ConnectButton client={client} wallets={[inAppWallet({ auth: { options: ['google', 'telegram'] } }), createWallet("io.metamask")]} />
        ) : (
          <span style={{ color: '#ef4444' }}>Missing THIRDWEB_CLIENT_ID</span>
        )}
      </div>
      <p style={{ color: 'var(--tg-theme-hint-color, #666)', marginTop: 12 }}>
        Connect an EVM wallet (WalletConnect supported). Some wallets may not work inside Telegram’s webview.
      </p>
    </div>
  );
}
