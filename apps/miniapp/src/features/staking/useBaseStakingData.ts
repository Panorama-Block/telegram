import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useBaseStakingApi,
  type BaseStakingPosition,
  type BaseProtocolInfo,
} from './baseApi';

export const useBaseStakingData = () => {
  const api = useBaseStakingApi();
  const [positions, setPositions] = useState<BaseStakingPosition[]>([]);
  const [protocolInfo, setProtocolInfo] = useState<BaseProtocolInfo | null>(null);
  const [apr, setApr] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const lastFetchRef = useRef(0);
  const MIN_FETCH_INTERVAL = 2 * 60 * 1000;

  const fetchData = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (!force && now - lastFetchRef.current < MIN_FETCH_INTERVAL) return;

      setLoading(true);
      setError(null);
      try {
        // Fetch protocol info first — this doesn't need a wallet
        const info = await api.getProtocolInfo().catch(() => null);
        if (info) setProtocolInfo(info);

        // Fetch positions + APR independently — positions need a wallet
        const [pos, avgApr] = await Promise.all([
          api.getPositions().catch(() => []),
          api.getAverageAPR().catch(() => null),
        ]);
        setPositions(pos);
        setApr(avgApr);
        lastFetchRef.current = now;
        setLastFetchTime(now);
      } catch (err) {
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
    protocolInfo,
    apr,
    loading,
    error,
    refresh,
    lastFetchTime,
  };
};
