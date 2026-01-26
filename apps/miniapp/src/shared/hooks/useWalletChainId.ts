/**
 * Hook to detect and track the current wallet chain ID
 *
 * Listens to chainChanged events and provides real-time chain state.
 */

import { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { hexToChainId } from '../config/chains';

interface UseWalletChainIdResult {
  chainId: number | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get the current wallet chain ID
 *
 * Features:
 * - Auto-detects chain on mount
 * - Listens to chainChanged events
 * - Works with MetaMask, WalletConnect, and other EIP-1193 providers
 */
export function useWalletChainId(): UseWalletChainIdResult {
  const account = useActiveAccount();
  const [chainId, setChainId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch current chain ID from provider
  const fetchChainId = useCallback(async () => {
    // Check if ethereum provider exists
    const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : null;

    if (!ethereum) {
      setChainId(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Request chainId from provider
      const hexChainId = await ethereum.request({ method: 'eth_chainId' });
      const numericChainId = hexToChainId(hexChainId);

      setChainId(numericChainId);
    } catch (err) {
      console.error('[useWalletChainId] Error fetching chain ID:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch chain ID'));
      setChainId(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle chain changed event
  const handleChainChanged = useCallback((hexChainId: string) => {
    const numericChainId = hexToChainId(hexChainId);
    console.log('[useWalletChainId] Chain changed to:', numericChainId);
    setChainId(numericChainId);
    setError(null);
  }, []);

  // Handle account changed event (may indicate chain change)
  const handleAccountsChanged = useCallback((accounts: string[]) => {
    if (accounts.length === 0) {
      // Wallet disconnected
      setChainId(null);
    } else {
      // Refetch chain on account change
      fetchChainId();
    }
  }, [fetchChainId]);

  // Setup listeners and initial fetch
  useEffect(() => {
    const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : null;

    if (!ethereum) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchChainId();

    // Subscribe to chain changes
    ethereum.on('chainChanged', handleChainChanged);
    ethereum.on('accountsChanged', handleAccountsChanged);

    // Cleanup listeners
    return () => {
      ethereum.removeListener('chainChanged', handleChainChanged);
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [fetchChainId, handleChainChanged, handleAccountsChanged]);

  // Refetch when account changes (for Thirdweb)
  useEffect(() => {
    if (account) {
      fetchChainId();
    } else {
      setChainId(null);
    }
  }, [account, fetchChainId]);

  return {
    chainId,
    isLoading,
    error,
    refetch: fetchChainId,
  };
}

export default useWalletChainId;
