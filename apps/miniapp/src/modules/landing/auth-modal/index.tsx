'use client'

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { ConnectButton, useActiveAccount, useActiveWallet, useDisconnect } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { signLoginPayload } from 'thirdweb/auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import zicoBlue from '../../../../public/icons/zico_blue.svg';
import '../../../shared/ui/loader.css';
import { TonConnectButton } from '@tonconnect/ui-react';
import { isTelegramWebApp } from '@/lib/isTelegram';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const router = useRouter();
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    // Initial check
    const checkTelegram = () => {
      const isTg = isTelegramWebApp();
      console.log('[AuthModal] Checking Telegram:', isTg, typeof window !== 'undefined' ? (window as any).Telegram : 'window undefined');
      if (isTg) {
        setIsTelegram(true);
        return true;
      }
      return false;
    };

    if (checkTelegram()) return;

    // Poll for 2 seconds
    const interval = setInterval(() => {
      if (checkTelegram()) {
        clearInterval(interval);
      }
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      console.log('[AuthModal] Stopped polling for Telegram');
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
    if (typeof window === 'undefined') return [inAppWallet()];
    const WebApp = (window as any).Telegram?.WebApp;
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
      inAppWallet({ auth: { options: ['google', 'telegram', 'email'], mode, redirectUrl } }),
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

  const [statusMessage, setStatusMessage] = useState<string>('');

  const authenticateWithBackend = useCallback(async () => {
    if (!account || !client) {
      return;
    }

    const authApiBase = (process.env.VITE_AUTH_API_BASE || '').replace(/\/+$/, '');
    if (!authApiBase) {
      throw new Error('VITE_AUTH_API_BASE not configured');
    }

    try {
      setIsAuthenticating(true);
      setError(null);
      setStatusMessage('Initializing authentication...');

      // 0. Extract and save wallet auth token for persistence
      setStatusMessage('Checking wallet session...');
      try {
        const clientId = THIRDWEB_CLIENT_ID;
        if (clientId && activeWallet) {
          // ... (existing token extraction logic) ...
          const walletAny = activeWallet as any;
          // Check if wallet has getAuthToken method
          if (typeof walletAny.getAuthToken === 'function') {
            const authToken = await walletAny.getAuthToken();
            if (authToken) {
              localStorage.setItem(`walletToken-${clientId}`, authToken);
            }
          } else {
            // Check various possible token locations
            const possibleTokenKeys = ['_authToken', 'authToken', 'token', 'sessionToken', 'accessToken', 'authDetails', 'storedToken'];
            let foundToken = null;

            for (const key of possibleTokenKeys) {
              if (walletAny[key]) {
                if (typeof walletAny[key] === 'string' && walletAny[key].length > 20) {
                  foundToken = walletAny[key];
                  break;
                } else if (typeof walletAny[key] === 'object') {
                  if (walletAny[key].cookieString) {
                    foundToken = walletAny[key].cookieString;
                    break;
                  }
                }
              }
            }

            if (foundToken) {
              localStorage.setItem(`walletToken-${clientId}`, foundToken);
            }
          }
        }
      } catch (tokenError) {
        console.error('[AUTH MODAL] Failed to extract wallet auth token:', tokenError);
      }

      // 1. Get payload from backend
      setStatusMessage('Requesting login payload...');
      const normalizedAddress = account.address;
      const loginPayload = { address: normalizedAddress };

      console.log('🔍 [AUTH MODAL] Authenticating with:', authApiBase);

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
      if (account.address.toLowerCase() !== payload.address.toLowerCase()) {
        throw new Error(`Wallet address (${account.address}) does not match payload (${payload.address})`);
      }

      // 2. Sign the payload using Thirdweb
      setStatusMessage('Please sign the message in your wallet...');
      let signature;

      try {
        const signResult = await signLoginPayload({
          account: account,
          payload: payload
        });

        if (typeof signResult === 'string') {
          signature = signResult;
        } else if (signResult && signResult.signature) {
          signature = signResult.signature;
        } else if (signResult && typeof signResult === 'object') {
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
        console.error('❌ [AUTH MODAL] Thirdweb signature error:', error);
        setStatusMessage('Standard signing failed, trying fallback...');

        // Fallback to direct signing if signLoginPayload fails
        try {
          if (activeWallet && typeof (activeWallet as any).signMessage === 'function') {
            const messageToSign = JSON.stringify(payload);
            signature = await (activeWallet as any).signMessage({ message: messageToSign });
          } else {
            throw new Error('Signature method not available');
          }
        } catch (fallbackError) {
          console.error('❌ [AUTH MODAL] Fallback also failed:', fallbackError);
          throw new Error(`Signing error: ${error}. Fallback: ${fallbackError}`);
        }
      }

      // 3. Verify the signature with the backend
      setStatusMessage('Verifying signature...');
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
      const { token: authToken } = verifyResult;

      // 4. Persist auth data locally
      setStatusMessage('Saving session...');
      localStorage.setItem('authPayload', JSON.stringify(payload));
      localStorage.setItem('authSignature', signature);
      localStorage.setItem('authToken', authToken);

      // 4.5. Verify wallet session token persistence
      const clientId = THIRDWEB_CLIENT_ID;
      const walletToken = localStorage.getItem(`walletToken-${clientId}`);

      if (walletToken) {
        console.log('[AUTH MODAL] ✅ Wallet session token is persisted - auto-connect will work on reload');
      } else {
        console.warn('[AUTH MODAL] ⚠️ Wallet session token NOT persisted - user may need to reconnect on reload');
      }

      setIsAuthenticated(true);
      setStatusMessage('Success! Redirecting...');

      console.log('✅ [AUTH MODAL] Authentication succeeded!');

      // 5. Redirect to /newchat (page that creates a conversation and opens chat)
      console.log('[AUTH MODAL] Redirecting to /newchat...');

      setTimeout(() => {
        router.push('/newchat');
      }, 500);

    } catch (err: any) {
      console.error('❌ [AUTH MODAL] Authentication failed:', err);
      setStatusMessage('');

      let errorMessage = err?.message || 'Authentication failed';

      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        errorMessage = `Connection error with ${authApiBase}. Make sure the server is running and reachable.`;
      }

      // Handle stale session / no auth token error
      if (
        errorMessage.includes('No auth token found') ||
        errorMessage.includes('Signature method not available') ||
        errorMessage.includes('User rejected')
      ) {
        console.warn('[AUTH MODAL] Stale session or user rejection detected. Disconnecting wallet to reset state.');
        if (activeWallet) {
          try {
            await disconnect(activeWallet);
          } catch (disconnectErr) {
            console.error('[AUTH MODAL] Failed to disconnect stale wallet:', disconnectErr);
          }
        }
        errorMessage = 'Session expired or invalid. Please connect your wallet again.';
      }

      setError(errorMessage);
      setIsAuthenticated(false);
    } finally {
      setIsAuthenticating(false);
    }
  }, [account, client, activeWallet, router]);

  // prevent infinite retries: only one auto-attempt per account address
  const lastTriedAddressRef = useRef<string | null>(null);

  // Automatically authenticate when the account is connected
  useEffect(() => {
    if (!account || !client || isAuthenticated || isAuthenticating) return;
    if (lastTriedAddressRef.current === account.address) return;
    lastTriedAddressRef.current = account.address;
    authenticateWithBackend();
  }, [account, client, isAuthenticated, isAuthenticating, authenticateWithBackend]);

  async function handleDisconnect() {
    setError(null);
    setStatusMessage('');
    try {
      console.log('[AUTH MODAL] Disconnecting and clearing all session data...');
      if (activeWallet) {
        await disconnect(activeWallet);
      }
      setIsAuthenticated(false);

      // Clear all auth-related data
      const clientId = THIRDWEB_CLIENT_ID;
      localStorage.removeItem('authToken');
      localStorage.removeItem('authPayload');
      localStorage.removeItem('authSignature');
      localStorage.removeItem(`walletToken-${clientId}`);
      localStorage.removeItem(`walletSession-${clientId}`);
      localStorage.removeItem(`thirdwebEwsWalletUserId-${clientId}`);

      console.log('[AUTH MODAL] ✅ Session cleared - ready for fresh authentication');
    } catch (err: any) {
      console.error('wallet disconnect failed', err);
      setError(err?.message || 'Failed to disconnect');
    }
  }

  const connected = Boolean(account?.address);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#202020]/80 backdrop-blur-lg border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-xl shadow-black/50">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <Image
              src={zicoBlue}
              alt="Zico"
              width={80}
              height={80}
              className="w-20 h-20"
            />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-gray-400 text-sm">
            Get started with AI-powered DeFi tools
          </p>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {typeof window !== 'undefined' && (window as any).Telegram?.WebApp && /iPhone|iPad|iPod/i.test(navigator.userAgent) && (
            <div className="text-yellow-300/90 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
              On iOS (Telegram), Google blocks sign-in inside webviews. Use Email/Passkey or
              <button
                onClick={openGoogleInBrowser}
                className="ml-1 underline text-yellow-300 hover:text-yellow-200"
              >
                open in browser
              </button>
              .
            </div>
          )}
          {!connected ? (
            isTelegram ? (
              <div className="flex justify-center w-full">
                <TonConnectButton className="w-full" />
              </div>
            ) : client ? (
              <ConnectButton
                client={client}
                wallets={wallets}
                connectModal={{ size: 'compact' }}
                connectButton={{
                  label: 'Connect Wallet',
                  style: {
                    width: '100%',
                    padding: '12px 20px',
                    borderRadius: 6,
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
              <div className="text-red-400 text-sm p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                Missing THIRDWEB client configuration.
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div className="border border-white/10 bg-black/40 backdrop-blur-md rounded-xl p-4">
                <p className="text-xs text-white mb-1">Connected wallet</p>
                <p className="font-mono text-sm text-white font-semibold">
                  {shortAddress(account!.address)}
                </p>
                <div className="text-sm mt-2">
                  {isAuthenticating ? (
                    <div className="flex flex-col gap-2 text-white">
                      <div className="flex items-center gap-2">
                        <div className="loader-inline-sm" />
                        <span>Authenticating...</span>
                      </div>
                      {statusMessage && (
                        <p className="text-xs text-cyan-400 animate-pulse">{statusMessage}</p>
                      )}
                    </div>
                  ) : isAuthenticated ? (
                    <div className="flex items-center gap-2 text-white">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Authenticated! Redirecting...</span>
                    </div>
                  ) : (
                    <span className="text-white">Waiting for authentication</span>
                  )}
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                className="w-full px-4 py-3 rounded-lg bg-white text-black border-none hover:bg-gray-100 transition-all font-medium"
              >
                Disconnect
              </button>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              {error}
            </div>
          )}

          {/* Debug Info */}
          <div className="mt-4 p-2 bg-black/50 rounded text-[10px] font-mono text-gray-400 break-all">
            <p>Debug Info:</p>
            <p>isTelegram state: {String(isTelegram)}</p>
            <p>window.Telegram: {typeof window !== 'undefined' ? typeof (window as any).Telegram : 'undefined'}</p>
            <p>WebApp: {typeof window !== 'undefined' && (window as any).Telegram?.WebApp ? 'Present' : 'Missing'}</p>
            <p>UserAgent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
