import { describe, it, expect } from 'vitest';
import { isCapabilityAvailable, type DiscoverySnapshot } from '../capabilityClient';

const snapshot: DiscoverySnapshot = {
  capabilities: [
    {
      capability: 'swap',
      byChain: {
        '8453': [
          { provider: 'aerodrome', healthy: true },
          { provider: 'uniswap', healthy: false },
        ],
        '1': [{ provider: 'uniswap', healthy: true }],
      },
    },
    {
      capability: 'staking',
      byChain: {
        '1': [{ provider: 'lido', healthy: true }],
      },
    },
  ],
  generatedAt: new Date().toISOString(),
  cacheTtlSeconds: 30,
};

describe('isCapabilityAvailable', () => {
  it('returns true when at least one healthy provider exists', () => {
    expect(isCapabilityAvailable(snapshot, 'swap', 8453)).toBe(true);
    expect(isCapabilityAvailable(snapshot, 'staking', 1)).toBe(true);
  });

  it('returns false when no healthy providers', () => {
    const noHealthy: DiscoverySnapshot = {
      ...snapshot,
      capabilities: [{
        capability: 'swap',
        byChain: { '8453': [{ provider: 'x', healthy: false }] },
      }],
    };
    expect(isCapabilityAvailable(noHealthy, 'swap', 8453)).toBe(false);
  });

  it('returns false for unknown capability', () => {
    expect(isCapabilityAvailable(snapshot, 'lending', 8453)).toBe(false);
  });

  it('returns false for unknown chain', () => {
    expect(isCapabilityAvailable(snapshot, 'swap', 137)).toBe(false);
  });
});
