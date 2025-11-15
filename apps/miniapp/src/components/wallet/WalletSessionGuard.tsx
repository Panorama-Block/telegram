'use client';

import { useEffect, useRef } from 'react';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';

/**
 * Component that monitors wallet connections and attempts to persist session data.
 *
 * The Thirdweb SDK's autoConnect relies on finding a stored authentication token.
 * This component tries to help by searching for and organizing these tokens.
 */
export function WalletSessionGuard() {
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const lastCheckedAddress = useRef<string | null>(null);

  useEffect(() => {
    // Only run once per address to avoid repeated checks
    if (!account || !activeWallet || lastCheckedAddress.current === account.address) {
      return;
    }

    lastCheckedAddress.current = account.address;

    const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || '841b9035bb273fee8d50a503f5b09fd0';

    console.log('[WalletSessionGuard] Wallet connected:', account.address);
    console.log('[WalletSessionGuard] Checking session persistence...');

    // List all localStorage keys to help debug
    const allKeys = Object.keys(localStorage);
    const thirdwebKeys = allKeys.filter(key => key.toLowerCase().includes('thirdweb'));

    console.log('[WalletSessionGuard] Found Thirdweb keys in localStorage:', thirdwebKeys);

    // Check for various token formats that Thirdweb SDK might use
    const possibleTokenKeys = [
      `walletToken-${clientId}`,
      `thirdwebEwsWalletToken-${clientId}`,
      `thirdweb_auth_token_${clientId}`,
      `thirdwebAuthToken`,
    ];

    let foundToken = false;
    for (const key of possibleTokenKeys) {
      const value = localStorage.getItem(key);
      if (value) {
        console.log('[WalletSessionGuard] ✅ Found session token:', key);
        foundToken = true;

        // Ensure walletToken-{clientId} exists for autoConnect
        const standardKey = `walletToken-${clientId}`;
        if (key !== standardKey && !localStorage.getItem(standardKey)) {
          console.log('[WalletSessionGuard] Copying token to standard location:', standardKey);
          localStorage.setItem(standardKey, value);
        }
        break;
      }
    }

    if (!foundToken) {
      console.warn('[WalletSessionGuard] ⚠️ No session token found!');
      console.warn('[WalletSessionGuard] AutoConnect may not work after page refresh.');
      console.warn('[WalletSessionGuard] For persistent sessions, use OAuth login (Google/Telegram).');
      console.warn('[WalletSessionGuard] Current localStorage keys:', thirdwebKeys);
    } else {
      console.log('[WalletSessionGuard] ✅ Session persistence enabled');
    }

  }, [account, activeWallet]);

  return null;
}
