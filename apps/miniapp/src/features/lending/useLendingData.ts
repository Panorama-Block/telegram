import { useState, useEffect, useCallback, useRef } from 'react';
import { useLendingApi } from './api';
import { LendingToken, LendingAccountPositionsResponse } from './types';
import { LENDING_CONFIG } from './config';

const MIN_FETCH_INTERVAL_MS = 2 * 60 * 1000;

export const useLendingData = () => {
  const lendingApi = useLendingApi();
  const [tokens, setTokens] = useState<LendingToken[]>([]);
  const [userPosition, setUserPosition] = useState<LendingAccountPositionsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const hasInitializedRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const fetchData = useCallback(async (forceRefresh = false, includePosition = false) => {
    const now = Date.now();

    if (!forceRefresh && (now - lastFetchTimeRef.current) < MIN_FETCH_INTERVAL_MS) {
      return;
    }

    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const run = (async () => {
      setLoading(true);
      setError(null);

      try {
        const maxAttempts = Math.max(1, LENDING_CONFIG.MAX_RETRY_ATTEMPTS ?? 1);
        const baseDelayMs = Math.max(250, LENDING_CONFIG.RETRY_DELAY ?? 1000);
        const isRateLimitedError = (error: unknown) =>
          error instanceof Error && (/429/.test(error.message) || /rate-limited|rate limited/i.test(error.message));
        const isTimeoutError = (error: unknown) =>
          error instanceof Error && /timeout|aborted/i.test(error.message);

        let availableTokens: LendingToken[] | null = null;
        let lastErr: unknown = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            availableTokens = await lendingApi.getTokens();
            break;
          } catch (e) {
            lastErr = e;
            if (isRateLimitedError(e) || isTimeoutError(e)) break;
            if (attempt >= maxAttempts) break;
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        if (!availableTokens) {
          throw lastErr ?? new Error('Failed to load lending markets');
        }
        setTokens(availableTokens);

        if (includePosition) {
          const position = await lendingApi.getUserPosition();
          setUserPosition(position);
        }

        const fetchedAt = Date.now();
        lastFetchTimeRef.current = fetchedAt;
        setLastFetchTime(fetchedAt);
      } catch (err) {
        console.error('[LENDING] Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load lending data');
      } finally {
        setLoading(false);
      }
    })().finally(() => {
      inFlightRef.current = null;
    });

    inFlightRef.current = run;
    return run;
  }, [lendingApi]);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    void fetchData(false, true);
  }, [fetchData]);

  const refresh = useCallback(() => {
    return fetchData(true, true);
  }, [fetchData]);

  const clearCacheAndRefresh = useCallback(() => {
    lendingApi.clearLendingDataCache();
    lastFetchTimeRef.current = 0;
    setLastFetchTime(0);
    return fetchData(true, true);
  }, [lendingApi, fetchData]);

  const fetchPosition = useCallback(async () => {
    try {
      setError(null);
      const position = await lendingApi.getUserPosition();
      setUserPosition(position);
    } catch (err) {
      console.error('[LENDING] Error fetching position:', err);
      setError(err instanceof Error ? err.message : 'Failed to load lending position');
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
