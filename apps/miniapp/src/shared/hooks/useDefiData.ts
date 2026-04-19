'use client';

/**
 * Generic data-fetching hook for DeFi feature modules.
 *
 * Pairs with `createDefiCache<T>` (shared/lib/defiCache.ts): the cache
 * owns storage + dedup across hook instances; this hook owns the
 * component-facing state machine (loading / data / error / refresh).
 *
 * Usage:
 * ```ts
 * const poolsCache = createDefiCache<Pool[]>({ label: 'metronome-pools', defaultTtlMs: 60_000 });
 *
 * function useMetronomePools() {
 *   return useDefiData({
 *     key: 'pools:base',
 *     cache: poolsCache,
 *     fetcher: () => api.getPools(),
 *   });
 * }
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CacheEntry, DefiCache } from '../lib/defiCache';

export interface UseDefiDataParams<T> {
  /** Cache key; `null` disables the hook (no fetch, no cache read). */
  key: string | null;
  /** Underlying fetch. Must be stable (wrap in useCallback when composing). */
  fetcher: () => Promise<T>;
  cache: DefiCache<T>;
  /** Entry is considered fresh when `Date.now() - fetchedAt < ttlMs`. */
  ttlMs?: number;
  /** Minimum ms between automatic refetches on prop changes. */
  minFetchIntervalMs?: number;
  /** If false, hook holds its last data and skips fetching. Default: true. */
  enabled?: boolean;
}

export interface UseDefiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  /** Fetched-at timestamp from the cache (ms). `null` if no entry. */
  fetchedAt: number | null;
  /** Force refetch, bypassing freshness check. */
  refresh: () => Promise<void>;
}

export function useDefiData<T>(params: UseDefiDataParams<T>): UseDefiDataResult<T> {
  const {
    key,
    fetcher,
    cache,
    ttlMs,
    minFetchIntervalMs = 0,
    enabled = true,
  } = params;

  const initialEntry = key ? cache.get(key) : undefined;
  const [data, setData] = useState<T | null>(initialEntry?.data ?? null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(initialEntry?.fetchedAt ?? null);
  const [loading, setLoading] = useState<boolean>(
    Boolean(enabled && key) && !initialEntry,
  );
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  useEffect(() => { fetcherRef.current = fetcher; }, [fetcher]);

  const lastFetchRef = useRef<number>(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const run = useCallback(async (force: boolean): Promise<void> => {
    if (!key || !enabled) return;

    const now = Date.now();
    if (!force) {
      if (cache.isFresh(key, ttlMs)) {
        const entry = cache.get(key)!;
        setData(entry.data);
        setFetchedAt(entry.fetchedAt);
        setLoading(false);
        return;
      }
      if (minFetchIntervalMs > 0 && now - lastFetchRef.current < minFetchIntervalMs) {
        return;
      }
    }

    lastFetchRef.current = now;
    if (!cache.peek(key)) setLoading(true);
    setError(null);

    try {
      const result = await cache.withDedup(key, () => fetcherRef.current());
      if (!mountedRef.current) return;
      setData(result);
      setFetchedAt(cache.get(key)?.fetchedAt ?? Date.now());
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [cache, enabled, key, minFetchIntervalMs, ttlMs]);

  // Fetch on key/enable change.
  useEffect(() => {
    if (!key || !enabled) {
      setLoading(false);
      return;
    }
    void run(false);
  }, [enabled, key, run]);

  // Subscribe to external cache writes (e.g. another hook instance or a mutation).
  useEffect(() => {
    if (!key) return;
    return cache.subscribe(key, (entry: CacheEntry<T> | undefined) => {
      if (!mountedRef.current) return;
      if (entry) {
        setData(entry.data);
        setFetchedAt(entry.fetchedAt);
      } else {
        setData(null);
        setFetchedAt(null);
      }
    });
  }, [cache, key]);

  const refresh = useCallback(() => run(true), [run]);

  return { data, loading, error, fetchedAt, refresh };
}
