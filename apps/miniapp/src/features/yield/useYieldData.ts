'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useYieldApi } from './api';
import { YIELD_CONFIG } from './config';
import type { YieldPoolWithAPR, UserPosition, Portfolio, PoolProtocolInfo } from './types';

const POOLS_CACHE_TTL_MS = 60 * 1000;
const USER_CACHE_TTL_MS = 30 * 1000;

type PoolsCacheEntry = {
  pools: YieldPoolWithAPR[];
  protocolInfo: PoolProtocolInfo[];
  fetchedAt: number;
};

type UserCacheEntry = {
  positions: UserPosition[];
  portfolio: Portfolio | null;
  fetchedAt: number;
};

let poolsCache: PoolsCacheEntry | null = null;
const userCache = new Map<string, UserCacheEntry>();
const lastNonZeroPortfolioByUser = new Map<string, Portfolio>();

function mergePoolMetrics(
  pools: { id: string }[],
  protocolInfo: PoolProtocolInfo[],
): YieldPoolWithAPR[] {
  const metricsMap = new Map<string, { estimatedAPR: string; totalLiquidityUsd: string | null }>();
  for (const poolInfo of protocolInfo) {
    metricsMap.set(poolInfo.poolId, {
      estimatedAPR: poolInfo.estimatedAPR,
      totalLiquidityUsd: poolInfo.totalLiquidityUsd ?? null,
    });
  }

  return pools.map((pool) => ({
    ...pool,
    estimatedAPR: metricsMap.get(pool.id)?.estimatedAPR ?? null,
    totalLiquidityUsd: metricsMap.get(pool.id)?.totalLiquidityUsd ?? null,
  })) as YieldPoolWithAPR[];
}

