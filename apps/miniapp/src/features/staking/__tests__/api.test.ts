import { beforeEach, describe, expect, test, vi } from 'vitest';
import StakingApiClient from '@/features/staking/api';

const safeExecuteTransactionV2Mock = vi.fn();

vi.mock('@/shared/utils/transactionUtilsV2', () => ({
  safeExecuteTransactionV2: (...args: unknown[]) => safeExecuteTransactionV2Mock(...args),
}));

vi.mock('@/shared/lib/fetchWithAuth', () => ({
  fetchWithAuth: (...args: unknown[]) => fetch(...(args as Parameters<typeof fetch>)),
}));

describe('StakingApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    safeExecuteTransactionV2Mock.mockReset();
    localStorage.clear();
  });

  test('falls back APR source and caches result', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ apr: 3.42 }), { status: 200 }));

    const api = new StakingApiClient(null);
    const first = await api.getTokens();
    const second = await api.getTokens();

    expect(first[0]?.stakingAPY).toBe(3.42);
    expect(second[0]?.stakingAPY).toBe(3.42);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('rejects when connected wallet mismatches authenticated address', async () => {
    const payload = btoa(JSON.stringify({ address: '0x2222222222222222222222222222222222222222' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    localStorage.setItem('authToken', `a.${payload}.c`);

    const api = new StakingApiClient({
      address: '0x1111111111111111111111111111111111111111',
      sendTransaction: vi.fn(),
    });

    await expect(
      api.executeTransaction({
        to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        data: '0x1234',
        value: '0',
        chainId: 1,
      }),
    ).rejects.toThrow(/does not match authenticated address/i);
  });

  test('fails fast on wrong wallet network for staking tx', async () => {
    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      value: {
        chainId: '0xa86a',
      },
    });

    const api = new StakingApiClient({
      address: '0x1111111111111111111111111111111111111111',
      sendTransaction: vi.fn(),
    });

    await expect(
      api.executeTransaction({
        to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        data: '0x1234',
        value: '0',
        chainId: 1,
      }),
    ).rejects.toThrow(/Wrong network/i);
  });

  test('maps wallet execution result to tx hash', async () => {
    const sendTransactionMock = vi.fn().mockResolvedValue({
      transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });

    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      value: {
        chainId: '0x1',
      },
    });

    safeExecuteTransactionV2Mock.mockImplementation(async (fn: () => Promise<{ transactionHash: string }>) => {
      const result = await fn();
      return { success: true, transactionHash: result.transactionHash };
    });

    const api = new StakingApiClient({
      address: '0x1111111111111111111111111111111111111111',
      sendTransaction: sendTransactionMock,
    });

    const hash = await api.executeTransaction({
      to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
      data: '0x1234',
      value: '1',
      gasLimit: '21000',
      chainId: 1,
    });

    expect(hash).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(sendTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 1,
        value: '0x1',
        gas: '0x5208',
      }),
    );
  });
});
