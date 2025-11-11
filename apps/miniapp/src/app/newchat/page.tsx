'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ConnectButton, useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { signLoginPayload } from 'thirdweb/auth';
import Image from 'next/image';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import '@/shared/ui/loader.css';

export default function NewChatPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const hasTriedAutoConnectRef = useRef(false);
  const hasTriedManualConnectRef = useRef(false);
  const connectButtonRef = useRef<HTMLDivElement>(null);
  const lastTriedAddressRef = useRef<string | null>(null);

  // Client setup
  const client = useMemo(() => {
    const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || '';
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

  // Auto-connect wallet on mount if not connected
  useEffect(() => {
    const autoConnectWallet = async () => {
      if (account || hasTriedAutoConnectRef.current || !client) return;

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
  }, [account, client]);

  // Auto-click connect button if autoConnect fails
  useEffect(() => {
    if (!account && !isConnecting && hasTriedAutoConnectRef.current && !hasTriedManualConnectRef.current && connectButtonRef.current) {
      const timer = setTimeout(() => {
        const button = connectButtonRef.current?.querySelector('button');
        if (button) {
          button.click();
          hasTriedManualConnectRef.current = true;
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [account, isConnecting, hasTriedAutoConnectRef.current]);

  // Authenticate with backend
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

      // 1. Get payload from backend
      const normalizedAddress = account.address;
      const loginPayload = { address: normalizedAddress };

      console.log('🔍 [NEWCHAT] Authenticating with:', authApiBase);

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
        console.error('❌ [NEWCHAT] Thirdweb signature error:', error);

        // Fallback to direct signing if signLoginPayload fails
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
      localStorage.setItem('authPayload', JSON.stringify(payload));
      localStorage.setItem('authSignature', signature);
      localStorage.setItem('authToken', authToken);

      setIsAuthenticated(true);

      console.log('✅ [NEWCHAT] Authentication succeeded! Redirecting to /chat...');

      // 5. Redirect to /chat
      setTimeout(() => {
        router.push('/chat');
      }, 500);

    } catch (err: any) {
      console.error('❌ [NEWCHAT] Authentication failed:', err);

      let errorMessage = err?.message || 'Authentication failed';

      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        errorMessage = `Connection error with ${authApiBase}. Make sure the server is running and reachable.`;
      }

      setError(errorMessage);
      setIsAuthenticated(false);
    } finally {
      setIsAuthenticating(false);
    }
  }, [account, client, activeWallet, router]);

  // Auto-authenticate when account is connected
  useEffect(() => {
    if (!account || !client || isAuthenticated || isAuthenticating) return;
    if (lastTriedAddressRef.current === account.address) return;

    // Check if already authenticated
    const existingToken = localStorage.getItem('authToken');
    if (existingToken) {
      router.replace('/chat');
      return;
    }

    lastTriedAddressRef.current = account.address;
    authenticateWithBackend();
  }, [account, client, isAuthenticated, isAuthenticating, authenticateWithBackend, router]);

  // Determine label text
  const getLabelText = () => {
    if (error) return 'Error occurred';
    if (isAuthenticating) return 'Authenticating...';
    if (isAuthenticated) return 'Success! Redirecting...';
    if (isConnecting) return 'Setting up your workspace...';
    if (!account) return 'Setting up your workspace...';
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
        </div>

        {/* Loading indicator or Connect Button */}
        {isAuthenticating || isConnecting ? (
          <div className="flex items-center gap-2">
            <div className="loader-inline-sm" />
          </div>
        ) : !account && client && !hasTriedAutoConnectRef.current ? (
          <div className="flex items-center gap-2">
            <div className="loader-inline-sm" />
          </div>
        ) : !account && client ? (
          <div ref={connectButtonRef} className="mt-4">
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
          </div>
        ) : null}
      </div>
    </div>
  );
}
