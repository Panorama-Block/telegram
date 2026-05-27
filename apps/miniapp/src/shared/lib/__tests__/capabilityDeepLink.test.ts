import { describe, it, expect } from 'vitest';
import { encodeCapabilityDeepLink, decodeCapabilityDeepLink } from '../capabilityDeepLink';

describe('capabilityDeepLink', () => {
  it('round-trips encode → decode', () => {
    const params = { capability: 'swap', action: 'prepare-swap', chainId: 8453, payload: { tokenIn: '0xA' } };
    const link = encodeCapabilityDeepLink('PanoramaBot', params);
    expect(link).toContain('t.me/PanoramaBot');

    const startapp = link.split('startapp=')[1]!;
    const decoded = decodeCapabilityDeepLink(startapp);
    expect(decoded).toEqual(params);
  });

  it('works without payload', () => {
    const params = { capability: 'staking', action: 'prepare-stake', chainId: 1 };
    const link = encodeCapabilityDeepLink('Bot', params);
    const startapp = link.split('startapp=')[1]!;
    const decoded = decodeCapabilityDeepLink(startapp);
    expect(decoded?.capability).toBe('staking');
    expect(decoded?.payload).toBeUndefined();
  });

  it('returns null for invalid base64', () => {
    expect(decodeCapabilityDeepLink('not-valid-base64!!!')).toBeNull();
  });

  it('returns null for valid base64 but invalid JSON structure', () => {
    expect(decodeCapabilityDeepLink(btoa('{"x":1}'))).toBeNull();
  });
});
