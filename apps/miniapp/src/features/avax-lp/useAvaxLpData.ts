'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useAvaxLpApi } from './api';
import { AVAX_LP_CONFIG } from './config';
import type { AvaxLpPool, AvaxLpUserPosition } from './types';

const POOLS_CACHE_TTL_MS = 60 * 1000;
const USER_CACHE_TTL_MS = 30 * 1000;

type PoolsCacheEntry = { pools: AvaxLpPool[]; fetchedAt: number };
type UserCacheEntry = { positions: AvaxLpUserPosition[]; fetchedAt: number };

let poolsCache: PoolsCacheEntry | null = null;
const userCache = new Map<string, UserCacheEntry>();

export function useAvaxLpData() {
  const avaxLpApi = useAvaxLpApi();
  const account = useActiveAccount();
  const userAddress = account?.address;

  const [pools, setPools] = useState<AvaxLpPool[]>(() => poolsCache?.pools ?? []);
  const [positions, setPositions] = useState<AvaxLpUserPosition[]>(() => (
    userAddress ? userCache.get(userAddress)?.positions ?? [] : []
  ));
  const [loading, setLoading] = useState(poolsCache == null);
  const [userLoading, setUserLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastFetchRef = useRef(0);
  const poolsInFlightRef = useRef<Promise<void> | null>(null);
  const userInFlightRef = useRef<Promise<void> | null>(null);
  const lastUserFetchRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const poolsRef = useRef<AvaxLpPool[]>(poolsCache?.pools ?? []);

  useEffect(() => {
    poolsRef.current = pools;
  }, [pools]);

  const fetchPools = useCallback(async (force = false) => {
    const now = Date.now();
    const cacheIsFresh = poolsCache != null && (now - poolsCache.fetchedAt) < POOLS_CACHE_TTL_MS;

    if (!force && cacheIsFresh && poolsCache) {
      setPools(poolsCache.pools);
      setLoading(false);
      return;
    }
    if (!force && now - lastFetchRef.current < AVAX_LP_CONFIG.MIN_FETCH_INTERVAL) return;
    if (poolsInFlightRef.current) return poolsInFlightRef.current;

    const run = (async () => {
      setError(null);
      if (!poolsCache && poolsRef.current.length === 0) setLoading(true);

      try {
        const pools = await avaxLpApi.getPools();
        setPools(pools);
        setLoading(false);
        lastFetchRef.current = Date.now();
        retryCountRef.current = 0;
        if (retryTimerRef.current != null && typeof window !== 'undefined') {
          window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        poolsCache = { pools, fetchedAt: Date.now() };
      } catch (err) {
        console.error('[AvaxLp] Error fetching pools:', err);
        setError(err instanceof Error ? err.message : 'Failed to load pools');
        setLoading(poolsRef.current.length === 0);
        if (poolsRef.current.length === 0 && typeof window !== 'undefined' && retryTimerRef.current == null) {
          const delay = Math.min(1500 * (2 ** retryCountRef.current), 8000);
          retryCountRef.current += 1;
          retryTimerRef.current = window.setTimeout(() => {
            retryTimerRef.current = null;
            void fetchPools(true);
          }, delay);
        }
      }
    })().finally(() => { poolsInFlightRef.current = null; });

    poolsInFlightRef.current = run;
    return run;
  }, [avaxLpApi]);

  const fetchUserData = useCallback(async () => {
    if (!userAddress) {
      setPositions([]);
      return;
    }
    const now = Date.now();
    const cached = userCache.get(userAddress);
    if (cached && (now - cached.fetchedAt) < USER_CACHE_TTL_MS) {
      setPositions(cached.positions);
      return;
    }
    if ((now - lastUserFetchRef.current) < USER_CACHE_TTL_MS) return;
    if (userInFlightRef.current) return userInFlightRef.current;

    const run = (async () => {
      setUserLoading(true);
      try {
        const pos = await avaxLpApi.getPosition(userAddress).catch(() => []);
        setPositions(pos);
        userCache.set(userAddress, { positions: pos, fetchedAt: Date.now() });
      } catch (err) {
        console.error('[AvaxLp] Error fetching user data:', err);
      } finally {
        lastUserFetchRef.current = Date.now();
        setUserLoading(false);
      }
    })().finally(() => { userInFlightRef.current = null; });

    userInFlightRef.current = run;
    return run;
  }, [avaxLpApi, userAddress]);

  const refresh = useCallback(async () => {
    if (userAddress) userCache.delete(userAddress);
    lastUserFetchRef.current = 0;
    poolsCache = null;
    await fetchPools(true);
    await fetchUserData();
  }, [fetchPools, fetchUserData, userAddress]);

  useEffect(() => {
    void fetchPools();
  }, [fetchPools]);

  useEffect(() => () => {
    if (retryTimerRef.current != null && typeof window !== 'undefined') {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!userAddress || pools.length === 0) return;
    void fetchUserData();
  }, [fetchUserData, pools.length, userAddress]);

  return { pools, positions, loading, userLoading, error, refresh };
}
