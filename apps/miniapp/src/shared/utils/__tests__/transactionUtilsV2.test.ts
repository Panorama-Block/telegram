import { describe, expect, test, it } from 'vitest';
import {
  assertNoRawAvalancheApproval,
  safeExecuteTransactionV2,
} from '@/shared/utils/transactionUtilsV2';

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

describe('assertNoRawAvalancheApproval', () => {
  it('rejects an Avalanche ERC-20 approve payload', () => {
    expect(() =>
      assertNoRawAvalancheApproval(
        43114,
        '0x095ea7b3abcdef'
      )
    ).toThrow(
      'Avalanche approval must be executed through an evidence-bound operation'
    );
  });

  it('allows non-approval Avalanche calldata', () => {
    expect(() =>
      assertNoRawAvalancheApproval(
        43114,
        '0x12345678'
      )
    ).not.toThrow();
  });

  it('allows ERC-20 approve payloads on non-Avalanche chains', () => {
    expect(() =>
      assertNoRawAvalancheApproval(
        8453,
        '0x095ea7b3abcdef'
      )
    ).not.toThrow();

    expect(() =>
      assertNoRawAvalancheApproval(
        1,
        '0x095ea7b3abcdef'
      )
    ).not.toThrow();
  });

  it('matches the approve selector case-insensitively', () => {
    expect(() =>
      assertNoRawAvalancheApproval(
        43114,
        '0x095EA7B3abcdef'
      )
    ).toThrow(
      'Avalanche approval must be executed through an evidence-bound operation'
    );
  });
});
