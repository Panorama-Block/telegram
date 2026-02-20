import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useLendingData } from '@/features/lending/useLendingData';

const getTokensMock = vi.fn();
const getUserPositionMock = vi.fn();
const clearLendingDataCacheMock = vi.fn();

vi.mock('@/features/lending/api', () => ({
  useLendingApi: () => ({
    getTokens: (...args: unknown[]) => getTokensMock(...args),
    getUserPosition: (...args: unknown[]) => getUserPositionMock(...args),
    clearLendingDataCache: (...args: unknown[]) => clearLendingDataCacheMock(...args),
  }),
}));

describe('useLendingData', () => {
  beforeEach(() => {
    getTokensMock.mockReset();
    getUserPositionMock.mockReset();
    clearLendingDataCacheMock.mockReset();
  });

  test('loads tokens + position on first mount and refreshes manually', async () => {
    getTokensMock.mockResolvedValue([
      {
        symbol: 'AVAX',
        qTokenAddress: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
      },
    ]);
    getUserPositionMock.mockResolvedValue({
      accountAddress: '0x1111111111111111111111111111111111111111',
      positions: [],
    });

    const { result } = renderHook(() => useLendingData());

    await waitFor(() => {
      expect(result.current.tokens).toHaveLength(1);
      expect(result.current.userPosition?.accountAddress).toContain('0x1111');
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(getTokensMock).toHaveBeenCalledTimes(2);
    expect(getUserPositionMock).toHaveBeenCalledTimes(2);
  });

  test('exposes error when fetch fails', async () => {
    getTokensMock.mockRejectedValue(new Error('failed to load markets'));
    getUserPositionMock.mockResolvedValue(null);

    const { result } = renderHook(() => useLendingData());

    await waitFor(
      () => {
        const message =
          typeof result.current.error === 'string'
            ? result.current.error
            : result.current.error?.message;
        expect(message).toMatch(/failed to load markets/i);
      },
      { timeout: 5000 },
    );
  });
});
