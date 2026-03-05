import { describe, expect, it } from 'vitest';

import { resolveLendingBaseForRewrite } from '../../../next.config';

describe('next.config lending rewrite resolution', () => {
  it('uses LENDING_SERVICE_URL in production when provided', () => {
    const result = resolveLendingBaseForRewrite(
      {
        NODE_ENV: 'production',
        LENDING_SERVICE_URL: 'https://lending.example.com/',
        PUBLIC_GATEWAY_URL: 'https://gateway.example.com',
      },
      false,
    );

    expect(result.base).toBe('https://lending.example.com');
    expect(result.errors).toHaveLength(0);
  });

  it('fails fast in production when lending base is missing', () => {
    const result = resolveLendingBaseForRewrite(
      {
        NODE_ENV: 'production',
        PUBLIC_GATEWAY_URL: 'https://gateway.example.com',
      },
      false,
    );

    expect(result.base).toBe('');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('remaps localhost:3006 to localhost:3007 in development', () => {
    const result = resolveLendingBaseForRewrite(
      {
        NODE_ENV: 'development',
        LENDING_SERVICE_URL: 'http://localhost:3006',
      },
      true,
    );

    expect(result.base).toBe('http://localhost:3007');
    expect(result.errors).toHaveLength(0);
  });

  it('does not fall back to PUBLIC_GATEWAY_URL for lending in production', () => {
    const result = resolveLendingBaseForRewrite(
      {
        NODE_ENV: 'production',
        PUBLIC_GATEWAY_URL: 'https://gateway.example.com',
      },
      false,
    );

    expect(result.base).toBe('');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('does not use legacy lending envs in production without LENDING_SERVICE_URL', () => {
    const result = resolveLendingBaseForRewrite(
      {
        NODE_ENV: 'production',
        VITE_LENDING_API_BASE: 'https://legacy-lending.example.com',
        NEXT_PUBLIC_LENDING_API_URL: 'https://public-legacy-lending.example.com',
      },
      false,
    );

    expect(result.base).toBe('');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.warnings.join(' ')).toContain('Ignoring VITE_LENDING_API_BASE');
  });
});
