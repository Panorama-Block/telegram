'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createThirdwebClient } from 'thirdweb';
import { inAppWallet } from 'thirdweb/wallets';
import { signLoginPayload } from 'thirdweb/auth';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import '@/shared/ui/loader.css';

function decodeAuthResult(value: string) {
  try {
    // Some providers encode the JSON twice; try to decode safely
    const once = decodeURIComponent(value);
    const maybeJson = once.startsWith('{') ? once : decodeURIComponent(once);
    return JSON.parse(maybeJson);
  } catch {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const clientId = THIRDWEB_CLIENT_ID;
        if (!clientId) {
          throw new Error('THIRDWEB_CLIENT_ID missing');
        }

        // 1) Parse authResult (when present) and persist the token locally
        const url = new URL(window.location.href);
        const authResultParam = url.searchParams.get('authResult');
        const existingToken = localStorage.getItem(`walletToken-${clientId}`);

        if (!authResultParam) {
          // Without authResult, check if we have an existing token to auto-connect
          if (!existingToken) {
            console.warn('[AUTH CALLBACK] No authResult and no stored token, redirecting to newchat');
            router.replace('/newchat');
            return;
          }
          console.log('[AUTH CALLBACK] No authResult but found existing token, attempting auto-connect');
        } else {
          const authResult = decodeAuthResult(authResultParam);
          if (!authResult || !authResult.storedToken || !authResult.storedToken.cookieString) {
            throw new Error('Invalid authResult returned from OAuth');
          }
          const cookie = authResult.storedToken.cookieString as string;
          // Persist to the storage expected by the SDK (walletToken-<clientId>)
          localStorage.setItem(`walletToken-${clientId}`, cookie);
          // Optionally persist userWalletId for future actions
          try {
            const userId = authResult?.storedToken?.authDetails?.userWalletId;
            if (userId) {
              localStorage.setItem(`thirdwebEwsWalletUserId-${clientId}`, userId);
            }
          } catch {}
        }

        // 2) Auto-connect the wallet using the stored token
        const client = createThirdwebClient({ clientId });
        const wallet = inAppWallet();
        let account;
        try {
          account = await wallet.autoConnect({ client });
        } catch (autoConnectError) {
          console.error('[AUTH CALLBACK] Auto-connect failed:', autoConnectError);
          // If auto-connect fails, redirect to newchat for manual connection
          router.replace('/newchat');
          return;
        }

        if (!account) {
          throw new Error('Failed to connect the wallet after OAuth');
        }

        // 3) Authenticate with the backend (issue your platform JWT)
        const authApiBase = (process.env.VITE_AUTH_API_BASE || 'http://localhost:3301').replace(/\/+$/, '');

        const loginPayload = { address: account.address };
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

        if (account.address.toLowerCase() !== payload.address.toLowerCase()) {
          throw new Error('Wallet address returned by backend does not match the payload');
        }

        let signature: string = '';
        try {
          const signResult = await signLoginPayload({ account, payload });
          if (typeof signResult === 'string') signature = signResult;
          else if (signResult && (signResult as any).signature) signature = (signResult as any).signature;
          else throw new Error('Invalid signature format');
        } catch (err) {
          console.error('[AUTH CALLBACK] Error signing payload', err);
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
        const verifyResult = await verifyResponse.json();
        const { token: authToken } = verifyResult;
        if (!authToken) throw new Error('Authentication token missing in backend response');

        // Persist your platform token locally
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('authPayload', JSON.stringify(payload));
        localStorage.setItem('authSignature', signature);

        const isTelegram = (window as any).Telegram?.WebApp;
        const bot = process.env.VITE_TELEGRAM_BOT_USERNAME || '';
        if (!isTelegram && bot) {
          // Create a one-time session so the Mini App can resume via deep link
          try {
            const createResp = await fetch(`${authApiBase}/auth/miniapp/session/create`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: authToken, walletCookie: localStorage.getItem(`walletToken-${clientId}`), ttlSeconds: 600 }),
            });
            if (createResp.ok) {
              const { nonce } = await createResp.json();
              const deepLink = `https://t.me/${bot}?startapp=code:${encodeURIComponent(nonce)}`;
              setDeepLinkUrl(deepLink);
              return; // do not redirect inside Safari
            }
          } catch (e) {
            console.warn('[AUTH CALLBACK] Failed to create deep-link session', e);
          }
        }

        router.replace('/newchat');
      } catch (e: any) {
        console.error('[AUTH CALLBACK] Error:', e);
        setError(e?.message || 'Authentication failed');
      }
    }

    run();
  }, [router]);

  if (error) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 480, width: '100%', padding: 24, background: '#0d1117', color: '#fff', borderRadius: 12, border: '1px solid rgba(6,182,212,0.3)' }}>
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>Authentication Error</h2>
          <p style={{ marginTop: 12, color: '#ef4444' }}>Error: {error}</p>
        </div>
      </div>
    );
  }

  if (deepLinkUrl) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 480, width: '100%', padding: 24, background: '#0d1117', color: '#fff', borderRadius: 12, border: '1px solid rgba(6,182,212,0.3)' }}>
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>Authentication complete</h2>
          <p style={{ margin: 0, color: '#9ca3af' }}>Open Telegram to continue.</p>
          <div style={{ marginTop: 16 }}>
            <a
              href={deepLinkUrl}
              style={{
                display: 'inline-block',
                padding: '12px 16px',
                background: '#2481cc',
                color: '#fff',
                borderRadius: 10,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Return to Telegram
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-pano-bg-primary flex items-center justify-center">
      <div className="loader-custom"></div>
    </div>
  );
}
