import { describe, expect, test } from 'vitest';
import { normalizePoolId, normalizeYieldAction } from '@/features/yield/normalizers';

describe('yield normalizers', () => {
  test('maps legacy actions to canonical model', () => {
    expect(normalizeYieldAction('add_liquidity')).toBe('enter');
    expect(normalizeYieldAction('stake')).toBe('enter');
    expect(normalizeYieldAction('remove_liquidity')).toBe('exit');
    expect(normalizeYieldAction('unstake')).toBe('exit');
    expect(normalizeYieldAction('claim_rewards')).toBe('claim');
    expect(normalizeYieldAction('enter')).toBe('enter');
    expect(normalizeYieldAction('invalid')).toBeUndefined();
  });

  test('normalizes symbolic pool id to canonical backend id', () => {
    expect(normalizePoolId('WETH-USDC')).toBe('weth-usdc-volatile');
    expect(normalizePoolId('weth/usdc')).toBe('weth-usdc-volatile');
    expect(normalizePoolId('weth-usdc-volatile')).toBe('weth-usdc-volatile');
  });

  test('resolves by token pair against loaded pools', () => {
    const pools = [
      {
        id: 'weth-usdc-stable',
        stable: true,
        tokenA: { symbol: 'WETH' },
        tokenB: { symbol: 'USDC' },
      },
      {
        id: 'weth-usdc-volatile',
        stable: false,
        tokenA: { symbol: 'WETH' },
        tokenB: { symbol: 'USDC' },
      },
    ] as any;

    expect(normalizePoolId('weth usdc', pools)).toBe('weth-usdc-volatile');
    expect(normalizePoolId('weth-usdc-stable', pools)).toBe('weth-usdc-stable');
    expect(normalizePoolId('weth-usdc-stable', [])).toBe('weth-usdc-stable');
  });
});
