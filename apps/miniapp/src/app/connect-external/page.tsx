'use client';

/**
 * External Wallet Connect — PR1
 *
 * Page opened by the Telegram bot when the user chooses
 * "Connect External Wallet". Uses Thirdweb's ConnectButton which
 * internally uses WalletConnect v2 for mobile wallets (MetaMask, Trust,
 * Bitget, Core) and EIP-6963 for injected wallets on desktop.
 *
 * Flow:
 *   1. User taps button in Telegram bot → opens this page via WebApp.
 *   2. ConnectButton shows wallet list → user picks one → WC session.
 *   3. On success, we POST { address, chainId, walletId } to the
 *      gateway along with the Telegram initData so the backend can
 *      verify the Telegram user and persist the wallet in Redis.
 *   4. Gateway responds OK → we show success and close the WebApp.
 */

import { useEffect, useMemo, useState } from 'react';
import { createThirdwebClient } from 'thirdweb';
import { base, ethereum, arbitrum, optimism } from 'thirdweb/chains';
import { ConnectButton, useActiveAccount, useActiveWalletChain, useActiveWallet } from 'thirdweb/react';
import { createWallet } from 'thirdweb/wallets';
import { THIRDWEB_CLIENT_ID, WALLETCONNECT_PROJECT_ID } from '@/shared/config/thirdweb';

const CHAINS = [base, ethereum, arbitrum, optimism];

// Ordered by expected popularity on Telegram
const WALLETS = [
  createWallet('io.metamask'),
  createWallet('com.trustwallet.app'),
  createWallet('com.bitget.web3'),
  createWallet('app.core.extension'),
  createWallet('walletConnect'),
];

type PostState = 'idle' | 'posting' | 'done' | 'error';

export default function ConnectExternalPage() {
  const account = useActiveAccount();
  const chain = useActiveWalletChain();
  const wallet = useActiveWallet();

  const [postState, setPostState] = useState<PostState>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const client = useMemo(
    () => (THIRDWEB_CLIENT_ID ? createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID }) : null),
    [],
  );

  // When we have an active account, push it to the gateway once.
  useEffect(() => {
    if (!account?.address || !chain?.id) return;
    if (postState !== 'idle') return;

    (async () => {
      try {
        setPostState('posting');
        setErrMsg(null);

        const initData =
          (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) || '';
        if (!initData) {
          throw new Error(
            'Telegram initData missing — open this page from the bot, not directly.',
          );
        }

        const walletId = wallet?.id || 'walletConnect';

        const base = (process.env.NEXT_PUBLIC_GATEWAY_URL || '').replace(/\/+$/, '');
        const url = base
          ? `${base}/api/wallet/external/connect`
          : '/api/wallet/external/connect';

        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-init-data': initData,
          },
          body: JSON.stringify({
            address: account.address,
            chainId: chain.id,
            walletId,
          }),
        });

        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          throw new Error(`Gateway error ${resp.status}: ${txt}`);
        }

        setPostState('done');

        // Close the mini-app after a short delay so the user sees "connected".
        setTimeout(() => {
          try {
            (window as any).Telegram?.WebApp?.close?.();
          } catch {}
        }, 1500);
      } catch (err: any) {
        console.error('[connect-external] post failed:', err);
        setErrMsg(err?.message || 'Failed to register wallet with backend');
        setPostState('error');
      }
    })();
  }, [account?.address, chain?.id, wallet?.id, postState]);

  if (!client) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Configuration error</h2>
          <p style={{ color: '#ef4444' }}>
            THIRDWEB_CLIENT_ID is not set. Check miniapp env vars.
          </p>
        </div>
      </div>
    );
  }

  if (!WALLETCONNECT_PROJECT_ID) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Configuration error</h2>
          <p style={{ color: '#ef4444' }}>
            NEXT_PUBLIC_WC_PROJECT_ID is not set. Get one at
            {' '}
            <a href="https://cloud.reown.com" style={{ color: '#06b6d4' }}>
              cloud.reown.com
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Connect External Wallet</h2>
        <p style={{ margin: '0 0 16px', color: '#9ca3af' }}>
          MetaMask, Trust, Bitget, Core or any WalletConnect-compatible wallet on
          Base, Ethereum, Arbitrum and Optimism.
        </p>

        <ConnectButton
          client={client}
          wallets={WALLETS}
          chains={CHAINS}
          walletConnect={{ projectId: WALLETCONNECT_PROJECT_ID }}
          theme="dark"
          connectModal={{ size: 'compact', title: 'Choose your wallet' }}
          connectButton={{ label: 'Connect Wallet' }}
        />

        <div style={{ marginTop: 16, minHeight: 24 }}>
          {account?.address && postState === 'posting' && (
            <p style={{ margin: 0, color: '#9ca3af' }}>
              Registering {short(account.address)}…
            </p>
          )}
          {postState === 'done' && (
            <p style={{ margin: 0, color: '#10b981' }}>
              Wallet connected. Returning to Telegram…
            </p>
          )}
          {postState === 'error' && errMsg && (
            <p style={{ margin: 0, color: '#ef4444' }}>Error: {errMsg}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function short(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

const containerStyle: React.CSSProperties = {
  minHeight: '60vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};

const cardStyle: React.CSSProperties = {
  maxWidth: 480,
  width: '100%',
  padding: 24,
  background: '#0d1117',
  color: '#fff',
  borderRadius: 12,
  border: '1px solid rgba(6,182,212,0.3)',
};
