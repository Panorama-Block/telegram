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

  test('switches the selected Thirdweb wallet to Ethereum before submission', async () => {
    const switchChainMock = vi.fn().mockResolvedValue(undefined);
    const sendTransactionMock = vi.fn().mockResolvedValue({
      transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });

    safeExecuteTransactionV2Mock.mockImplementation(async (fn: () => Promise<{ transactionHash: string }>) => {
      const result = await fn();
      return {
        success: true,
        transactionHash: result.transactionHash,
      };
    });

    const api = new StakingApiClient(
      {
        address: '0x1111111111111111111111111111111111111111',
        sendTransaction: sendTransactionMock,
      },
      switchChainMock,
    );

    const hash = await api.executeTransaction({
      to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
      data: '0x1234',
      value: '1',
      gasLimit: '21000',
      chainId: 1,
    });

    expect(hash).toBe(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );

    expect(switchChainMock).toHaveBeenCalledTimes(1);
    expect(switchChainMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
      }),
    );

    expect(sendTransactionMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 1,
        value: '0x1',
        gas: '0x5208',
      }),
    );
  });

  test('does not touch an injected browser wallet during Lido execution', async () => {
    const injectedRequestMock = vi.fn(() => {
      throw new Error('Injected browser provider must not be touched');
    });

    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      value: {
        chainId: '0xa86a',
        providers: [
          {
            isPhantom: true,
            request: injectedRequestMock,
          },
        ],
        request: injectedRequestMock,
      },
    });

    const switchChainMock = vi.fn().mockResolvedValue(undefined);
    const sendTransactionMock = vi.fn().mockResolvedValue({
      transactionHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });

    safeExecuteTransactionV2Mock.mockImplementation(async (fn: () => Promise<{ transactionHash: string }>) => {
      const result = await fn();
      return {
        success: true,
        transactionHash: result.transactionHash,
      };
    });

    const api = new StakingApiClient(
      {
        address: '0x1111111111111111111111111111111111111111',
        sendTransaction: sendTransactionMock,
      },
      switchChainMock,
    );

    const hash = await api.executeTransaction({
      to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
      data: '0x1234',
      value: '1',
      chainId: 1,
    });

    expect(hash).toBe(
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    expect(injectedRequestMock).not.toHaveBeenCalled();
    expect(switchChainMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionMock).toHaveBeenCalledTimes(1);
  });

  test('does not submit when Thirdweb wallet chain switching fails', async () => {
    const switchChainMock = vi.fn().mockRejectedValue(
      new Error('Wallet refused chain switch'),
    );
    const sendTransactionMock = vi.fn();

    const api = new StakingApiClient(
      {
        address: '0x1111111111111111111111111111111111111111',
        sendTransaction: sendTransactionMock,
      },
      switchChainMock,
    );

    await expect(
      api.executeTransaction({
        to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        data: '0x1234',
        value: '1',
        chainId: 1,
      }),
    ).rejects.toThrow(/network|switch/i);

    expect(switchChainMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionMock).not.toHaveBeenCalled();
    expect(safeExecuteTransactionV2Mock).not.toHaveBeenCalled();
  });

  test('requires the Thirdweb chain-control path before transaction submission', async () => {
    const sendTransactionMock = vi.fn();

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
    ).rejects.toThrow(/network switching is unavailable|network/i);

    expect(sendTransactionMock).not.toHaveBeenCalled();
    expect(safeExecuteTransactionV2Mock).not.toHaveBeenCalled();
  });

  test('does not perform a second submission when the selected wallet returns no hash', async () => {
    const switchChainMock = vi.fn().mockResolvedValue(undefined);
    const sendTransactionMock = vi.fn().mockResolvedValue({});

    safeExecuteTransactionV2Mock.mockImplementation(async (fn: () => Promise<unknown>) => {
      await fn();
      return {
        success: false,
        error: 'Wallet submitted transaction without a hash.',
      };
    });

    const api = new StakingApiClient(
      {
        address: '0x1111111111111111111111111111111111111111',
        sendTransaction: sendTransactionMock,
      },
      switchChainMock,
    );

    await expect(
      api.executeTransaction({
        to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        data: '0x1234',
        value: '1',
        chainId: 1,
      }),
    ).rejects.toThrow(/without a hash/i);

    expect(switchChainMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionMock).toHaveBeenCalledTimes(1);
    expect(safeExecuteTransactionV2Mock).toHaveBeenCalledTimes(1);
  });


  test('validates transaction data before touching the selected wallet network', async () => {
    const switchChainMock = vi.fn();
    const sendTransactionMock = vi.fn();

    const api = new StakingApiClient(
      {
        address: '0x1111111111111111111111111111111111111111',
        sendTransaction: sendTransactionMock,
      },
      switchChainMock,
    );

    await expect(
      api.executeTransaction({
        to: '',
        data: '',
        value: '1',
        chainId: 1,
      }),
    ).rejects.toThrow(/invalid|missing/i);

    expect(switchChainMock).not.toHaveBeenCalled();
    expect(sendTransactionMock).not.toHaveBeenCalled();
    expect(safeExecuteTransactionV2Mock).not.toHaveBeenCalled();
  });

  test('deduplicates concurrent identical executions before wallet control and submission', async () => {
    const transactionHash =
      '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';

    let releaseSubmission!: () => void;
    const submissionGate = new Promise<void>((resolve) => {
      releaseSubmission = resolve;
    });

    const switchChainMock = vi.fn().mockResolvedValue(undefined);
    const sendTransactionMock = vi.fn().mockImplementation(async () => {
      await submissionGate;
      return { transactionHash };
    });

    safeExecuteTransactionV2Mock.mockImplementation(async (fn: () => Promise<unknown>) => {
      const result = await fn() as { transactionHash: string };
      return {
        success: true,
        transactionHash: result.transactionHash,
      };
    });

    const api = new StakingApiClient(
      {
        address: '0x1111111111111111111111111111111111111111',
        sendTransaction: sendTransactionMock,
      },
      switchChainMock,
    );

    const transaction = {
      to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
      data: '0x1234',
      value: '1',
      chainId: 1,
    };

    const first = api.executeTransaction(transaction);
    const second = api.executeTransaction(transaction);

    await vi.waitFor(() => {
      expect(sendTransactionMock).toHaveBeenCalledTimes(1);
    });

    expect(switchChainMock).toHaveBeenCalledTimes(1);
    expect(safeExecuteTransactionV2Mock).toHaveBeenCalledTimes(1);

    releaseSubmission();

    const [firstHash, secondHash] = await Promise.all([first, second]);

    expect(firstHash).toBe(transactionHash);
    expect(secondHash).toBe(transactionHash);
    expect(switchChainMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionMock).toHaveBeenCalledTimes(1);
    expect(safeExecuteTransactionV2Mock).toHaveBeenCalledTimes(1);
  });

});
