import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useBaseStakingApi,
  type BaseStakingPosition,
  type BaseProtocolInfo,
  type BasePortfolioAsset,
} from './baseApi';

export const useBaseStakingData = () => {
  const api = useBaseStakingApi();
  const [positions, setPositions] = useState<BaseStakingPosition[]>([]);
  const [portfolioAssets, setPortfolioAssets] = useState<BasePortfolioAsset[]>([]);
  const [protocolInfo, setProtocolInfo] = useState<BaseProtocolInfo | null>(null);
  const [apr, setApr] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataStale, setDataStale] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const lastFetchRef = useRef(0);
  const lastApiRef = useRef(api);
  const positionsRef = useRef<BaseStakingPosition[]>([]);
  const MIN_FETCH_INTERVAL = 2 * 60 * 1000;

  // Keep ref in sync with state
  positionsRef.current = positions;

  // Reset fetch timer when wallet address changes (api identity changes)
  if (lastApiRef.current !== api) {
    lastApiRef.current = api;
    lastFetchRef.current = 0;
  }

  const fetchData = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (!force && now - lastFetchRef.current < MIN_FETCH_INTERVAL) return;

      setLoading(positionsRef.current.length === 0);
      setError(null);
      try {
        // Fetch protocol info first — this doesn't need a wallet
        const info = await api.getProtocolInfo().catch((e) => { console.error('[useBaseStakingData] getProtocolInfo failed:', e); return null; });
        if (info) setProtocolInfo(info);

        // Fetch positions + portfolio + APR independently — positions need a wallet
        const [pos, portfolio, avgApr] = await Promise.all([
          api.getPositions().catch((e) => { console.error('[useBaseStakingData] getPositions failed:', e); return null; }),
          api.getPortfolio().catch((e) => { console.error('[useBaseStakingData] getPortfolio failed:', e); return null; }),
          api.getAverageAPR().catch((e) => { console.error('[useBaseStakingData] getAverageAPR failed:', e); return null; }),
        ]);
        console.log('[useBaseStakingData] positions:', pos?.length ?? 'null', 'portfolio:', portfolio?.assets?.length ?? 'null', 'apr:', avgApr);
        // Only update positions if we got a valid response;
        // don't replace existing positions with an empty array (RPC flakiness)
        if (pos !== null && (pos.length > 0 || positionsRef.current.length === 0)) {
          setPositions(pos);
        }
        if (portfolio?.assets && portfolio.assets.length > 0) {
          setPortfolioAssets(portfolio.assets);
        }
        if (avgApr !== null) {
          setApr(avgApr);
        }
        lastFetchRef.current = now;
        setLastFetchTime(now);
        setDataStale(false);
      } catch (err) {
        // Don't reset existing data on error — mark as stale instead
        if (positionsRef.current.length > 0) {
          setDataStale(true);
        }
        setError(err instanceof Error ? err.message : 'Failed to load Base staking data');
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return {
    positions,
    portfolioAssets,
    protocolInfo,
    apr,
    loading,
    dataStale,
    error,
    refresh,
    lastFetchTime,
  };
};
