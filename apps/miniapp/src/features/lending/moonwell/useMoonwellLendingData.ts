import { useState, useEffect, useCallback, useRef } from 'react';
import { useMoonwellLendingApi } from './api';
import type { LendingToken, LendingAccountPositionsResponse } from '@/features/lending/types';

const MIN_FETCH_INTERVAL_MS = 2 * 60 * 1000;

export const useMoonwellLendingData = () => {
  const lendingApi = useMoonwellLendingApi();

  const [tokens, setTokens] = useState<LendingToken[]>([]);
  const [userPosition, setUserPosition] = useState<LendingAccountPositionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataStale, setDataStale] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(0);

  const hasInitializedRef = useRef(false);
  const lastFetchTimeRef  = useRef(0);
  const inFlightRef       = useRef<Promise<void> | null>(null);

  const fetchData = useCallback(async (forceRefresh = false, includePosition = false) => {
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL_MS) return;
    if (inFlightRef.current) return inFlightRef.current;

    const run = (async () => {
      setLoading(tokens.length === 0);
      setError(null);
      try {
        const positionPromise = includePosition
          ? lendingApi.getUserPosition()
              .then((p) => ({ position: p, error: null as unknown }))
              .catch((e) => ({ position: null, error: e }))
          : null;

        const fetchedTokens = await lendingApi.getTokens();
        setTokens(fetchedTokens);
        setLoading(false);

        if (positionPromise) {
          const { position, error: posErr } = await positionPromise;
          if (position) setUserPosition(position);
          else if (posErr) console.warn('[MOONWELL] Position fetch failed:', posErr);
        }

        const fetchedAt = Date.now();
        lastFetchTimeRef.current = fetchedAt;
        setLastFetchTime(fetchedAt);
        setDataStale(false);
      } catch (err) {
        if (tokens.length > 0) setDataStale(true);
        setError(err instanceof Error ? err.message : 'Failed to load Moonwell data');
      } finally {
        setLoading(false);
      }
    })().finally(() => { inFlightRef.current = null; });

    inFlightRef.current = run;
    return run;
  }, [lendingApi]);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    void fetchData(false, true);
  }, [fetchData]);

  const refresh = useCallback(() => fetchData(true, true), [fetchData]);

  const fetchPosition = useCallback(async () => {
    try {
      setError(null);
      const position = await lendingApi.getUserPosition();
      setUserPosition(position);
    } catch (err) {
      console.error('[MOONWELL] Error fetching position:', err);
      setError(err instanceof Error ? err.message : 'Failed to load position');
    }
  }, [lendingApi]);

  return {
    tokens,
    userPosition,
    loading,
    dataStale,
    error,
    refresh,
    clearCacheAndRefresh: refresh,
    fetchPosition,
    lastFetchTime,
  };
};
