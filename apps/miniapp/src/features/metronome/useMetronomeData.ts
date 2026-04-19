'use client';

/**
 * Data hook for the Metronome feature.
 *
 * Composes the shared `useDefiData` hook twice — once for the static markets
 * catalog, once for per-user positions — and exposes a single facade so UI
 * components don't juggle two hooks.
 *
 * Caches are module-scoped so multiple mounted instances (e.g. the widget
 * and a dashboard card) share data and don't duplicate network traffic.
 */

import { useCallback, useMemo } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { createDefiCache } from '@/shared/lib/defiCache';
import { useDefiData } from '@/shared/hooks/useDefiData';
import { getTokenIcon } from '@/shared/lib/tokenIcons';
import { useMetronomeApi } from './api';
import { METRONOME_CONFIG } from './config';
import type {
  CollateralRowVM,
  DebtRowVM,
  MetronomeMarkets,
  UserPosition,
} from './types';

const MARKETS_KEY = 'metronome:markets:base';

const marketsCache = createDefiCache<MetronomeMarkets>({
  label:         'metronome-markets',
  defaultTtlMs:  METRONOME_CONFIG.CACHE_MARKETS_TTL_MS,
});

const positionCache = createDefiCache<UserPosition>({
  label:         'metronome-position',
  defaultTtlMs:  METRONOME_CONFIG.CACHE_POSITION_TTL_MS,
});

export interface UseMetronomeDataResult {
  markets:        MetronomeMarkets | null;
  position:       UserPosition | null;
  collateralRows: CollateralRowVM[];
  debtRows:       DebtRowVM[];
  loading:        boolean;
  positionLoading: boolean;
  error:          Error | null;
  refresh:        () => Promise<void>;
}

export function useMetronomeData(): UseMetronomeDataResult {
  const api = useMetronomeApi();
  const account = useActiveAccount();
  const userAddress = account?.address?.toLowerCase() ?? null;

  const fetchMarkets = useCallback(() => api.getMarkets(), [api]);
  const fetchPosition = useCallback(() => {
    if (!userAddress) throw new Error('metronome: no user address');
    return api.getPosition(userAddress);
  }, [api, userAddress]);

  const marketsQuery = useDefiData<MetronomeMarkets>({
    key:                MARKETS_KEY,
    cache:              marketsCache,
    fetcher:            fetchMarkets,
    ttlMs:              METRONOME_CONFIG.CACHE_MARKETS_TTL_MS,
    minFetchIntervalMs: METRONOME_CONFIG.MIN_FETCH_INTERVAL_MS,
  });

  const positionQuery = useDefiData<UserPosition>({
    key:                userAddress ? `metronome:position:${userAddress}` : null,
    cache:              positionCache,
    fetcher:            fetchPosition,
    ttlMs:              METRONOME_CONFIG.CACHE_POSITION_TTL_MS,
    minFetchIntervalMs: METRONOME_CONFIG.MIN_FETCH_INTERVAL_MS,
    enabled:            Boolean(userAddress),
  });

  const { collateralRows, debtRows } = useMemo(() => {
    const pos = positionQuery.data;
    if (!pos) return { collateralRows: [], debtRows: [] };
    return {
      collateralRows: pos.collateral.map<CollateralRowVM>((row) => ({
        ...row,
        iconUrl: getTokenIcon(row.underlyingSymbol),
      })),
      debtRows: pos.debt.map<DebtRowVM>((row) => ({
        ...row,
        iconUrl: getTokenIcon(row.symbol),
      })),
    };
  }, [positionQuery.data]);

  const refresh = useCallback(async () => {
    await Promise.all([
      marketsQuery.refresh(),
      userAddress ? positionQuery.refresh() : Promise.resolve(),
    ]);
  }, [marketsQuery, positionQuery, userAddress]);

  return {
    markets:         marketsQuery.data,
    position:        positionQuery.data,
    collateralRows,
    debtRows,
    loading:         marketsQuery.loading,
    positionLoading: positionQuery.loading,
    error:           marketsQuery.error ?? positionQuery.error,
    refresh,
  };
}

/** Exported for tests and for cache-invalidation in mutation code paths. */
export const __metronomeCaches = { marketsCache, positionCache };
