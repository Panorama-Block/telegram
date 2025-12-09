import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { ConnectButton, useActiveAccount, useActiveWallet, useDisconnect } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { signLoginPayload } from 'thirdweb/auth';

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
  const { disconnect } = useDisconnect();
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [jwtToken, setJwtToken] = useState('');

  const client = useMemo(() => {
    const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || undefined;
    if (!clientId) {
      console.warn('No THIRDWEB_CLIENT_ID found')
      return null;
    }
    try {
      return createThirdwebClient({ clientId });
    } catch (err) {
      console.error('Failed to create thirdweb client', err);
      return null;
    }
  }, []);

  const wallets = useMemo(() => {
    const WebApp = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : undefined;
    const isTelegram = !!WebApp;
    const isiOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const mode = isTelegram ? 'redirect' : 'popup';
    const redirectUrl = isTelegram ? `${window.location.origin}/miniapp/auth/callback` : undefined;

    if (isiOS) {
      // iOS WebView: prefer email/passkey/guest only
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
          options: ['google', 'telegram', 'email', 'guest'],
          mode,
          redirectUrl,
        },
      }),
      createWallet('io.metamask', { preferDeepLink: true }),
    ];
  }, []);

  // moved below to avoid "used before declaration" TS error

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

  const authenticateWithBackend = useCallback(async (overrideAccount?: { address: string } | null) => {
    const effectiveAccount = overrideAccount ?? account;
    if (!effectiveAccount || !client) {
      return;
    }

    const authApiBase = (process.env.VITE_AUTH_API_BASE || '').replace(/\/+$/, '');
    if (!authApiBase) {
      throw new Error('VITE_AUTH_API_BASE not configured');
    }

    try {
      setIsAuthenticating(true);
      setError(null);

      // 1. Request payload from the backend (same flow as the wallet page)
      const normalizedAddress = effectiveAccount.address;

      const loginPayload = { address: normalizedAddress };

      console.log('🔍 [AUTH DEBUG] authApiBase:', authApiBase);
      console.log('🔍 [AUTH DEBUG] process.env.VITE_AUTH_API_BASE:', process.env.VITE_AUTH_API_BASE);
      console.log('🔍 [AUTH DEBUG] Requesting:', `${authApiBase}/auth/login`);

      const loginResponse = await fetch(`${authApiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginPayload)
      });


      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        throw new Error(error.error || 'Failed to generate payload');
      }

      const { payload } = await loginResponse.json();

      // Ensure the addresses match
      if (effectiveAccount.address.toLowerCase() !== payload.address.toLowerCase()) {
        throw new Error(`Wallet address (${effectiveAccount.address}) does not match payload (${payload.address})`);
      }

      // 2. Sign payload via Thirdweb (same approach used in swap)
      let signature;
      

      try {
        // Use signLoginPayload from Thirdweb (official auth helper)
        const signResult = await signLoginPayload({
          account: effectiveAccount as any,
          payload: payload
        });
        
        // Extrair signature do resultado
        if (typeof signResult === 'string') {
          signature = signResult;
        } else if (signResult && signResult.signature) {
          signature = signResult.signature;
        } else if (signResult && typeof signResult === 'object') {
          // Try different keys that may contain the signature
          const possibleSignature = signResult.signature || (signResult as any).sig || (signResult as any).signatureHex;
          if (possibleSignature) {
            signature = possibleSignature;
          } else {
            throw new Error('Invalid signature format - no signature found');
          }
        } else {
          throw new Error('Invalid signature format');
        }
        
      } catch (error) {
        console.error('❌ [AUTH DEBUG] Thirdweb signature error:', error);
        
        // Fallback to direct sign method if signLoginPayload fails
        try {
          
          // For In-App Wallet we might need to call the native sign method directly
          if (activeWallet && typeof (activeWallet as any).signMessage === 'function') {
            const messageToSign = JSON.stringify(payload);
            signature = await (activeWallet as any).signMessage({ message: messageToSign });
          } else {
            throw new Error('Signature method not available');
          }
        } catch (fallbackError) {
          console.error('❌ [AUTH DEBUG] Fallback also failed:', fallbackError);
          throw new Error(`Signing error: ${error}. Fallback: ${fallbackError}`);
        }
      }

      // 3. Verify signature with the backend (same as wallet page)
      const verifyPayload = { payload, signature };

      const verifyResponse = await fetch(`${authApiBase}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyPayload)
      });


      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        throw new Error(error.error || 'Verification error');
      }

      const verifyResult = await verifyResponse.json();
      
      const { token: authToken, address, sessionId } = verifyResult;
      
      // 4. Persist payload and signature for the Gateway
      localStorage.setItem('authPayload', JSON.stringify(payload));
      localStorage.setItem('authSignature', signature);
      
      // 5. Save token locally (same as wallet page)
      localStorage.setItem('authToken', authToken);
      setIsAuthenticated(true);
      setJwtToken(authToken);
      setAuthMessage('Authenticated successfully!');

      // 5. Authentication is done — no need to notify the Gateway here

      // 6. Auth flow finished successfully

    } catch (err: any) {
      console.error('❌ [AUTH DEBUG] Authentication failed:', err);
      console.error('❌ [AUTH DEBUG] Error type:', err.name);
      console.error('❌ [AUTH DEBUG] Error stack:', err.stack);

      let errorMessage = err?.message || 'Authentication failed';

      // Detect network/CORS errors
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        errorMessage = `Connection error with ${authApiBase}. Verify that the server is running and reachable.`;
      }

      setError(errorMessage);
      setAuthMessage(`❌ Error: ${errorMessage}`);
      setIsAuthenticated(false);
    } finally {
      setIsAuthenticating(false);
    }
  }, [account, client, activeWallet]);

  // Guest connect (after authenticateWithBackend is declared)
  const connectGuest = useCallback(async () => {
    try {
      if (!client) return;
      const wallet = inAppWallet();
      const guestAccount = await wallet.connect({ client, strategy: 'guest' } as any);
      if (guestAccount?.address) {
        await authenticateWithBackend(guestAccount as any);
      }
    } catch (e) {
      console.error('[GUEST LOGIN] Failed:', e);
      setError('Guest sign-in failed');
    }
  }, [client, authenticateWithBackend]);

  // Automatically authenticate when the wallet is connected
  // Avoid infinite retries: attempt once per address
  const lastTriedAddressRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!account || !client || isAuthenticated || isAuthenticating) return;
    if (lastTriedAddressRef.current === account.address) return;
    lastTriedAddressRef.current = account.address;
    authenticateWithBackend();
  }, [account, client, isAuthenticated, isAuthenticating, authenticateWithBackend]);

  async function handleDisconnect() {
    setError(null);
    try {
      if (activeWallet) {
        await disconnect(activeWallet);
      }
      // Clear authentication state
      setIsAuthenticated(false);
      setAuthMessage('');
      setJwtToken('');
      localStorage.removeItem('authToken');
      localStorage.removeItem('authPayload');
      localStorage.removeItem('authSignature');
    } catch (err: any) {
      console.error('wallet disconnect failed', err);
      setError(err?.message || 'Failed to disconnect');
    }
  }

  const connected = Boolean(account?.address);

  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {typeof window !== 'undefined' && (window as any).Telegram?.WebApp && /iPhone|iPad|iPod/i.test(navigator.userAgent) && (
        <div style={{ fontSize: 13, color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', padding: 12, borderRadius: 8 }}>
          On iOS (Telegram), Google blocks sign-in inside webviews. Use Email/Passkey or
          <button
            onClick={openGoogleInBrowser}
            style={{ marginLeft: 6, color: '#fbbf24', textDecoration: 'underline', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            open in browser
          </button>
          .
          <div style={{ marginTop: 8 }}>
            <button
              onClick={connectGuest}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(251,191,36,0.6)',
                background: 'transparent',
                color: '#fbbf24',
                cursor: 'pointer',
              }}
            >
              Continue as guest
            </button>
          </div>
        </div>
      )}
      {typeof window !== 'undefined' && (window as any).Telegram?.WebApp && /Android/i.test(navigator.userAgent) && (
        <div style={{ fontSize: 13, color: '#93c5fd', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', padding: 12, borderRadius: 8 }}>
          On Android (Telegram), connect using the MetaMask app, or
          <button
            onClick={openGoogleInBrowser}
            style={{ marginLeft: 6, color: '#93c5fd', textDecoration: 'underline', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            open Google in browser
          </button>
          :
          <button
            onClick={() => {
              try {
                const WebApp = (window as any).Telegram?.WebApp;
                const url = `${window.location.origin}/miniapp/auth/wallet-external?wallet=metamask`;
                if (WebApp?.openLink) {
                  WebApp.openLink(url, { try_instant_view: false });
                } else {
                  window.open(url, '_blank');
                }
              } catch {
                window.open(`${window.location.origin}/miniapp/auth/wallet-external?wallet=metamask`, '_blank');
              }
            }}
            style={{ marginLeft: 6, color: '#93c5fd', textDecoration: 'underline', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            Open MetaMask
          </button>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <WalletIcon size={24} />
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>Wallet</h2>
      </div>
      {!connected ? (
        client ? (
          <ConnectButton
            client={client}
            wallets={wallets}
            connectModal={{ size: 'compact' }}
            connectButton={{
              label: 'Connect Wallet',
              style: {
                width: '100%',
                padding: '16px 24px',
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 16,
                background: '#ffffff',
                color: '#000000',
                border: 'none',
                cursor: 'pointer',
              },
            }}
            theme="dark"
          />
        ) : (
          <div style={{ color: '#ef4444', fontSize: 14, padding: '12px', background: '#1a1a1a', borderRadius: 8 }}>
            Missing THIRDWEB client configuration.
          </div>
        )
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: 12,
              padding: 16,
              textAlign: 'left',
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: '#ffffff' }}>Connected wallet</p>
            <p
              style={{
                margin: '8px 0 0',
                fontFamily: 'monospace',
                fontSize: 15,
                color: '#ffffff',
                wordBreak: 'break-all',
                fontWeight: 600,
              }}
            >
              {shortAddress(account!.address)}
            </p>
            <div style={{ fontSize: 13, color: '#ffffff', marginTop: 8 }}>
              {isAuthenticating ? 'Authenticating...' : isAuthenticated ? 'Authenticated successfully!' : 'Connect to authenticate'}
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            style={{
              width: '100%',
              padding: '12px 20px',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              background: '#ffffff',
              color: '#000000',
              border: 'none',
              cursor: isDisconnecting ? 'not-allowed' : 'pointer',
              opacity: isDisconnecting ? 0.6 : 1,
            }}
          >
            {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      )}
      {error && (
        <div style={{ color: '#ef4444', fontSize: 14, padding: '12px', background: '#1a1a1a', borderRadius: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default WalletConnectPanel;
