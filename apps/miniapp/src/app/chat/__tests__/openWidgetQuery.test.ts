import { describe, expect, test } from 'vitest';
import {
  buildOpenWidgetQueryKey,
  deriveLendingFlowFromAction,
  deriveLendingModeFromAction,
  parseLendingFlow,
  parseLendingMode,
  parseLendingQueryMetadata,
  parseStakingMode,
  parseStakingQueryMetadata,
  resolveOpenWidgetTarget,
} from '@/app/chat/openWidgetQuery';

describe('openWidgetQuery helpers', () => {
  test('parses and resolves open target', () => {
    expect(resolveOpenWidgetTarget('lending')).toBe('lending');
    expect(resolveOpenWidgetTarget('STAKING')).toBe('staking');
    expect(resolveOpenWidgetTarget('swap')).toBeNull();
  });

  test('parses lending mode/flow and staking mode', () => {
    expect(parseLendingMode('supply')).toBe('supply');
    expect(parseLendingMode('borrow')).toBe('borrow');
    expect(parseLendingMode('invalid')).toBeUndefined();

    expect(parseLendingFlow('open')).toBe('open');
    expect(parseLendingFlow('close')).toBe('close');
    expect(parseLendingFlow('other')).toBeUndefined();

    expect(parseStakingMode('stake')).toBe('stake');
    expect(parseStakingMode('unstake')).toBe('unstake');
    expect(parseStakingMode('x')).toBeUndefined();
  });

  test('derives lending action mode/flow from action metadata', () => {
    expect(deriveLendingModeFromAction('withdraw')).toBe('supply');
    expect(deriveLendingModeFromAction('repay')).toBe('borrow');
    expect(deriveLendingModeFromAction('noop')).toBeUndefined();

    expect(deriveLendingFlowFromAction('supply')).toBe('open');
    expect(deriveLendingFlowFromAction('repay')).toBe('close');
    expect(deriveLendingFlowFromAction('noop')).toBeUndefined();
  });

  test('builds metadata from query params and ignores empty values', () => {
    const lendingParams = new URLSearchParams('open=lending&amount=1.5&asset=AVAX&mode=supply&flow=open');
    const stakingParams = new URLSearchParams('open=staking&amount=0.1&mode=stake');

    expect(parseLendingQueryMetadata(lendingParams)).toEqual({
      amount: '1.5',
      asset: 'AVAX',
      mode: 'supply',
      flow: 'open',
    });

    expect(parseStakingQueryMetadata(stakingParams)).toEqual({
      amount: '0.1',
      mode: 'stake',
    });

    expect(parseLendingQueryMetadata(new URLSearchParams('open=lending'))).toBeNull();
    expect(parseStakingQueryMetadata(new URLSearchParams('open=staking'))).toBeNull();
  });

  test('builds deterministic key from query', () => {
    const params = new URLSearchParams('open=lending&amount=2');
    expect(buildOpenWidgetQueryKey('lending', params)).toBe('lending:open=lending&amount=2');
  });
});
