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

  test('does not fallback to second submission when direct wallet response has no hash', async () => {
    const sendTransactionMock = vi.fn().mockResolvedValue({
      transactionHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });
    const requestMock = vi.fn().mockResolvedValue({ ok: true });

    safeExecuteTransactionV2Mock.mockImplementation(async (fn: () => Promise<{ transactionHash: string }>) => {
      try {
        const result = await fn();
        return { success: true, transactionHash: result.transactionHash };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      value: {
        chainId: '0x1',
        request: requestMock,
      },
    });

    const api = new StakingApiClient({
      address: '0x1111111111111111111111111111111111111111',
      sendTransaction: sendTransactionMock,
    });

    await expect(
      api.executeTransaction({
        to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        data: '0x1234',
        value: '1',
        chainId: 1,
      }),
    ).rejects.toThrow(/without a hash|submission failed/i);

    expect(requestMock).toHaveBeenCalled();
    const requestMethods = requestMock.mock.calls.map((args) => args?.[0]?.method);
    expect(requestMethods).toContain('eth_sendTransaction');
    expect(sendTransactionMock).not.toHaveBeenCalled();
    expect(safeExecuteTransactionV2Mock).toHaveBeenCalledTimes(1);
  });

  test('recovers tx hash while wallet send promise is still pending', async () => {
    const neverSettlingPromise = new Promise<string>(() => {});
    const recoveredHash = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
    const fromAddress = '0x1111111111111111111111111111111111111111';
    const toAddress = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';
    const data = '0x1234';

    const requestMock = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_accounts') return [fromAddress];
      if (method === 'eth_sendTransaction') return neverSettlingPromise;
      if (method === 'eth_chainId') return '0x1';
      if (method === 'eth_blockNumber') return '0x10';
      if (method === 'eth_getBlockByNumber') {
        return {
          transactions: [
            {
              hash: recoveredHash,
              from: fromAddress,
              to: toAddress,
              input: data,
            },
          ],
        };
      }
      return null;
    });

    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      value: {
        chainId: '0x1',
        request: requestMock,
      },
    });

    safeExecuteTransactionV2Mock.mockImplementation(async (fn: () => Promise<{ transactionHash: string }>) => {
      const result = await fn();
      return { success: true, transactionHash: result.transactionHash };
    });

    const sendTransactionMock = vi.fn().mockResolvedValue({
      transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });

    const api = new StakingApiClient({
      address: fromAddress,
      sendTransaction: sendTransactionMock,
    });

    const hash = await api.executeTransaction({
      to: toAddress,
      data,
      value: '1',
      chainId: 1,
    });

    expect(hash).toBe(recoveredHash);
    expect(sendTransactionMock).not.toHaveBeenCalled();
    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'eth_sendTransaction',
      }),
    );
  });
});
