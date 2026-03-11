import { describe, expect, test } from 'vitest';
import {
  buildOpenWidgetPlan,
  buildOpenWidgetQueryKey,
  deriveLendingFlowFromAction,
  deriveLendingModeFromAction,
  parseLendingFlow,
  parseLendingMode,
  parseLendingQueryMetadata,
  parseStakingMode,
  parseStakingQueryMetadata,
  parseYieldAction,
  parseYieldPoolId,
  parseYieldQueryMetadata,
  resolveOpenWidgetTarget,
} from '@/app/chat/openWidgetQuery';

describe('openWidgetQuery helpers', () => {
  test('parses and resolves open target', () => {
    expect(resolveOpenWidgetTarget('lending')).toBe('lending');
    expect(resolveOpenWidgetTarget('STAKING')).toBe('staking');
    expect(resolveOpenWidgetTarget('yield')).toBe('yield');
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
    const yieldParams = new URLSearchParams('open=yield&action=add_liquidity&pool_id=WETH-USDC&amount=2.3');

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

    expect(parseYieldQueryMetadata(yieldParams)).toEqual({
      amount: '2.3',
      action: 'enter',
      pool_id: 'weth-usdc-volatile',
    });

    expect(parseLendingQueryMetadata(new URLSearchParams('open=lending'))).toBeNull();
    expect(parseStakingQueryMetadata(new URLSearchParams('open=staking'))).toBeNull();
    expect(parseYieldQueryMetadata(new URLSearchParams('open=yield'))).toBeNull();
  });

  test('builds deterministic key from query', () => {
    const params = new URLSearchParams('open=lending&amount=2');
    expect(buildOpenWidgetQueryKey('lending', params)).toBe('lending:open=lending&amount=2');
  });

  test('builds widget opening plan from query params', () => {
    const lendingParams = new URLSearchParams('open=lending&amount=2&asset=AVAX');
    const stakingParams = new URLSearchParams('open=staking&amount=0.5&mode=unstake');
    const yieldParams = new URLSearchParams('open=yield&action=stake&pool_id=weth-usdc');

    expect(buildOpenWidgetPlan(lendingParams)).toEqual({
      target: 'lending',
      network: 'avalanche',
      metadata: { amount: '2', asset: 'AVAX' },
    });

    expect(buildOpenWidgetPlan(stakingParams)).toEqual({
      target: 'staking',
      network: 'ethereum',
      metadata: { amount: '0.5', mode: 'unstake' },
    });

    expect(buildOpenWidgetPlan(yieldParams)).toEqual({
      target: 'yield',
      network: 'base',
      metadata: { action: 'enter', pool_id: 'weth-usdc-volatile' },
    });

    expect(buildOpenWidgetPlan(new URLSearchParams('open=swap&amount=1'))).toBeNull();
  });

  test('maps legacy and canonical yield actions', () => {
    expect(parseYieldAction('add_liquidity')).toBe('enter');
    expect(parseYieldAction('stake')).toBe('enter');
    expect(parseYieldAction('remove_liquidity')).toBe('exit');
    expect(parseYieldAction('unstake')).toBe('exit');
    expect(parseYieldAction('claim_rewards')).toBe('claim');
    expect(parseYieldAction('enter')).toBe('enter');
    expect(parseYieldAction('exit')).toBe('exit');
    expect(parseYieldAction('claim')).toBe('claim');
    expect(parseYieldAction('unknown')).toBeUndefined();
  });

  test('normalizes pool aliases to canonical ids', () => {
    expect(parseYieldPoolId('WETH-USDC')).toBe('weth-usdc-volatile');
    expect(parseYieldPoolId('weth/usdc')).toBe('weth-usdc-volatile');
    expect(parseYieldPoolId('weth-usdc-volatile')).toBe('weth-usdc-volatile');
  });
});
