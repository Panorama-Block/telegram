import { describe, expect, it } from 'vitest';
import { normalizeAvaxLpAction, normalizeAvaxLpPoolId, normalizeAvaxLpIntentMetadata } from '../normalizers';

describe('normalizeAvaxLpAction', () => {
  it('maps direct action names', () => {
    expect(normalizeAvaxLpAction('add')).toBe('add');
    expect(normalizeAvaxLpAction('remove')).toBe('remove');
    expect(normalizeAvaxLpAction('stake')).toBe('stake');
    expect(normalizeAvaxLpAction('unstake')).toBe('unstake');
    expect(normalizeAvaxLpAction('claim')).toBe('claim');
  });

  it('maps aliases', () => {
    expect(normalizeAvaxLpAction('add_liquidity')).toBe('add');
    expect(normalizeAvaxLpAction('enter')).toBe('add');
    expect(normalizeAvaxLpAction('provide')).toBe('add');
    expect(normalizeAvaxLpAction('remove_liquidity')).toBe('remove');
    expect(normalizeAvaxLpAction('exit')).toBe('remove');
    expect(normalizeAvaxLpAction('withdraw')).toBe('remove');
    expect(normalizeAvaxLpAction('deposit')).toBe('stake');
    expect(normalizeAvaxLpAction('claim_rewards')).toBe('claim');
    expect(normalizeAvaxLpAction('harvest')).toBe('claim');
  });

  it('is case-insensitive', () => {
    expect(normalizeAvaxLpAction('ADD')).toBe('add');
    expect(normalizeAvaxLpAction('Add_Liquidity')).toBe('add');
    expect(normalizeAvaxLpAction('STAKE')).toBe('stake');
  });

  it('returns undefined for unknown values', () => {
    expect(normalizeAvaxLpAction('unknown')).toBeUndefined();
    expect(normalizeAvaxLpAction(null)).toBeUndefined();
    expect(normalizeAvaxLpAction(undefined)).toBeUndefined();
    expect(normalizeAvaxLpAction(42)).toBeUndefined();
    expect(normalizeAvaxLpAction('')).toBeUndefined();
  });
});

describe('normalizeAvaxLpPoolId', () => {
  it('accepts integer numbers', () => {
    expect(normalizeAvaxLpPoolId(0)).toBe(0);
    expect(normalizeAvaxLpPoolId(3)).toBe(3);
    expect(normalizeAvaxLpPoolId(100)).toBe(100);
  });

  it('parses integer strings', () => {
    expect(normalizeAvaxLpPoolId('0')).toBe(0);
    expect(normalizeAvaxLpPoolId('3')).toBe(3);
    expect(normalizeAvaxLpPoolId('42')).toBe(42);
  });

  it('returns undefined for non-integer strings', () => {
    expect(normalizeAvaxLpPoolId('abc')).toBeUndefined();
    expect(normalizeAvaxLpPoolId('3.5')).toBeUndefined();
    expect(normalizeAvaxLpPoolId('weth-usdc')).toBeUndefined();
    expect(normalizeAvaxLpPoolId('')).toBeUndefined();
  });

  it('returns undefined for floats and negative numbers', () => {
    expect(normalizeAvaxLpPoolId(3.5)).toBeUndefined();
    expect(normalizeAvaxLpPoolId(-1)).toBeUndefined();
  });

  it('returns undefined for null/undefined/objects', () => {
    expect(normalizeAvaxLpPoolId(null)).toBeUndefined();
    expect(normalizeAvaxLpPoolId(undefined)).toBeUndefined();
    expect(normalizeAvaxLpPoolId({})).toBeUndefined();
  });
});

describe('normalizeAvaxLpIntentMetadata', () => {
  it('returns null for null/undefined input', () => {
    expect(normalizeAvaxLpIntentMetadata(null)).toBeNull();
    expect(normalizeAvaxLpIntentMetadata(undefined)).toBeNull();
  });

  it('normalizes action aliases', () => {
    const result = normalizeAvaxLpIntentMetadata({ action: 'add_liquidity' });
    expect(result?.action).toBe('add');
  });

  it('normalizes pool_id as number', () => {
    const result = normalizeAvaxLpIntentMetadata({ pool_id: '3' });
    expect(result?.pool_id).toBe(3);
    expect(result?.poolId).toBe(3);
  });

  it('accepts poolId alias', () => {
    const result = normalizeAvaxLpIntentMetadata({ poolId: '5' });
    expect(result?.pool_id).toBe(5);
  });

  it('preserves other fields unchanged', () => {
    const result = normalizeAvaxLpIntentMetadata({ action: 'stake', pool_id: '2', amount: '1.5' });
    expect(result?.amount).toBe('1.5');
    expect(result?.action).toBe('stake');
    expect(result?.pool_id).toBe(2);
  });

  it('does not add pool_id if invalid', () => {
    const result = normalizeAvaxLpIntentMetadata({ pool_id: 'invalid' });
    expect(result?.pool_id).toBeUndefined();
  });
});
