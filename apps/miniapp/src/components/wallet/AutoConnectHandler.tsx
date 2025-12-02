'use client';

import { useEffect } from 'react';
import { useActiveAccount, useAutoConnect } from 'thirdweb/react';
import { inAppWallet } from 'thirdweb/wallets';
import { createThirdwebClient } from 'thirdweb';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';

/**
 * Component that handles auto-reconnection of Thirdweb wallets on page load.
 * Uses the official Thirdweb autoConnect hook for proper session management.
 */
export function AutoConnectHandler() {
  const account = useActiveAccount();

  const client = createThirdwebClient({
    clientId: THIRDWEB_CLIENT_ID
  });

  const wallet = inAppWallet();

  // Use the official autoConnect hook from Thirdweb
  const { data: autoConnectData, isLoading } = useAutoConnect({
    client,
    wallets: [wallet],
    timeout: 10000, // 10 seconds timeout
  });

  useEffect(() => {
    if (isLoading) {
      console.log('[AutoConnect] Attempting to reconnect wallet...');
    } else if (autoConnectData) {
      console.log('[AutoConnect] ✅ Wallet reconnected successfully!');
    } else {
      console.log('[AutoConnect] ℹ️ No previous session found, user needs to connect');
    }
  }, [isLoading, autoConnectData]);

  useEffect(() => {
    if (account) {
      console.log('[AutoConnect] ✅ Account active:', account.address);
    }
  }, [account]);

  return null;
}
