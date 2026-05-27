import { describe, it, expect } from 'vitest';
import { buildIntent, intentEndpoint, intentToRequestBody } from '../src/services/capabilityIntent.js';

describe('capabilityIntent', () => {
  it('buildIntent creates well-formed intent', () => {
    const intent = buildIntent('swap', 'prepare-swap', {
      chainId: 8453,
      userAddress: '0x1234567890123456789012345678901234567890',
      payload: { tokenIn: '0xA', amountIn: '1000' },
    });
    expect(intent.capability).toBe('swap');
    expect(intent.action).toBe('prepare-swap');
    expect(intent.chainId).toBe(8453);
    expect(intent.tenantId).toBe('0x1234567890123456789012345678901234567890');
    expect(intent.traceId).toBeDefined();
  });

  it('intentEndpoint returns correct path', () => {
    const intent = buildIntent('staking', 'prepare-stake', {
      chainId: 1,
      userAddress: '0xabc',
    });
    expect(intentEndpoint(intent)).toBe('/v1/capability/staking/prepare-stake');
  });

  it('intentToRequestBody matches CapabilityRequest shape', () => {
    const intent = buildIntent('lending', 'prepare-supply', {
      chainId: 43114,
      userAddress: '0xuser',
      payload: { asset: 'USDC', amount: '100' },
    });
    const body = intentToRequestBody(intent);
    expect(body.tenantId).toBe('0xuser');
    expect(body.chainId).toBe(43114);
    expect(body.userAddress).toBe('0xuser');
    expect(body.payload).toEqual({ asset: 'USDC', amount: '100' });
    expect(body.idempotencyKey).toBeUndefined();
  });

  it('includes idempotencyKey when set', () => {
    const intent = buildIntent('swap', 'prepare-swap', {
      chainId: 8453,
      userAddress: '0x1',
    });
    intent.idempotencyKey = 'idem-123';
    const body = intentToRequestBody(intent);
    expect(body.idempotencyKey).toBe('idem-123');
  });
});
