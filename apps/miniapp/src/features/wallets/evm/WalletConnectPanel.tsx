import React, { useMemo, useState } from 'react';
import { ConnectButton, useActiveAccount, useActiveWallet, useDisconnect } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { inAppWallet, createWallet } from 'thirdweb/wallets';

import { Button, Card } from '../../../shared/ui';

function WalletIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 7.5C3 6.11929 4.11929 5 5.5 5H18.5C19.8807 5 21 6.11929 21 7.5V9.5H16C14.6193 9.5 13.5 10.6193 13.5 12C13.5 13.3807 14.6193 14.5 16 14.5H21V16.5C21 17.8807 19.8807 19 18.5 19H5.5C4.11929 19 3 17.8807 3 16.5V7.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 12L16 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletConnectPanel() {
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect, isDisconnecting } = useDisconnect();
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => {
    const clientId = (import.meta as any).env?.VITE_THIRDWEB_CLIENT_ID as string | undefined;
    if (!clientId) {
      return null;
    }
    try {
      return createThirdwebClient({ clientId });
    } catch (err) {
      console.error('Failed to create thirdweb client', err);
      return null;
    }
  }, []);

  const wallets = useMemo(
    () => [
      inAppWallet({ auth: { options: ['google', 'telegram'] } }),
      createWallet('io.metamask'),
    ],
    [],
  );

  async function handleDisconnect() {
    setError(null);
    try {
      if (activeWallet) {
        await disconnect(activeWallet);
      } else {
        await disconnect();
      }
    } catch (err: any) {
      console.error('wallet disconnect failed', err);
      setError(err?.message || 'Failed to disconnect');
    }
  }

  const connected = Boolean(account?.address);

  return (
    <Card tone="muted" padding={20} style={{ marginTop: 0 }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <WalletIcon size={22} />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Wallet</h2>
        </div>
        {!connected ? (
          client ? (
            <ConnectButton
              client={client}
              wallets={wallets}
              accountStatus="none"
              connectModal={{ size: 'compact' }}
              connectButton={{
                label: 'Connect Wallet',
                style: {
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 16,
                  background: '#7c5cff',
                  color: '#fff',
                },
              }}
              theme="dark"
            />
          ) : (
            <div style={{ color: '#ef4444', fontSize: 13 }}>
              Missing THIRDWEB client configuration.
            </div>
          )
        ) : (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                border: '1px solid rgba(15,23,42,0.12)',
                background: 'var(--tg-theme-bg-color, #fff)',
                borderRadius: 12,
                padding: 12,
                textAlign: 'left',
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: 'var(--tg-theme-hint-color, #687280)' }}>Connected wallet</p>
              <p
                style={{
                  margin: '6px 0 0',
                  fontFamily: 'monospace',
                  fontSize: 14,
                  color: 'var(--tg-theme-text-color, #111)',
                  wordBreak: 'break-all',
                }}
              >
                {shortAddress(account!.address)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              block
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </div>
        )}
        {error && (
          <div style={{ color: '#ef4444', fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>
    </Card>
  );
}

export default WalletConnectPanel;
