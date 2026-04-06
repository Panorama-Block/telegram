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
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { isTelegramWebApp, detectTelegram } from '@/lib/isTelegram';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { clearAuthWalletBinding, persistAuthWalletBinding } from '@/shared/lib/authWalletBinding';
import { linkTelegramIdentityIfAvailable } from '@/shared/lib/telegram-link';
import { TonConnectActionButton, WalletEntryActions } from '@/shared/components/WalletEntryActions';

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
  const tonWallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const { disconnect } = useDisconnect();
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    // Robust async check
    const checkTelegramAsync = async () => {
      const isTg = await detectTelegram();
      console.log('[AuthModal] Async Telegram Detection Result:', isTg);
      if (isTg) {
        setIsTelegram(true);
      }
    };

    checkTelegramAsync();
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isTonModalOpening, setIsTonModalOpening] = useState(false);
  const authApiBase = (process.env.VITE_AUTH_API_BASE || '').replace(/\/+$/, '');

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
    const isTelegram = isTelegramWebApp();
    const isiOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const mode = isTelegram ? 'redirect' : 'popup';
    const redirectUrl = isTelegram ? `${window.location.origin}/miniapp/auth/callback` : undefined;
    const telegramAuthOptions = ['telegram', 'email'] as const;

    if (isiOS) {
      if (isTelegram) {
        return [inAppWallet({ auth: { options: telegramAuthOptions, mode, redirectUrl } })];
      }
      return [
        inAppWallet({ auth: { options: ['google', 'email', 'passkey'], mode, redirectUrl } }),
        createWallet('io.metamask', { preferDeepLink: true }),
      ];
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

  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    const prepareAuth = async () => {
      if (!authApiBase) return;
      tonConnectUI.setConnectRequestParameters({ state: 'loading' });
      try {
        const response = await fetch(`${authApiBase}/auth/ton/payload`, { method: 'POST' });
        const { payload } = await response.json();

        tonConnectUI.setConnectRequestParameters({
          state: 'ready',
          value: { tonProof: payload },
        });
      } catch (err) {
        console.error('[AuthModal] Failed to prepare TonConnect proof payload', err);
        tonConnectUI.setConnectRequestParameters(null);
      }
    };

    if (!tonWallet) {
      prepareAuth();
    }
  }, [authApiBase, tonConnectUI, tonWallet]);

  const handleTonConnect = useCallback(async () => {
    try {
      setIsTonModalOpening(true);
      await tonConnectUI.openModal();
    } catch (err) {
      console.error('[AuthModal] Failed to open TON Connect modal', err);
    } finally {
      setIsTonModalOpening(false);
    }
  }, [tonConnectUI]);

  const authenticateWithBackend = useCallback(async () => {
    const currentAddress = account?.address || tonWallet?.account.address;
    const isTon = !!tonWallet?.account.address && !account?.address;

    if (!currentAddress || !client) {
      return;
    }

    if (!authApiBase) {
      throw new Error('VITE_AUTH_API_BASE not configured');
    }

    try {
      setIsAuthenticating(true);
      setError(null);
      setStatusMessage('Initializing authentication...');

      if (isTon) {
        const proof = tonWallet.connectItems?.tonProof;

        if (proof && 'proof' in proof) {
          try {
            setStatusMessage('Verifying connection proof...');

            const verifyResponse = await fetch(`${authApiBase}/auth/ton/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                address: tonWallet.account.address,
                network: tonWallet.account.chain,
                public_key: tonWallet.account.publicKey,
                proof: {
                  ...proof.proof,
                  state_init: tonWallet.account.walletStateInit,
                },
              }),
            });

            if (!verifyResponse.ok) {
              const errorText = await verifyResponse.text();
              throw new Error(errorText || 'Wallet verification failed');
            }

            const { token } = await verifyResponse.json();
            localStorage.setItem('authToken', token);
            localStorage.setItem('authPayload', JSON.stringify({
              address: tonWallet.account.address,
              walletType: 'ton',
            }));
            localStorage.setItem('userAddress', tonWallet.account.address.toLowerCase());
            localStorage.setItem('walletAddress', tonWallet.account.address.toLowerCase());
            await linkTelegramIdentityIfAvailable(authApiBase, tonWallet.account.address, {
              address: tonWallet.account.address,
              source: 'miniapp:landing-auth-modal-ton',
            });

            setIsAuthenticated(true);
            setStatusMessage('Success! Redirecting...');

            setTimeout(() => {
              router.push('/newchat');
            }, 500);
            return;
          } catch (err) {
            console.error('[AUTH MODAL] TON proof verification failed', err);
            setError('Wallet verification failed.');
          } finally {
            setIsAuthenticating(false);
          }
        }

        setStatusMessage('Please connect your TON wallet to sign the proof...');
        return;
      }

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
      const normalizedAddress = account!.address;
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
      if (account!.address.toLowerCase() !== payload.address.toLowerCase()) {
        throw new Error(`Wallet address (${account!.address}) does not match payload (${payload.address})`);
      }

      // 2. Sign the payload using Thirdweb
      setStatusMessage('Please sign the message in your wallet...');
      let signature;

      try {
        const signResult = await signLoginPayload({
          account: account!,
          payload: payload,
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
      const { token: authToken, address, sessionId } = verifyResult;

      // 4. Persist auth data locally
      setStatusMessage('Saving session...');
      localStorage.setItem('authPayload', JSON.stringify(payload));
      localStorage.setItem('authSignature', signature);
      localStorage.setItem('authToken', authToken);
      persistAuthWalletBinding({ activeWallet, account: account! });
      await linkTelegramIdentityIfAvailable(authApiBase, address || payload.address || account!.address, {
        sessionId: sessionId || null,
        address: address || account!.address || null,
        source: 'miniapp:landing-auth-modal',
      });

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
  }, [account, client, activeWallet, authApiBase, disconnect, router, tonWallet]);

  // prevent infinite retries: only one auto-attempt per account address
  const lastTriedAddressRef = useRef<string | null>(null);

  // Automatically authenticate when the account is connected
  useEffect(() => {
    const currentAddress = account?.address || tonWallet?.account.address;
    if (!currentAddress || !client || isAuthenticated || isAuthenticating) return;
    if (lastTriedAddressRef.current === currentAddress) return;
    lastTriedAddressRef.current = currentAddress;
    authenticateWithBackend();
  }, [account, tonWallet, client, isAuthenticated, isAuthenticating, authenticateWithBackend]);

  async function handleDisconnect() {
    setError(null);
    setStatusMessage('');
    try {
      console.log('[AUTH MODAL] Disconnecting and clearing all session data...');
      if (activeWallet) {
        await disconnect(activeWallet);
      }
      if (tonWallet) {
        await tonConnectUI.disconnect();
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
      clearAuthWalletBinding();

      console.log('[AUTH MODAL] ✅ Session cleared - ready for fresh authentication');
    } catch (err: any) {
      console.error('wallet disconnect failed', err);
      setError(err?.message || 'Failed to disconnect');
    }
  }

  const connected = Boolean(account?.address || tonWallet?.account.address);
  const connectedAddress = account?.address || tonWallet?.account.address;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative mx-4 w-full max-w-sm overflow-hidden rounded-[28px] border border-white/12 bg-[#071012]/90 p-8 shadow-xl shadow-black/60 backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(70,235,244,0.16)_0%,_rgba(8,24,28,0.08)_30%,_rgba(0,0,0,0)_68%)]" />
        <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:22px_22px]" />

        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 text-gray-400 transition-colors hover:text-white"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="relative z-10">
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-3xl" />
              <div className="absolute -inset-4 rounded-full bg-cyan-500/10 blur-[80px]" />
              <Image
                src={zicoBlue}
                alt="Zico"
                width={80}
                height={80}
                className="relative h-20 w-20"
              />
            </div>
          </div>

          <div className="space-y-4">
            {typeof window !== 'undefined' && (window as any).Telegram?.WebApp && /iPhone|iPad|iPod/i.test(navigator.userAgent) && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-300/90">
                Inside Telegram, thirdweb login is limited to Telegram and Email.
              </div>
            )}
            {!connected ? (
              isTelegram ? (
                <WalletEntryActions
                  variant="modal"
                  evmAction={client ? (
                    <ConnectButton
                      client={client}
                      wallets={wallets}
                      connectModal={{ size: 'compact' }}
                      connectButton={{
                        label: 'Connect Wallet',
                        className: 'font-mono',
                        style: {
                          width: '100%',
                          minHeight: '54px',
                          padding: '14px 20px',
                          borderRadius: 16,
                          fontWeight: 600,
                          fontSize: 17,
                          fontFamily: 'var(--font-geist-mono, monospace)',
                          background: '#f8f5f0',
                          color: '#111111',
                          border: '1px solid rgba(255,255,255,0.85)',
                          cursor: 'pointer',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.24)',
                        },
                      }}
                      theme="dark"
                    />
                  ) : (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                      Missing THIRDWEB client configuration.
                    </div>
                  )}
                  tonAction={(
                    <TonConnectActionButton
                      onClick={handleTonConnect}
                      loading={isTonModalOpening}
                      disabled={isAuthenticating}
                    />
                  )}
                />
              ) : client ? (
                <WalletEntryActions
                  variant="modal"
                  evmAction={(
                    <ConnectButton
                      client={client}
                      wallets={wallets}
                      connectModal={{ size: 'compact' }}
                      connectButton={{
                        label: 'Connect Wallet',
                        className: 'font-mono',
                        style: {
                          width: '100%',
                          minHeight: '54px',
                          padding: '14px 20px',
                          borderRadius: 16,
                          fontWeight: 600,
                          fontSize: 17,
                          fontFamily: 'var(--font-geist-mono, monospace)',
                          background: '#f8f5f0',
                          color: '#111111',
                          border: '1px solid rgba(255,255,255,0.85)',
                          cursor: 'pointer',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.24)',
                        },
                      }}
                      theme="dark"
                    />
                  )}
                />
              ) : (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                  Missing THIRDWEB client configuration.
                </div>
              )
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                  <p className="mb-1 text-xs text-white/75">Connected wallet</p>
                  <p className="font-mono text-sm font-semibold text-white">
                    {connectedAddress ? shortAddress(connectedAddress) : 'Unknown wallet'}
                  </p>
                  <div className="mt-3 text-sm">
                    {isAuthenticating ? (
                      <div className="flex flex-col gap-2 text-white">
                        <div className="flex items-center gap-2">
                          <div className="loader-inline-sm" />
                          <span>Authenticating...</span>
                        </div>
                        {statusMessage && (
                          <p className="animate-pulse text-xs text-cyan-300">{statusMessage}</p>
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
                  className="w-full rounded-2xl border border-white/60 bg-white/92 px-4 py-3 font-medium text-black transition-all hover:bg-white"
                >
                  Disconnect
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="mt-4 break-all rounded bg-black/50 p-2 font-mono text-[10px] text-gray-400">
              <p>Debug Info:</p>
              <p>isTelegram state: {String(isTelegram)}</p>
              <p>window.Telegram: {typeof window !== 'undefined' ? typeof (window as any).Telegram : 'undefined'}</p>
              <p>WebApp: {typeof window !== 'undefined' && (window as any).Telegram?.WebApp ? 'Present' : 'Missing'}</p>
              <p>UserAgent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
