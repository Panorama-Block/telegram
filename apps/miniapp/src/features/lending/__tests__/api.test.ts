import { beforeEach, describe, expect, test, vi } from 'vitest';
import LendingApiClient from '@/features/lending/api';

const safeExecuteTransactionV2Mock = vi.fn();

vi.mock('@/shared/utils/transactionUtilsV2', () => ({
  safeExecuteTransactionV2: (...args: unknown[]) => safeExecuteTransactionV2Mock(...args),
}));

vi.mock('@/shared/lib/fetchWithAuth', () => ({
  fetchWithAuth: (...args: unknown[]) => fetch(...(args as Parameters<typeof fetch>)),
}));

vi.mock('@/shared/lib/authWalletBinding', () => ({
  getAuthWalletBinding: () => ({
    walletId: null,
    address: null,
  }),
}));

const tokenMarketsPayload = {
  data: {
    markets: [
      {
        qTokenAddress: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
        qTokenSymbol: 'qiAVAX',
        underlyingAddress: 'native',
        underlyingSymbol: 'AVAX',
        underlyingDecimals: 18,
        supplyApyBps: 420,
        borrowApyBps: 810,
      },
    ],
  },
};

describe('LendingApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    safeExecuteTransactionV2Mock.mockReset();
    localStorage.clear();
  });

  test('deduplicates in-flight getTokens requests and caches result', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve(
                new Response(JSON.stringify(tokenMarketsPayload), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                }),
              );
            }, 10);
          }) as any,
      );

    const api = new LendingApiClient(null);
    const [first, second] = await Promise.all([api.getTokens(), api.getTokens()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first[0]?.symbol).toBe('AVAX');
  });

  test('applies cooldown on 429 for getTokens', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'retry-after': '20' },
      }),
    );

    const api = new LendingApiClient(null);
    api.clearLendingDataCache();
    await expect(api.getTokens()).rejects.toThrow(/429/i);
    await expect(api.getTokens()).rejects.toThrow(/Try again/i);
  });

  test('throws wallet compatibility error when sendTransaction is not available', async () => {
    const api = new LendingApiClient({ address: '0x1111111111111111111111111111111111111111' });

    await expect(
      api.executeTransaction({
        to: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
        data: '0x1234',
        value: '0',
      }),
    ).rejects.toThrow(/does not support EVM transactions/i);
  });

  test('normalizes tx payload and executes on matching chain', async () => {
    const sendTransactionMock = vi.fn().mockResolvedValue({
      transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });

    safeExecuteTransactionV2Mock.mockImplementation(async (fn: () => Promise<{ transactionHash: string }>) => {
      const result = await fn();
      return { success: true, transactionHash: result.transactionHash };
    });

    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      value: {
        chainId: '0xa86a',
      },
    });

    const api = new LendingApiClient({
      address: '0x1111111111111111111111111111111111111111',
      sendTransaction: sendTransactionMock,
    });

    const hash = await api.executeTransaction({
      to: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
      data: '0x1234',
      value: '1',
      gasLimit: '21000',
      chainId: 43114,
    });

    expect(hash).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(sendTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
        data: '0x1234',
        value: '0x1',
        gas: '0x5208',
        chainId: 43114,
      }),
    );
  });

  test('does not double-submit when direct wallet response is malformed', async () => {
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
        chainId: '0xa86a',
        request: requestMock,
      },
    });

    const api = new LendingApiClient({
      address: '0x1111111111111111111111111111111111111111',
      sendTransaction: sendTransactionMock,
    });

    await expect(
      api.executeTransaction({
        to: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
        data: '0x1234',
        value: '1',
        chainId: 43114,
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
    const recoveredHash = '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
    const fromAddress = '0x1111111111111111111111111111111111111111';
    const toAddress = '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c';
    const data = '0x1234';

    const requestMock = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_accounts') return [fromAddress];
      if (method === 'eth_sendTransaction') return neverSettlingPromise;
      if (method === 'eth_chainId') return '0xa86a';
      if (method === 'eth_blockNumber') return '0x20';
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
        chainId: '0xa86a',
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

    const api = new LendingApiClient({
      address: fromAddress,
      sendTransaction: sendTransactionMock,
    });

    const hash = await api.executeTransaction({
      to: toAddress,
      data,
      value: '1',
      chainId: 43114,
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
