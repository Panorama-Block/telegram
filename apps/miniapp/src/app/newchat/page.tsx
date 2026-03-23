'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ConnectButton, useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { signLoginPayload } from 'thirdweb/auth';
import Image from 'next/image';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { DEBUG } from '@/shared/config/debug';
import '@/shared/ui/loader.css';
import { useTonWallet, useTonConnectUI } from '@tonconnect/ui-react';
import { isTelegramWebApp, detectTelegram } from '@/lib/isTelegram';
import { useLogout } from '@/shared/hooks/useLogout';
import { persistAuthWalletBinding } from '@/shared/lib/authWalletBinding';
import { linkTelegramIdentityIfAvailable } from '@/shared/lib/telegram-link';
import { TonConnectActionButton, WalletEntryActions } from '@/shared/components/WalletEntryActions';

export default function NewChatPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const tonWallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const { logout, isLoggingOut } = useLogout();

  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTonModalOpening, setIsTonModalOpening] = useState(false);
  const hasTriedAutoConnectRef = useRef(false);
  const hasTriedManualConnectRef = useRef(false);
  const connectButtonRef = useRef<HTMLDivElement>(null);
  const lastTriedAddressRef = useRef<string | null>(null);
  const [isTelegram, setIsTelegram] = useState(false);
  const isTelegramEnv = isTelegramWebApp() || isTelegram;
  const authApiBase = (process.env.VITE_AUTH_API_BASE || '').replace(/\/+$/, '');


  useEffect(() => {
    // Robust async check
    const checkTelegramAsync = async () => {
      const isTg = await detectTelegram();
      console.log('[NewChat] Async Telegram Detection Result:', isTg);
      if (isTg) {
        setIsTelegram(true);
      }
    };

    checkTelegramAsync();
  }, []);

  useEffect(() => {
    // Fetch the payload (nonce) early and attach it to the TonConnect proof request.
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
        console.error('[NewChat] Failed to prepare TonConnect proof payload', err);
        tonConnectUI.setConnectRequestParameters(null);
      }
    };

    if (!tonWallet) {
      prepareAuth();
    }
  }, [authApiBase, tonConnectUI, tonWallet]);

  // Client setup
  const client = useMemo(() => {
    const clientId = THIRDWEB_CLIENT_ID;
    if (!clientId) {
      console.warn('No THIRDWEB_CLIENT_ID found');
      return null;
    }
    try {
      return createThirdwebClient({ clientId });
    } catch (err) {
      console.error('Failed to create thirdweb client', err);
      return null;
    }
  }, []);

  // Wallet configuration
  const wallets = useMemo(() => {
    if (typeof window === 'undefined') return [inAppWallet()];
    const isTelegram = isTelegramWebApp();
    const isiOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const mode = isTelegram ? 'redirect' : 'popup';
    const redirectUrl = isTelegram ? `${window.location.origin}/miniapp/auth/callback` : undefined;
    const telegramAuthOptions = ['telegram', 'email'] as const;

    if (isiOS) {
      return [inAppWallet({
        auth: {
          options: isTelegram ? telegramAuthOptions : ['google', 'telegram', 'email', 'passkey'],
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

  // Auto-connect wallet on mount if not connected
  useEffect(() => {
    const autoConnectWallet = async () => {
      if (account || tonWallet || hasTriedAutoConnectRef.current || !client || isTelegramWebApp()) return;

      hasTriedAutoConnectRef.current = true;
      setIsConnecting(true);

      try {
        // Try to autoConnect first (for returning users)
        const wallet = inAppWallet();
        const connectedAccount = await wallet.autoConnect({ client });

        if (!connectedAccount) {
          // If autoConnect fails, user needs to manually connect
          // The ConnectButton will handle this
          setIsConnecting(false);
        }
      } catch {
        console.log('[NEWCHAT] AutoConnect not available, user needs to connect manually');
      } finally {
        setIsConnecting(false);
      }
    };

    autoConnectWallet();
  }, [account, tonWallet, client]);

  // Auto-click connect button if autoConnect fails
  useEffect(() => {
    if (!account && !tonWallet && !isConnecting && hasTriedAutoConnectRef.current && !hasTriedManualConnectRef.current && connectButtonRef.current) {
      const timer = setTimeout(() => {
        const button = connectButtonRef.current?.querySelector('button');
        if (button) {
          button.click();
          hasTriedManualConnectRef.current = true;
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [account, tonWallet, isConnecting]);

  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showRetryPrompt, setShowRetryPrompt] = useState(false);

  const handleTonConnect = useCallback(async () => {
    try {
      setIsTonModalOpening(true);
      await tonConnectUI.openModal();
    } catch (err) {
      console.error('[NewChat] Failed to open TON Connect modal', err);
    } finally {
      setIsTonModalOpening(false);
    }
  }, [tonConnectUI]);

  const thirdwebConnectButton = client ? (
    <ConnectButton
      client={client}
      wallets={wallets}
      connectModal={{ size: 'compact' }}
      connectButton={{
        label: 'Connect Wallet',
        className: 'font-mono',
        style: {
          minHeight: '54px',
          padding: '14px 20px',
          borderRadius: '16px',
          fontWeight: 600,
          fontSize: '17px',
          fontFamily: 'var(--font-geist-mono, monospace)',
          background: '#f8f5f0',
          color: '#111111',
          border: '1px solid rgba(255,255,255,0.85)',
          cursor: 'pointer',
          width: '100%',
          boxShadow: '0 10px 30px rgba(0,0,0,0.24)',
        },
      }}
      theme="dark"
    />
  ) : (
    <div className="text-xs text-red-400">Missing THIRDWEB_CLIENT_ID</div>
  );

  // Authenticate with backend
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
        // --- TON Authentication Flow ---
        const proof = tonWallet.connectItems?.tonProof;

        if (proof && 'proof' in proof) {
          try {
            setIsAuthenticating(true);
            setStatusMessage('Verifying connection proof...');

            console.log('🔍 [NEWCHAT][TON] Verifying proof at:', `${authApiBase}/auth/ton/verify`);
            console.log('🧾 [NEWCHAT][TON] Proof payload:', {
              address: tonWallet.account.address,
              network: tonWallet.account.chain,
              public_key: tonWallet.account.publicKey?.slice(0, 8) ? `${tonWallet.account.publicKey.slice(0, 8)}...` : undefined,
              proof: proof.proof,
              state_init: tonWallet.account.walletStateInit ? '[present]' : '[missing]',
            });

            const verifyResponse = await fetch(`${authApiBase}/auth/ton/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                address: tonWallet.account.address,
                network: tonWallet.account.chain,
                public_key: tonWallet.account.publicKey,
                proof: {
                  ...proof.proof,
                  state_init: tonWallet.account.walletStateInit, // Required for some backends
                }
              })
            });

            console.log('📡 [NEWCHAT][TON] Verify response status:', verifyResponse.status);
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
              source: 'miniapp:newchat-ton',
            });
            setIsAuthenticated(true);
            router.push('/chat?new=true');
            return; // End of TON flow
          } catch (err) {
            console.error("Proof verification failed", err);
            setError("Wallet verification failed.");
          } finally {
            setIsAuthenticating(false);
          }
        }
        setStatusMessage('Please connect your TON wallet to sign the proof...');
        return; // End of TON flow when proof is missing
      }

      // --- EVM Authentication Flow (Thirdweb) ---
      // 1. Get payload from backend
      setStatusMessage('Requesting login payload...');
      const loginPayload = { address: currentAddress };

      console.log('🔍 [NEWCHAT] Authenticating with:', authApiBase, loginPayload);

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
      if (currentAddress.toLowerCase() !== payload.address.toLowerCase()) {
        throw new Error(`Wallet address (${currentAddress}) does not match payload (${payload.address})`);
      }

      // 2. Sign the payload
      setStatusMessage('Please sign the message in your wallet...');
      let signature;

      try {
        // Thirdweb Signing Logic
        const signResult = await signLoginPayload({
          account: account!,
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
        console.error('❌ [NEWCHAT] Signature error:', error);
        setStatusMessage('Standard signing failed, trying fallback...');
        // Fallback to direct signing if signLoginPayload fails (EVM only)
        try {
          if (activeWallet && typeof (activeWallet as any).signMessage === 'function') {
            const messageToSign = JSON.stringify(payload);
            signature = await (activeWallet as any).signMessage({ message: messageToSign });
          } else {
            throw new Error('Signature method not available');
          }
        } catch (fallbackError) {
          console.error('❌ [NEWCHAT] Fallback also failed:', fallbackError);
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
      persistAuthWalletBinding({ activeWallet, account });

      await linkTelegramIdentityIfAvailable(authApiBase, address || payload.address || currentAddress, {
        sessionId: sessionId || null,
        address: address || currentAddress || null,
        source: 'miniapp:newchat',
      });

      setIsAuthenticated(true);
      setStatusMessage('Success! Redirecting to chat...');

      console.log('✅ [NEWCHAT] Authentication succeeded! Redirecting to /chat...');

      // 5. Redirect to /chat (bootstrap will create a new conversation automatically)
      setTimeout(() => {
        router.push('/chat?new=true');
      }, 500);

    } catch (err: any) {
      console.error('❌ [NEWCHAT] Authentication failed:', err);
      setStatusMessage('');

      let errorMessage = err?.message || 'Authentication failed';

      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        errorMessage = `Connection error with ${authApiBase}. Make sure the server is running and reachable.`;
      }

      setError(errorMessage);
      setIsAuthenticated(false);
    } finally {
      setIsAuthenticating(false);
    }
  }, [account, client, activeWallet, authApiBase, router, tonWallet]);

  // Auto-authenticate when account is connected
  useEffect(() => {
    const currentAddress = account?.address || tonWallet?.account.address;
    if (!currentAddress || !client || isAuthenticated || isAuthenticating) return;

    if (lastTriedAddressRef.current === currentAddress) return;

    // Already authenticated — go straight to a fresh chat (welcome screen with "Hello, <user>")
    const existingToken = localStorage.getItem('authToken');
    if (existingToken) {
      router.replace('/chat?new=true');
      return;
    }

    lastTriedAddressRef.current = currentAddress;
    authenticateWithBackend();
  }, [account, tonWallet, client, isAuthenticated, isAuthenticating, authenticateWithBackend, router]);

  // Determine label text
  const getLabelText = () => {
    if (error) return 'Error occurred';
    if (isAuthenticating) return 'Authenticating...';
    if (isAuthenticated) return 'Success! Redirecting...';
    if (isConnecting) return 'Setting up your workspace...';
    if (!account && !tonWallet) return '';
    return '';
  };

  const connected = Boolean(account?.address || tonWallet?.account.address);
  const showFreshConnect = isTelegramEnv && (isConnecting || (isAuthenticating && statusMessage.toLowerCase().includes('ton')));
  const showConnectOptions = !isAuthenticating && !connected;

  useEffect(() => {
    if (!showFreshConnect) {
      setShowRetryPrompt(false);
      return;
    }
    const timer = setTimeout(() => setShowRetryPrompt(true), 15000);
    return () => clearTimeout(timer);
  }, [showFreshConnect]);

  // Show error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-pano-bg-primary flex items-center justify-center">
        <div className="max-w-md w-full mx-4 p-6 bg-pano-surface border border-pano-error/30 rounded-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="text-pano-error text-lg font-semibold mb-2">Authentication Error</div>
            <p className="text-pano-text-secondary text-sm mb-4">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2 bg-pano-primary text-pano-text-inverse rounded-lg hover:bg-pano-primary-hover transition-colors font-medium"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#040707]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(70,235,244,0.18)_0%,_rgba(7,18,20,0.12)_26%,_rgba(0,0,0,0)_56%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.34)_0%,rgba(0,0,0,0.84)_100%)]" />

      <div className="relative flex w-full max-w-[360px] flex-col items-center justify-center gap-8 px-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-cyan-400/25 blur-3xl" />
          <div className="absolute -inset-6 rounded-full bg-cyan-500/10 blur-[90px]" />
          <Image
            src={zicoBlue}
            alt="Zico Blue"
            width={160}
            height={160}
            className="relative h-32 w-32 lg:h-40 lg:w-40"
          />
        </div>

        <div className="min-h-[52px] text-center">
          {!showConnectOptions && (
            <p className="text-lg font-medium text-white">
              {getLabelText()}
            </p>
          )}
          {statusMessage && isAuthenticating && (
            <p className="mt-2 font-mono text-sm text-cyan-300 animate-pulse">
              {statusMessage}
            </p>
          )}
          {showFreshConnect && showRetryPrompt && (
            <button
              onClick={async () => {
                try {
                  await tonConnectUI?.disconnect?.();
                } catch (err) {
                  console.warn('[NewChat] TON disconnect failed:', err);
                }
                await logout({ redirect: false });
                if (typeof window !== 'undefined') {
                  window.location.href = '/miniapp';
                }
              }}
              disabled={isLoggingOut}
              className="mt-2 rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoggingOut ? 'Resetting...' : "Didn't get the confirmation? Tap here"}
            </button>
          )}
        </div>

        {isAuthenticating ? (
          <div className="flex items-center gap-2">
            <div className="loader-inline-sm" />
          </div>
        ) : !connected ? (
          <div ref={connectButtonRef} className="mt-2 flex w-full flex-col items-center">
            {isTelegramEnv ? (
              <WalletEntryActions
                variant="page"
                evmAction={thirdwebConnectButton}
                tonAction={(
                  <TonConnectActionButton
                    onClick={handleTonConnect}
                    loading={isTonModalOpening}
                    disabled={isAuthenticating || isConnecting}
                  />
                )}
              />
            ) : (
              <WalletEntryActions variant="page" evmAction={thirdwebConnectButton} />
            )}

            {DEBUG &&
              <div className="mt-8 max-w-xs break-all rounded-lg bg-black/50 p-3 text-left font-mono text-[10px] text-gray-400">
                <p className="mb-1 font-bold text-gray-300">Debug Info:</p>
                <p>isTelegram state: <span className={isTelegram ? "text-green-400" : "text-yellow-400"}>{String(isTelegram)}</span></p>
                <p>window.Telegram: {typeof window !== 'undefined' ? typeof (window as any).Telegram : 'undefined'}</p>
                <p>WebApp: {typeof window !== 'undefined' && (window as any).Telegram?.WebApp ? 'Present' : 'Missing'}</p>
                <p>UserAgent: {typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 50) + '...' : 'N/A'}</p>
              </div>
            }
          </div>
        ) : null}
      </div>
    </div>
  );
}
