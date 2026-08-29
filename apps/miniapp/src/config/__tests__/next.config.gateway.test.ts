import { describe, expect, it } from 'vitest';

import { resolveGatewayBaseForRewrite } from '../../../next.config';

describe('next.config gateway rewrite resolution', () => {
  it('uses PanoramaBlock-controlled gateway ingress in production', () => {
    const result = resolveGatewayBaseForRewrite(
      {
        NODE_ENV: 'production',
        NEXT_PUBLIC_GATEWAY_URL: 'https://old-dead-container.example/',
      },
      false,
    );

    expect(result.base).toBe('https://api.panoramablock.com/database');
    expect(result.warnings.join(' ')).toContain('Ignoring NEXT_PUBLIC_GATEWAY_URL');
  });

  it('uses PanoramaBlock-controlled gateway ingress in production when no legacy value exists', () => {
    const result = resolveGatewayBaseForRewrite(
      {
        NODE_ENV: 'production',
      },
      false,
    );

    expect(result.base).toBe('https://api.panoramablock.com/database');
    expect(result.warnings).toHaveLength(0);
  });

  it('honours explicit gateway configuration in development', () => {
    const result = resolveGatewayBaseForRewrite(
      {
        NODE_ENV: 'development',
        NEXT_PUBLIC_GATEWAY_URL: 'http://localhost:9999/',
      },
      true,
    );

    expect(result.base).toBe('http://localhost:9999');
    expect(result.warnings).toHaveLength(0);
  });

  it('falls back to localhost gateway in development', () => {
    const result = resolveGatewayBaseForRewrite(
      {
        NODE_ENV: 'development',
      },
      true,
    );

    expect(result.base).toBe('http://localhost:8080');
    expect(result.warnings).toHaveLength(0);
  });
});
