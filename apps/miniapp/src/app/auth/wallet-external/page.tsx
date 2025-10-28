'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createThirdwebClient } from 'thirdweb';
import { createWallet } from 'thirdweb/wallets';
import { signLoginPayload } from 'thirdweb/auth';

export default function WalletExternalPage() {
  const search = useSearchParams();
  const [status, setStatus] = useState('Opening wallet...');
  const [error, setError] = useState<string | null>(null);
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);

  const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || '';
  const bot = process.env.VITE_TELEGRAM_BOT_USERNAME || '';
  const authApiBase = (process.env.VITE_AUTH_API_BASE || '').replace(/\/+$/, '');

  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);

  useEffect(() => {
    (async () => {
      try {
        if (!clientId || !client) throw new Error('Missing THIRDWEB_CLIENT_ID');
        if (!authApiBase) throw new Error('AUTH_API_BASE missing');
        const walletId = (search.get('wallet') || 'metamask').toLowerCase();

        setStatus('Connecting wallet...');
        let accountAddress: string | undefined;
        let connectedAccount: any | undefined;

        if (walletId === 'metamask') {
          // Attempt injection inside MetaMask's in-app browser
          const mm = createWallet('io.metamask', { preferDeepLink: true });
          try {
            const acc = await mm.connect({ client });
            connectedAccount = acc;
            accountAddress = acc.address;
          } catch {
            // If we are outside the MetaMask app, provide a deep link
            const dappUrl = `${window.location.origin}/miniapp/auth/wallet-external?wallet=metamask`;
            const deep = `https://metamask.app.link/dapp/${dappUrl.replace(/^https?:\/\//, '')}`;
            setStatus('Open MetaMask to continue...');
            setDeepLinkUrl(deep);
            return;
          }
        } else {
          // Generic WalletConnect fallback could be added here
          throw new Error('Unsupported wallet');
        }

        if (!accountAddress) throw new Error('Account not connected');

        // Authenticate with backend
        setStatus('Authenticating with backend...');
        const loginPayload = { address: accountAddress };

        const loginResponse = await fetch(`${authApiBase}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginPayload),
        });
        if (!loginResponse.ok) {
          const errorText = await loginResponse.text();
          throw new Error(`Error generating payload: ${errorText}`);
        }
        const { payload } = await loginResponse.json();

        let signature = '';
        try {
          const res = await signLoginPayload({ account: connectedAccount, payload });
          signature = typeof res === 'string' ? res : (res as any).signature;
        } catch {
          throw new Error('Failed to sign payload');
        }

        const verifyResponse = await fetch(`${authApiBase}/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload, signature }),
        });
        if (!verifyResponse.ok) {
          const errorText = await verifyResponse.text();
          throw new Error(`Verification error: ${errorText}`);
        }
        const { token } = await verifyResponse.json();
        localStorage.setItem('authToken', token);

        // Create a session so Telegram can resume the flow
        if (bot) {
          try {
            const clientKey = `walletToken-${clientId}`;
            const walletCookie = localStorage.getItem(clientKey);
            const createResp = await fetch(`${authApiBase}/auth/miniapp/session/create`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, walletCookie, ttlSeconds: 600 }),
            });
            if (createResp.ok) {
              const { nonce } = await createResp.json();
              const deep = `https://t.me/${bot}?startapp=code:${encodeURIComponent(nonce)}`;
              setDeepLinkUrl(deep);
              setStatus('Authentication complete. Return to Telegram.');
              return;
            }
          } catch {}
        }

        setStatus('Finished. You can return to Telegram.');
      } catch (err: any) {
        console.error('[WALLET EXTERNAL] error:', err);
        setError(err?.message || 'Failed');
      }
    })();
  }, [client, clientId, authApiBase, bot, search]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 480, width: '100%', padding: 24, background: '#0d1117', color: '#fff', borderRadius: 12, border: '1px solid rgba(6,182,212,0.3)' }}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Connect Wallet</h2>
        <p style={{ margin: 0, color: '#9ca3af' }}>{status}</p>
        {error && <p style={{ marginTop: 12, color: '#ef4444' }}>Error: {error}</p>}
        {!error && deepLinkUrl && (
          <div style={{ marginTop: 16 }}>
            <a
              href={deepLinkUrl}
              style={{ display: 'inline-block', padding: '12px 16px', background: '#2481cc', color: '#fff', borderRadius: 10, fontWeight: 600, textDecoration: 'none' }}
            >
              Open MetaMask
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
