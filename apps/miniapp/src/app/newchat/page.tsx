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
import '@/shared/ui/loader.css';
import { TonConnectButton, useTonWallet, useTonConnectUI } from '@tonconnect/ui-react';
import { isTelegramWebApp } from '@/lib/isTelegram';
import { useLogout } from '@/shared/hooks/useLogout';

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
  const hasTriedAutoConnectRef = useRef(false);
  const hasTriedManualConnectRef = useRef(false);
  const connectButtonRef = useRef<HTMLDivElement>(null);
  const lastTriedAddressRef = useRef<string | null>(null);
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    // Initial check
    const checkTelegram = () => {
      const isTg = isTelegramWebApp();
      console.log('[NewChat] Checking Telegram:', isTg, typeof window !== 'undefined' ? (window as any).Telegram : 'window undefined');
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
      console.log('[NewChat] Stopped polling for Telegram');
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

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

  // Auto-connect wallet on mount if not connected
  useEffect(() => {
    const autoConnectWallet = async () => {
      if (account || tonWallet || hasTriedAutoConnectRef.current || !client) return;

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
      } catch (err) {
        console.log('[NEWCHAT] AutoConnect not available, user needs to connect manually');
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
  }, [account, tonWallet, isConnecting, hasTriedAutoConnectRef.current]);

  const [statusMessage, setStatusMessage] = useState<string>('');

  // Authenticate with backend
  const authenticateWithBackend = useCallback(async () => {
    const currentAddress = account?.address || tonWallet?.account.address;
    const isTon = !!tonWallet?.account.address && !account?.address;

    if (!currentAddress || !client) {
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

      if (isTon) {
        // --- TON Authentication Flow ---
        setStatusMessage('Requesting TON login payload...');
        console.log('🔍 [NEWCHAT] Requesting TON payload from:', `${authApiBase}/auth/ton/payload`);

        const payloadResponse = await fetch(`${authApiBase}/auth/ton/payload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: currentAddress })
        });

        if (!payloadResponse.ok) {
          const errorText = await payloadResponse.text();
          throw new Error(`Failed to get TON payload: ${errorText}`);
        }

        const { payload: proofPayload } = await payloadResponse.json();

        setStatusMessage('Please sign the message in your TON wallet...');

        // Construct the data to sign
        // The backend expects a specific format for verifyTonSignature
        // We need to use the wallet to sign this payload.
        // Since we are in a browser environment, we use the timestamp and domain.
        const timestamp = Math.floor(Date.now() / 1000);
        const domain = window.location.host;

        // Note: tonConnectUI.connector.signData is the standard way if supported.
        // If the wallet doesn't support signData, we might be stuck.
        // We'll try to cast and use it.
        const connector = (tonConnectUI as any).connector;
        if (!connector || typeof connector.signData !== 'function') {
          throw new Error('Wallet does not support signData');
        }

        // IMPORTANT: The backend `verifyTonSignature` expects `publicKey`.
        const publicKey = tonWallet?.account.publicKey;
        if (!publicKey) throw new Error('TON Wallet public key not found');

        let signature = '';
        let signedTimestamp = String(Math.floor(Date.now() / 1000));

        try {
          const response = await (tonConnectUI as any).connector.signData({
            type: 'text',
            text: proofPayload
          });

          console.log('✅ [NEWCHAT] TON signData response:', response);

          signature = response.signature;
          if (response.timestamp) {
            signedTimestamp = String(response.timestamp);
          }
        } catch (e) {
          console.error('❌ [NEWCHAT] TON SignData failed or not supported:', e);
          throw new Error(`TON Signing failed: ${e instanceof Error ? e.message : String(e)}`);
        }

        setStatusMessage('Verifying TON signature...');

        const verifyResponse = await fetch(`${authApiBase}/auth/ton/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: currentAddress,
            payload: proofPayload,
            signature,
            publicKey,
            timestamp: signedTimestamp,
            domain,
            payloadMeta: { type: 'text', text: proofPayload }
          })
        });

        if (!verifyResponse.ok) {
          const errText = await verifyResponse.text();
          throw new Error(`TON Verification failed: ${errText}`);
        }

        const verifyResult = await verifyResponse.json();
        const { token: authToken } = verifyResult;

        setStatusMessage('Saving session...');
        localStorage.setItem('authPayload', JSON.stringify({ address: currentAddress, chain: 'ton' }));
        localStorage.setItem('authSignature', signature);
        localStorage.setItem('authToken', authToken);

        setIsAuthenticated(true);
        setStatusMessage('Success! Redirecting to chat...');

        setTimeout(() => {
          router.push('/chat');
        }, 500);

        return; // End of TON flow
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
      const { token: authToken } = verifyResult;

      // 4. Persist auth data locally
      setStatusMessage('Saving session...');
      localStorage.setItem('authPayload', JSON.stringify(payload));
      localStorage.setItem('authSignature', signature);
      localStorage.setItem('authToken', authToken);

      setIsAuthenticated(true);
      setStatusMessage('Success! Redirecting to chat...');

      console.log('✅ [NEWCHAT] Authentication succeeded! Redirecting to /chat...');

      // 5. Redirect to /chat (bootstrap will create a new conversation automatically)
      setTimeout(() => {
        router.push('/chat');
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
  }, [account, client, activeWallet, router, tonWallet, tonConnectUI]);

  // Auto-authenticate when account is connected
  useEffect(() => {
    const currentAddress = account?.address || tonWallet?.account.address;
    if (!currentAddress || !client || isAuthenticated || isAuthenticating) return;

    if (lastTriedAddressRef.current === currentAddress) return;

    // Check if already authenticated
    const existingToken = localStorage.getItem('authToken');
    if (existingToken) {
      router.replace('/chat');
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
    if (!account && !tonWallet) return 'Setting up your workspace...';
    return 'Setting up your workspace...';
  };

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

  const connected = Boolean(account?.address || tonWallet?.account.address);
  const showFreshConnect = isTelegram && (isConnecting || (isAuthenticating && statusMessage.toLowerCase().includes('ton')));

  return (
    <div className="fixed inset-0 bg-pano-bg-primary flex items-center justify-center overflow-hidden">
      {/* Main content */}
      <div className="flex flex-col items-center justify-center gap-6">
        {/* Logo with glow effects - same style as landing */}
        <div className="relative">
          {/* Multiple layered blur effects for stronger glow */}
          <div className="absolute inset-0 bg-cyan-400/30 blur-3xl rounded-full animate-pulse" />
          <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full" style={{ animationDelay: '0.5s' }} />
          <div className="absolute -inset-4 bg-cyan-500/15 blur-3xl rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
          <Image
            src={zicoBlue}
            alt="Zico Blue"
            width={160}
            height={160}
            className="relative h-32 w-32 lg:h-40 lg:w-40"
          />
        </div>

        {/* Label text */}
        <div className="text-center">
          <p className="text-white text-lg font-medium">
            {getLabelText()}
          </p>
          {statusMessage && isAuthenticating && (
            <p className="text-cyan-400 text-sm mt-2 animate-pulse font-mono">
              {statusMessage}
            </p>
          )}
          {showFreshConnect && (
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
              className="mt-2 px-4 py-2 rounded-lg bg-white/10 text-white/80 text-xs font-semibold hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? 'Resetting...' : "didn't get the code? Tap here"}
            </button>
          )}
        </div>

        {/* Loading indicator or Connect Button */}
        {isAuthenticating || isConnecting ? (
          <div className="flex items-center gap-2">
            <div className="loader-inline-sm" />
          </div>
        ) : !connected && client && !hasTriedAutoConnectRef.current ? (
          <div className="flex items-center gap-2">
            <div className="loader-inline-sm" />
          </div>
        ) : !connected && client ? (
          <div ref={connectButtonRef} className="mt-4 w-full flex flex-col items-center">
            {isTelegram ? (
              <div className="w-full max-w-[280px]">
                <TonConnectButton className="w-full" />
              </div>
            ) : (
              <ConnectButton
                client={client}
                wallets={wallets}
                connectModal={{ size: 'compact' }}
                connectButton={{
                  label: 'Connect Wallet',
                  style: {
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '16px',
                    background: '#ffffff',
                    color: '#000000',
                    border: 'none',
                    cursor: 'pointer',
                  },
                }}
                theme="dark"
              />
            )}

            {/* Debug Info */}
            <div className="mt-8 p-3 bg-black/50 rounded-lg text-[10px] font-mono text-gray-400 break-all max-w-xs text-left">
              <p className="font-bold mb-1 text-gray-300">Debug Info:</p>
              <p>isTelegram state: <span className={isTelegram ? "text-green-400" : "text-yellow-400"}>{String(isTelegram)}</span></p>
              <p>window.Telegram: {typeof window !== 'undefined' ? typeof (window as any).Telegram : 'undefined'}</p>
              <p>WebApp: {typeof window !== 'undefined' && (window as any).Telegram?.WebApp ? 'Present' : 'Missing'}</p>
              <p>UserAgent: {typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 50) + '...' : 'N/A'}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
