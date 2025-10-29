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

  const fetchData = useCallback(async (forceRefresh = false) => {
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
      
      // Fetch tokens and user position in parallel
      const [availableTokens, position] = await Promise.all([
        lendingApi.getTokens(),
        lendingApi.getUserPosition()
      ]);

      setTokens(availableTokens);
      setUserPosition(position);
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
    fetchData(true);
  }, [fetchData]);

  // Clear cache and refresh
  const clearCacheAndRefresh = useCallback(() => {
    console.log('Clearing lending cache and refreshing...');
    lendingApi.clearLendingDataCache();
    fetchData(true);
  }, [lendingApi, fetchData]);

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
