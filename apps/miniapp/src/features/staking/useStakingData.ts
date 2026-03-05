import { useState, useEffect, useCallback, useRef } from 'react';
import { useStakingApi, StakingToken, StakingPosition } from './api';

export const useStakingData = () => {
  const stakingApi = useStakingApi();
  const [tokens, setTokens] = useState<StakingToken[]>([]);
  const [userPosition, setUserPosition] = useState<StakingPosition | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const hasInitialized = useRef(false);

  // Minimum interval between fetches (2 minutes)
  const MIN_FETCH_INTERVAL = 2 * 60 * 1000;

  const fetchData = useCallback(async (forceRefresh = false) => {
    const now = Date.now();

    // Don't fetch if we recently fetched and it's not a forced refresh
    if (!forceRefresh && (now - lastFetchTime) < MIN_FETCH_INTERVAL) {
      console.log('Skipping fetch - too recent');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Fetching staking data...');

      const [availableTokens, position] = await Promise.all([
        stakingApi.getTokens(),
        stakingApi.getUserPosition(),
      ]);

      setTokens(availableTokens);
      setUserPosition(position);
      setLastFetchTime(now);

      console.log('Staking data fetched successfully', { tokens: availableTokens.length, hasPosition: !!position });
    } catch (err) {
      console.error('Error fetching staking data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load staking data');
    } finally {
      setLoading(false);
    }
  }, [stakingApi, lastFetchTime, MIN_FETCH_INTERVAL]);

  // Initial load - only once
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      fetchData();
    }
  }, []);

  // Refresh function for manual updates
  const refresh = useCallback(() => {
    console.log('Manual refresh triggered');
    fetchData(true);
  }, [fetchData]);

  // Clear cache and refresh
  const clearCacheAndRefresh = useCallback(() => {
    console.log('Clearing cache and refreshing...');
    stakingApi.clearLidoDataCache();
    fetchData(true);
  }, [stakingApi, fetchData]);

  return {
    tokens,
    userPosition,
    loading,
    error,
    refresh,
    clearCacheAndRefresh,
    lastFetchTime
  };
};
