'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchDiscovery,
  isCapabilityAvailable,
  type DiscoverySnapshot,
} from '../lib/capabilityClient';

export interface UseCapabilityResult {
  available: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Check whether a capability is available on a given chain.
 * UI components use this to show/hide action buttons.
 */
export function useCapabilityAvailability(
  capability: string,
  chainId: number
): UseCapabilityResult {
  const [snapshot, setSnapshot] = useState<DiscoverySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (force = false) => {
      setLoading(true);
      fetchDiscovery(force)
        .then(setSnapshot)
        .catch((e) => setError((e as Error).message))
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => { load(); }, [load]);

  return {
    available: snapshot ? isCapabilityAvailable(snapshot, capability, chainId) : false,
    loading,
    error,
    refresh: () => load(true),
  };
}
