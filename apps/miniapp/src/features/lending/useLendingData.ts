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
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Always fetch tokens
      const availableTokens = await lendingApi.getTokens();
      setTokens(availableTokens);

      // Only fetch user position if explicitly requested (to avoid signature popup on load)
      // NOTE: Commented out because /lending/position route doesn't exist in backend yet
      // TODO: Implement this route in lending-service or use alternative endpoint
      // if (includePosition) {
      //   const position = await lendingApi.getUserPosition();
      //   setUserPosition(position);
      // }

      setLastFetchTime(now);
    } catch (err) {
      console.error('[LENDING] Error fetching data:', err);
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
    fetchData(true, true); // Include position on manual refresh
  }, [fetchData]);

  // Clear cache and refresh
  const clearCacheAndRefresh = useCallback(() => {
    lendingApi.clearLendingDataCache();
    fetchData(true, true); // Include position on manual refresh
  }, [lendingApi, fetchData]);

  // Function to fetch position separately (can be called when needed)
  const fetchPosition = useCallback(async () => {
    try {
      const position = await lendingApi.getUserPosition();
      setUserPosition(position);
    } catch (err) {
      console.error('[LENDING] Error fetching position:', err);
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