export function useYieldData() {
  const yieldApi = useYieldApi();
  const account = useActiveAccount();
  const userAddress = account?.address;

  const [pools, setPools] = useState<YieldPoolWithAPR[]>(() => poolsCache?.pools ?? []);
  const [protocolInfo, setProtocolInfo] = useState<PoolProtocolInfo[]>(() => poolsCache?.protocolInfo ?? []);
  const [positions, setPositions] = useState<UserPosition[]>(() => (
    userAddress && userCache.get(userAddress)?.positions ? userCache.get(userAddress)!.positions : []
  ));
  const [portfolio, setPortfolio] = useState<Portfolio | null>(() => (
    userAddress && userCache.get(userAddress)?.portfolio ? userCache.get(userAddress)!.portfolio : null
  ));
  const [loading, setLoading] = useState(poolsCache == null);
  const [userLoading, setUserLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastFetchRef = useRef(0);
  const poolsRef = useRef<YieldPoolWithAPR[]>(poolsCache?.pools ?? []);
  const protocolInfoRef = useRef<PoolProtocolInfo[]>(poolsCache?.protocolInfo ?? []);
  const poolsInFlightRef = useRef<Promise<void> | null>(null);
  const userInFlightRef = useRef<Promise<void> | null>(null);
  const lastUserFetchRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    poolsRef.current = pools;
  }, [pools]);

  useEffect(() => {
    protocolInfoRef.current = protocolInfo;
  }, [protocolInfo]);

  const fetchPools = useCallback(async (force = false) => {
    const now = Date.now();
    const cachedPools = poolsCache;
    const cacheIsFresh = cachedPools != null && (now - cachedPools.fetchedAt) < POOLS_CACHE_TTL_MS;
    let seededFromCache = false;
    if (!force && cacheIsFresh && cachedPools) {
      setPools(cachedPools.pools);
      setProtocolInfo(cachedPools.protocolInfo);
      setLoading(false);
      seededFromCache = true;
    }
    if (!force && !seededFromCache && now - lastFetchRef.current < YIELD_CONFIG.MIN_FETCH_INTERVAL) return;
    if (poolsInFlightRef.current) return poolsInFlightRef.current;

    const run = (async () => {
      setError(null);
      if (!poolsCache && poolsRef.current.length === 0) {
        setLoading(true);
      }

      try {
        // Prioritize pool discovery. Do not block first paint on protocol-info.
        const poolsData = await yieldApi.getPools();
        const mergedPools = mergePoolMetrics(poolsData, protocolInfoRef.current);

        setPools(mergedPools);
        setLoading(false);
        lastFetchRef.current = Date.now();
        retryCountRef.current = 0;
        if (retryTimerRef.current != null && typeof window !== 'undefined') {
          window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        poolsCache = {
          pools: mergedPools,
          protocolInfo: protocolInfoRef.current,
          fetchedAt: Date.now(),
        };

        // Refresh APR/TVL in background.
        void yieldApi.getProtocolInfo()
          .then((protocolData) => {
            const mergedWithApr = mergePoolMetrics(poolsData, protocolData.pools);
            setProtocolInfo(protocolData.pools);
            setPools(mergedWithApr);
            poolsCache = {
              pools: mergedWithApr,
              protocolInfo: protocolData.pools,
              fetchedAt: Date.now(),
            };
          })
          .catch((err) => {
            console.warn('[YIELD] protocol-info fetch failed (non-blocking):', err);
            poolsCache = {
              pools: mergedPools,
              protocolInfo: protocolInfoRef.current,
              fetchedAt: Date.now(),
            };
          });
      } catch (err) {
        console.error('[YIELD] Error fetching pools:', err);
        setError(err instanceof Error ? err.message : 'Failed to load pools');
        const hasCachedPools = poolsRef.current.length > 0;
        setLoading(!hasCachedPools);
        if (!hasCachedPools && typeof window !== 'undefined' && retryTimerRef.current == null) {
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
  }, [yieldApi]);

  const fetchUserData = useCallback(async () => {
    if (!userAddress) {
      setPositions([]);
      setPortfolio(null);
      return;
    }
    const now = Date.now();
    const cached = userCache.get(userAddress);
    const cacheIsFresh = cached && (now - cached.fetchedAt) < USER_CACHE_TTL_MS;
    if (cacheIsFresh) {
      setPositions(cached.positions);
      setPortfolio(cached.portfolio);
      return;
    }
    if ((now - lastUserFetchRef.current) < USER_CACHE_TTL_MS) return;
    if (userInFlightRef.current) return userInFlightRef.current;

    const run = (async () => {
      setUserLoading(true);
      try {
        const [pos, port] = await Promise.all([
          yieldApi.getPosition(userAddress).catch(() => []),
          yieldApi.getPortfolio(userAddress).catch(() => null),
        ]);

        let nextPortfolio = port;
        // Guard against transient RPC failures that sometimes return "0" for all token balances.
        if (nextPortfolio?.walletBalances) {
          const values = Object.values(nextPortfolio.walletBalances);
          const allZero = values.length > 0 && values.every((value) => {
            const numeric = Number.parseFloat(value);
            return Number.isFinite(numeric) && numeric === 0;
          });

          if (allZero) {
            const cachedNonZero = lastNonZeroPortfolioByUser.get(userAddress);
            if (cachedNonZero) {
              nextPortfolio = cachedNonZero;
            }
            try {
              const retried = await yieldApi.getPortfolio(userAddress);
              const retriedValues = Object.values(retried.walletBalances ?? {});
              const hasNonZero = retriedValues.some((value) => {
                const numeric = Number.parseFloat(value);
                return Number.isFinite(numeric) && numeric > 0;
              });
              if (hasNonZero) {
                nextPortfolio = retried;
                lastNonZeroPortfolioByUser.set(userAddress, retried);
              }
            } catch {
              // Keep original response if retry fails.
            }
          }
        } else if (nextPortfolio) {
          const values = Object.values(nextPortfolio.walletBalances ?? {});
          const hasNonZero = values.some((value) => {
            const numeric = Number.parseFloat(value);
            return Number.isFinite(numeric) && numeric > 0;
          });
          if (hasNonZero) {
            lastNonZeroPortfolioByUser.set(userAddress, nextPortfolio);
          }
        }

        setPositions(pos);
        setPortfolio(nextPortfolio);
        userCache.set(userAddress, {
          positions: pos,
          portfolio: nextPortfolio,
          fetchedAt: Date.now(),
        });
      } catch (err) {
        console.error('[YIELD] Error fetching user data:', err);
      } finally {
        lastUserFetchRef.current = Date.now();
        setUserLoading(false);
      }
    })().finally(() => { userInFlightRef.current = null; });

    userInFlightRef.current = run;
    return run;
  }, [yieldApi, userAddress]);

  const refresh = useCallback(async () => {
    if (userAddress) {
      userCache.delete(userAddress);
    }
    lastUserFetchRef.current = 0;
    poolsCache = null;
    await fetchPools(true);
    await fetchUserData();
  }, [fetchPools, fetchUserData, userAddress]);

  // Fetch pools on mount
  useEffect(() => {
    void fetchPools();
  }, [fetchPools]);

  useEffect(() => () => {
    if (retryTimerRef.current != null && typeof window !== 'undefined') {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // Fetch user data only after pools are available to prioritize instant pool discovery.
  useEffect(() => {
    if (!userAddress) return;
    if (pools.length === 0) return;
    void fetchUserData();
  }, [fetchUserData, pools.length, userAddress]);

  return {
    pools,
    protocolInfo,
    positions,
    portfolio,
    loading,
    userLoading,
    error,
    refresh,
  };
}
