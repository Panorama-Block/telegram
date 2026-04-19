import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const getMarketsMock = vi.fn();
const getPositionMock = vi.fn();
const getActiveAccountMock = vi.fn<() => { address: string } | undefined>();

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => getActiveAccountMock(),
}));

vi.mock('@/features/metronome/api', () => ({
  useMetronomeApi: () => ({
    getMarkets: (...args: unknown[]) => getMarketsMock(...args),
    getPosition: (...args: unknown[]) => getPositionMock(...args),
  }),
}));

import { useMetronomeData, __metronomeCaches } from '@/features/metronome/useMetronomeData';

const USER = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

const SAMPLE_MARKETS = {
  collateral: [
    {
      symbol: 'msdUSDC',
      depositToken: '0xaa',
      underlying: '0xbb',
      underlyingSymbol: 'USDC',
      decimals: 6,
    },
  ],
  synthetic: [
    { symbol: 'msUSD', debtToken: '0xcc', synth: '0xdd', decimals: 18 },
  ],
};

const SAMPLE_POSITION = {
  userAddress: USER,
  adapterProxy: '0x1111111111111111111111111111111111111111',
  collateral: [
    {
      symbol: 'msdUSDC',
      depositToken: '0xaa',
      underlying: '0xbb',
      underlyingSymbol: 'USDC',
      decimals: 6,
      shares: '1000000000000000000',
    },
  ],
  debt: [
    {
      symbol: 'msUSD',
      debtToken: '0xcc',
      synth: '0xdd',
      decimals: 18,
      debt: '500000000000000000',
    },
  ],
};

describe('useMetronomeData', () => {
  beforeEach(() => {
    getMarketsMock.mockReset();
    getPositionMock.mockReset();
    getActiveAccountMock.mockReset();
    __metronomeCaches.marketsCache.invalidate();
    __metronomeCaches.positionCache.invalidate();
  });

  it('loads markets and position when a wallet is connected', async () => {
    getActiveAccountMock.mockReturnValue({ address: USER });
    getMarketsMock.mockResolvedValue(SAMPLE_MARKETS);
    getPositionMock.mockResolvedValue(SAMPLE_POSITION);

    const { result } = renderHook(() => useMetronomeData());

    await waitFor(() => {
      expect(result.current.markets).not.toBeNull();
      expect(result.current.position).not.toBeNull();
    });

    expect(result.current.markets?.collateral[0].symbol).toBe('msdUSDC');
    expect(result.current.collateralRows).toHaveLength(1);
    expect(result.current.collateralRows[0].iconUrl).toContain('usdc');
    expect(result.current.debtRows).toHaveLength(1);
    expect(getMarketsMock).toHaveBeenCalledTimes(1);
    expect(getPositionMock).toHaveBeenCalledTimes(1);
  });

  it('loads markets only when no wallet is connected', async () => {
    getActiveAccountMock.mockReturnValue(undefined);
    getMarketsMock.mockResolvedValue(SAMPLE_MARKETS);

    const { result } = renderHook(() => useMetronomeData());

    await waitFor(() => expect(result.current.markets).not.toBeNull());
    expect(getPositionMock).not.toHaveBeenCalled();
    expect(result.current.position).toBeNull();
    expect(result.current.collateralRows).toEqual([]);
  });

  it('refresh() forces re-fetch of markets and position', async () => {
    getActiveAccountMock.mockReturnValue({ address: USER });
    getMarketsMock.mockResolvedValue(SAMPLE_MARKETS);
    getPositionMock.mockResolvedValue(SAMPLE_POSITION);

    const { result } = renderHook(() => useMetronomeData());
    await waitFor(() => expect(result.current.position).not.toBeNull());
    expect(getMarketsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(getMarketsMock).toHaveBeenCalledTimes(2);
    expect(getPositionMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces errors from either fetch', async () => {
    getActiveAccountMock.mockReturnValue({ address: USER });
    getMarketsMock.mockResolvedValue(SAMPLE_MARKETS);
    getPositionMock.mockRejectedValue(new Error('rpc blew up'));

    const { result } = renderHook(() => useMetronomeData());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('rpc blew up');
  });
});
