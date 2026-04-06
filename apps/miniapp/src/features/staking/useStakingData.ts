import { useState, useEffect, useCallback, useRef } from 'react';
import { useStakingApi, StakingToken, StakingPosition } from './api';
import { mapError, isRetryableError } from '@/shared/lib/errorMapper';

export const useStakingData = () => {
  const stakingApi = useStakingApi();
  const [tokens, setTokens] = useState<StakingToken[]>([]);
  const [userPosition, setUserPosition] = useState<StakingPosition | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const lastFetchTimeRef = useRef<number>(0);
  const hasDataRef = useRef(false);

  // Minimum interval between fetches (2 minutes)
  const MIN_FETCH_INTERVAL = 2 * 60 * 1000;

  const fetchData = useCallback(async (forceRefresh = false) => {
    const now = Date.now();

    // Don't fetch if we recently fetched and it's not a forced refresh
    if (!forceRefresh && (now - lastFetchTimeRef.current) < MIN_FETCH_INTERVAL) {
      console.log('Skipping fetch - too recent');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [availableTokens, position] = await Promise.all([
        stakingApi.getTokens(),
        stakingApi.getUserPosition(),
      ]);

      setTokens(availableTokens);
      setUserPosition(position);
      hasDataRef.current = true;
      setIsStale(false);
      lastFetchTimeRef.current = now;
      setLastFetchTime(now);
    } catch (err) {
      const msg = mapError(err);
      setError(msg);
      if (hasDataRef.current && isRetryableError(err)) {
        setIsStale(true);
      }
    } finally {
      setLoading(false);
    }
  }, [stakingApi, MIN_FETCH_INTERVAL]);

  // Initial load and account/client changes.
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Refresh function for manual updates
  const refresh = useCallback(async () => {
    console.log('Manual refresh triggered');
    await fetchData(true);
  }, [fetchData]);

  // Clear cache and refresh
  const clearCacheAndRefresh = useCallback(async () => {
    console.log('Clearing cache and refreshing...');
    stakingApi.clearLidoDataCache();
    await fetchData(true);
  }, [stakingApi, fetchData]);

  return {
    tokens,
    userPosition,
    loading,
    error,
    isStale,
    refresh,
    clearCacheAndRefresh,
    lastFetchTime
  };
};
