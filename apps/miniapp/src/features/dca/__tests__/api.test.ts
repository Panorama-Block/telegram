import { beforeEach, describe, expect, test, vi } from 'vitest';

const { authenticatedFetchMock } = vi.hoisted(() => ({
  authenticatedFetchMock: vi.fn(),
}));

vi.mock('@/shared/lib/telegram-auth', () => ({
  authenticatedFetch: authenticatedFetchMock,
}));

import { DCAApiError, getUserAccounts } from '../api';

const USER = '0x1111111111111111111111111111111111111111';

describe('DCA smart-account discovery', () => {
  beforeEach(() => {
    authenticatedFetchMock.mockReset();
  });

  test('returns accounts from a successful JSON response', async () => {
    const accounts = [
      {
        address: '0x2222222222222222222222222222222222222222',
        userId: USER,
        name: 'Primary',
        createdAt: 1,
        sessionKeyAddress: '0x3333333333333333333333333333333333333333',
        expiresAt: 2,
        permissions: {
          approvedTargets: [],
          nativeTokenLimitPerTransaction: '0',
          startTimestamp: 1,
          endTimestamp: 2,
        },
      },
    ];

    authenticatedFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ accounts }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(getUserAccounts(USER)).resolves.toEqual(accounts);
  });

  test('preserves a genuine successful empty account collection', async () => {
    authenticatedFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ accounts: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(getUserAccounts(USER)).resolves.toEqual([]);
  });

  test('rejects a non-JSON success instead of treating it as zero accounts', async () => {
    authenticatedFetchMock.mockResolvedValueOnce(
      new Response('<html>proxy failure</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(getUserAccounts(USER)).rejects.toBeInstanceOf(DCAApiError);
  });

  test('rejects malformed JSON account payload instead of treating it as zero accounts', async () => {
    authenticatedFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(getUserAccounts(USER)).rejects.toBeInstanceOf(DCAApiError);
  });

  test('preserves an HTTP API failure as DCAApiError', async () => {
    authenticatedFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'DCA unavailable' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(getUserAccounts(USER)).rejects.toMatchObject({
      name: 'DCAApiError',
      message: 'DCA unavailable',
      status: 503,
    });
  });

  test('converts a network failure into DCAApiError rather than an empty collection', async () => {
    authenticatedFetchMock.mockRejectedValueOnce(
      new TypeError('Failed to fetch'),
    );

    await expect(getUserAccounts(USER)).rejects.toMatchObject({
      name: 'DCAApiError',
      message: 'Failed to fetch',
    });
  });
});
