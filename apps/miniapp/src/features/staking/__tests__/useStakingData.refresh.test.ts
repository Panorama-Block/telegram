import { renderHook, waitFor } from '@testing-library/react';
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

describe('useStakingData refresh', () => {
  beforeEach(() => {
    getTokensMock.mockReset();
    getUserPositionMock.mockReset();
    clearLidoDataCacheMock.mockReset();

    getTokensMock.mockResolvedValue([
      {
        symbol: 'ETH',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
        stakingAPY: 3.2,
        totalStaked: '0',
        minimumStake: '1',
        lockPeriod: 0,
        isActive: true,
      },
    ]);
    getUserPositionMock.mockResolvedValue(null);
  });

  test('refresh is awaitable and forces a new fetch cycle', async () => {
    const { result } = renderHook(() => useStakingData());

    await waitFor(() => {
      expect(getTokensMock).toHaveBeenCalledTimes(1);
      expect(getUserPositionMock).toHaveBeenCalledTimes(1);
    });

    const refreshPromise = result.current.refresh();
    expect(refreshPromise).toBeInstanceOf(Promise);

    await refreshPromise;

    expect(getTokensMock).toHaveBeenCalledTimes(2);
    expect(getUserPositionMock).toHaveBeenCalledTimes(2);
  });
});
