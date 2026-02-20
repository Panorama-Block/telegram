import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useStakingData } from '@/features/staking/useStakingData';

const getTokensMock = vi.fn();
const getUserPositionMock = vi.fn();
const clearLidoDataCacheMock = vi.fn();

vi.mock('@/features/staking/api', () => ({
  useStakingApi: () => ({
    getTokens: (...args: unknown[]) => getTokensMock(...args),
    getUserPosition: (...args: unknown[]) => getUserPositionMock(...args),
    clearLidoDataCache: (...args: unknown[]) => clearLidoDataCacheMock(...args),
  }),
}));

describe('useStakingData', () => {
  beforeEach(() => {
    getTokensMock.mockReset();
    getUserPositionMock.mockReset();
    clearLidoDataCacheMock.mockReset();
  });

  test('loads staking snapshot and supports manual refresh', async () => {
    getTokensMock.mockResolvedValue([{ symbol: 'ETH' }]);
    getUserPositionMock.mockResolvedValue({ stETHBalance: '1' });

    const { result } = renderHook(() => useStakingData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.tokens).toHaveLength(1);
      expect(result.current.userPosition?.stETHBalance).toBe('1');
    });

    await act(async () => {
      result.current.refresh();
    });

    expect(getTokensMock).toHaveBeenCalledTimes(2);
    expect(getUserPositionMock).toHaveBeenCalledTimes(2);
  });

  test('sets error on fetch failure', async () => {
    getTokensMock.mockRejectedValue(new Error('staking data unavailable'));
    getUserPositionMock.mockResolvedValue(null);

    const { result } = renderHook(() => useStakingData());

    await waitFor(() => {
      const message =
        typeof result.current.error === 'string'
          ? result.current.error
          : result.current.error?.message;
      expect(message).toMatch(/staking data unavailable/i);
    });
  });

  test('clears cache before refresh helper', async () => {
    getTokensMock.mockResolvedValue([{ symbol: 'ETH' }]);
    getUserPositionMock.mockResolvedValue({ stETHBalance: '1' });

    const { result } = renderHook(() => useStakingData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.clearCacheAndRefresh();
    });

    expect(clearLidoDataCacheMock).toHaveBeenCalledTimes(1);
  });
});
