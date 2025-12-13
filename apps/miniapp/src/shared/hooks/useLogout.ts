'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { useActiveWallet, useDisconnect } from 'thirdweb/react';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';

interface LogoutOptions {
  /** Whether to redirect to /miniapp after logout. Defaults to true */
  redirect?: boolean;
  /** Optional callback to execute after cleanup but before redirect */
  onComplete?: () => void;
}

interface LogoutResult {
  success: boolean;
  error?: string;
}

/**
 * Centralized logout hook that handles:
 * 1. Thirdweb wallet disconnection
 * 2. Complete localStorage cleanup (auth tokens + wallet tokens)
 * 3. SessionStorage cleanup
 * 4. Redirect to entry point (/miniapp)
 *
 * Usage:
 * ```tsx
 * const { logout, isLoggingOut } = useLogout();
 *
 * <button onClick={() => logout()} disabled={isLoggingOut}>
 *   {isLoggingOut ? 'Disconnecting...' : 'Disconnect'}
 * </button>
 * ```
 */
export function useLogout() {
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isMountedRef = useRef(true);

  // Track mounted state to prevent state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const logout = useCallback(async (options?: LogoutOptions): Promise<LogoutResult> => {
    const { redirect = true, onComplete } = options || {};

    // Prevent multiple simultaneous logout attempts
    if (isLoggingOut) {
      return { success: false, error: 'Logout already in progress' };
    }

    if (isMountedRef.current) {
      setIsLoggingOut(true);
    }

    try {
      // 1. Disconnect wallet via Thirdweb (if connected)
      if (activeWallet) {
        try {
          await disconnect(activeWallet);
          console.log('[useLogout] Wallet disconnected successfully');
        } catch (error) {
          console.warn('[useLogout] Wallet disconnect failed:', error);
          // Continue with cleanup even if disconnect fails
        }
      }

      // 2. Clear all auth/session data from localStorage
      if (typeof window !== 'undefined') {
        // Application auth tokens
        const appKeys = [
          'authToken',
          'authPayload',
          'authSignature',
          'telegram_user',
          'userAddress',
        ];
        appKeys.forEach(key => localStorage.removeItem(key));

        // Thirdweb-specific keys (known formats)
        const clientId = THIRDWEB_CLIENT_ID;
        if (clientId) {
          const thirdwebKeys = [
            `walletToken-${clientId}`,
            `thirdwebEwsWalletToken-${clientId}`,
            `thirdweb_auth_token_${clientId}`,
            `thirdwebEwsWalletUserId-${clientId}`,
          ];
          thirdwebKeys.forEach(key => localStorage.removeItem(key));
        }
        localStorage.removeItem('thirdwebAuthToken');

        // Clear any residual thirdweb/wallet keys (defensive cleanup)
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('thirdweb') || key.startsWith('walletToken')) {
            localStorage.removeItem(key);
          }
        });

        // 3. Also clear sessionStorage for complete cleanup
        Object.keys(sessionStorage).forEach(key => {
          if (
            key.startsWith('thirdweb') ||
            key.startsWith('walletToken') ||
            key.startsWith('auth')
          ) {
            sessionStorage.removeItem(key);
          }
        });

        console.log('[useLogout] All auth data cleared from storage');
      }

      // 4. Optional callback before redirect
      if (onComplete) {
        onComplete();
      }

      // 5. Redirect to entry point (full page reload to clear React state)
      if (redirect && typeof window !== 'undefined') {
        // Small delay to ensure storage operations complete
        await new Promise(resolve => setTimeout(resolve, 100));
        window.location.href = '/miniapp';
      }

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown logout error';
      console.error('[useLogout] Error:', errorMessage);
      return { success: false, error: errorMessage };

    } finally {
      if (isMountedRef.current) {
        setIsLoggingOut(false);
      }
    }
  }, [activeWallet, disconnect, isLoggingOut]);

  return { logout, isLoggingOut };
}

export default useLogout;
