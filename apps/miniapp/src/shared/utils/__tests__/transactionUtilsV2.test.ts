import { describe, expect, test } from 'vitest';
import { safeExecuteTransactionV2 } from '@/shared/utils/transactionUtilsV2';

describe('safeExecuteTransactionV2', () => {
  test('accepts direct hash string returned by wallet', async () => {
    const hash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const result = await safeExecuteTransactionV2(async () => hash);

    expect(result).toEqual({
      success: true,
      transactionHash: hash,
      source: 'wallet',
    });
  });

  test('accepts object hash fields returned by wallet', async () => {
    const hash = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const result = await safeExecuteTransactionV2(async () => ({ hash }));

    expect(result.success).toBe(true);
    expect(result.transactionHash).toBe(hash);
    expect(result.source).toBe('wallet');
  });

  test('recovers hash from thrown error payload', async () => {
    const hash = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
    const result = await safeExecuteTransactionV2(async () => {
      throw new Error(`provider failure after broadcast tx=${hash}`);
    });

    expect(result.success).toBe(true);
    expect(result.transactionHash).toBe(hash);
    expect(result.source).toBe('recovered');
  });

  test('fails when hash cannot be recovered', async () => {
    const result = await safeExecuteTransactionV2(async () => ({ ok: true }));

    expect(result.success).toBe(false);
    expect(result.transactionHash).toBeUndefined();
    expect(result.error).toMatch(/without a hash/i);
  });
});
