import { describe, expect, it } from 'vitest';
import { GatewayApiError, isGatewayUnavailableError } from '../api';

describe('gateway availability error detection', () => {
  it('treats network-level gateway errors as unavailable', () => {
    const error = new GatewayApiError('Network request failed', {
      url: '/api/gateway/v1/transactions',
    });

    expect(isGatewayUnavailableError(error)).toBe(true);
  });

  it('treats transient HTTP errors as unavailable', () => {
    const error = new GatewayApiError('Service unavailable', {
      url: '/api/gateway/v1/transactions',
      status: 503,
    });

    expect(isGatewayUnavailableError(error)).toBe(true);
  });

  it('treats generic 5xx errors as unavailable', () => {
    const error = new GatewayApiError('Internal server error', {
      url: '/api/gateway/v1/transactions',
      status: 500,
    });

    expect(isGatewayUnavailableError(error)).toBe(true);
  });

  it('does not treat application HTTP errors as unavailable', () => {
    const error = new GatewayApiError('Validation failed', {
      url: '/api/gateway/v1/transactions',
      status: 400,
    });

    expect(isGatewayUnavailableError(error)).toBe(false);
  });
});
