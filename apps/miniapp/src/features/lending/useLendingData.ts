import { useState, useEffect, useCallback } from 'react';
import { useLendingApi } from './api';
import { LendingToken, LendingPosition } from './types';

export const useLendingData = () => {
  const lendingApi = useLendingApi();
  const [tokens, setTokens] = useState<LendingToken[]>([]);
  const [userPosition, setUserPosition] = useState<LendingPosition | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  // Minimum interval between fetches (2 minutes)
  const MIN_FETCH_INTERVAL = 2 * 60 * 1000;

  const fetchData = useCallback(async (forceRefresh = false, includePosition = false) => {
    const now = Date.now();

    // Don't fetch if we recently fetched and it's not a forced refresh
    if (!forceRefresh && (now - lastFetchTime) < MIN_FETCH_INTERVAL) {
      console.log('Skipping lending fetch - too recent');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Fetching lending data...');

      // Always fetch tokens
      const availableTokens = await lendingApi.getTokens();
      setTokens(availableTokens);

      // Only fetch user position if explicitly requested (to avoid signature popup on load)
      if (includePosition) {
        const position = await lendingApi.getUserPosition();
        setUserPosition(position);
      }

      setLastFetchTime(now);

      console.log('Lending data fetched successfully');
    } catch (err) {
      console.error('Error fetching lending data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load lending data');
    } finally {
      setLoading(false);
    }
  }, [lendingApi, lastFetchTime, MIN_FETCH_INTERVAL]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh function for manual updates
  const refresh = useCallback(() => {
    console.log('Manual lending refresh triggered');
    fetchData(true, true); // Include position on manual refresh
  }, [fetchData]);

  // Clear cache and refresh
  const clearCacheAndRefresh = useCallback(() => {
    console.log('Clearing lending cache and refreshing...');
    lendingApi.clearLendingDataCache();
    fetchData(true, true); // Include position on manual refresh
  }, [lendingApi, fetchData]);

  // Function to fetch position separately (can be called when needed)
  const fetchPosition = useCallback(async () => {
    try {
      console.log('Fetching user position...');
      const position = await lendingApi.getUserPosition();
      setUserPosition(position);
    } catch (err) {
      console.error('Error fetching user position:', err);
    }
  }, [lendingApi]);

  return {
    tokens,
    userPosition,
    loading,
    error,
    refresh,
    clearCacheAndRefresh,
    fetchPosition,
    lastFetchTime
  };
};
