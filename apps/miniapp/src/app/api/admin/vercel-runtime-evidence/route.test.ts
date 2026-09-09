import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const WALLET =
  '0x73fE164B67193e564b630B7925158EB0f9021303';

const SIGNATURE =
  '0xtest-signature-that-must-never-appear-in-export';

const TIMESTAMP = 1788984000000;

function request(body: unknown): NextRequest {
  return new NextRequest(
    'https://www.panoramablock.com/miniapp/api/admin/vercel-runtime-evidence',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
}

describe('Vercel runtime evidence route', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects invalid requests before contacting the administrator verification service', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      request({
        walletAddress: 'not-a-wallet',
        signature: SIGNATURE,
        timestamp: TIMESTAMP,
      })
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();

    const serialized = await response.text();

    expect(serialized).not.toContain(SIGNATURE);
    expect(serialized).not.toContain('environment');
  });

  it('does not export runtime evidence when administrator verification fails', async () => {
    vi.stubEnv(
      'YIELD_SERVICE_URL',
      'https://execution.example.test/'
    );

    vi.stubEnv(
      'NEXT_PUBLIC_GATEWAY_URL',
      'https://api.panoramablock.com'
    );

    vi.stubEnv(
      'DB_GATEWAY_TOKEN',
      'secret-that-must-never-be-exported'
    );

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ isAdmin: false }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }
      )
    );

    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      request({
        walletAddress: WALLET,
        signature: SIGNATURE,
        timestamp: TIMESTAMP,
      })
    );

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [verificationUrl, verificationOptions] =
      fetchMock.mock.calls[0];

    expect(String(verificationUrl)).toContain(
      '/avax/swap/evidence/admin/status/'
    );

    expect(String(verificationUrl)).toContain(
      encodeURIComponent(WALLET)
    );

    expect(String(verificationUrl)).toContain(
      `signature=${encodeURIComponent(SIGNATURE)}`
    );

    expect(String(verificationUrl)).toContain(
      `timestamp=${TIMESTAMP}`
    );

    expect(verificationOptions).toEqual(
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
      })
    );

    const serialized = await response.text();

    expect(serialized).not.toContain(SIGNATURE);
    expect(serialized).not.toContain(
      'secret-that-must-never-be-exported'
    );
    expect(serialized).not.toContain(
      'https://api.panoramablock.com'
    );
  });

  it('exports redacted runtime evidence only after successful administrator verification', async () => {
    vi.stubEnv(
      'YIELD_SERVICE_URL',
      'https://execution.example.test/'
    );

    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_REGION', 'fra1');

    vi.stubEnv(
      'NEXT_PUBLIC_GATEWAY_URL',
      'https://api.panoramablock.com'
    );

    vi.stubEnv(
      'DB_GATEWAY_TOKEN',
      'production-secret-that-must-never-be-exported'
    );

    vi.stubEnv(
      'AUTH_API_BASE',
      'https://auth.example.test'
    );

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ isAdmin: true }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }
      )
    );

    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      request({
        walletAddress: WALLET,
        signature: SIGNATURE,
        timestamp: TIMESTAMP,
      })
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(response.headers.get('cache-control')).toContain(
      'private'
    );
    expect(response.headers.get('cache-control')).toContain(
      'no-store'
    );

    const body = await response.json() as {
      schemaVersion: string;
      type: string;
      administrator: {
        verified: boolean;
        walletAddress: string;
      };
      evidence: {
        vercel: {
          detected: boolean;
          systemEnvironment: Record<
            string,
            {
              value: string | null;
              redacted: boolean;
            }
          >;
        };
        environment: {
          variables: Record<
            string,
            {
              value: string | null;
              redacted: boolean;
              classification: string;
              migration: string;
            }
          >;
        };
      };
    };

    expect(body.schemaVersion).toBe('1.0');
    expect(body.evidence.schemaVersion).toBe('1.1');
    expect(body.type).toBe(
      'panoramablock-vercel-runtime-evidence-export'
    );

    expect(body.administrator).toEqual({
      verified: true,
      walletAddress: WALLET.toLowerCase(),
    });

    expect(body.evidence.vercel.detected).toBe(true);

    expect(
      body.evidence.vercel.systemEnvironment.VERCEL_ENV.value
    ).toBe('production');

    expect(
      body.evidence.vercel.systemEnvironment.VERCEL_REGION.value
    ).toBe('fra1');

    expect(
      body.evidence.environment.variables
        .NEXT_PUBLIC_GATEWAY_URL.value
    ).toBe('https://api.panoramablock.com');

    expect(
      body.evidence.environment.variables.DB_GATEWAY_TOKEN
    ).toEqual(
      expect.objectContaining({
        value: null,
        redacted: true,
        classification: 'secret',
        migration: 'REQUIRES_SECRET_RECOVERY',
      })
    );

    expect(
      body.evidence.environment.variables.AUTH_API_BASE
    ).toEqual(
      expect.objectContaining({
        value: 'https://auth.example.test',
        redacted: false,
        classification: 'configuration',
        migration: 'REPLICABLE_FROM_EXPORT',
      })
    );

    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain(SIGNATURE);
    expect(serialized).not.toContain(
      'production-secret-that-must-never-be-exported'
    );
  });

  it('fails closed when the administrator verification service is unavailable', async () => {
    vi.stubEnv(
      'YIELD_SERVICE_URL',
      'https://execution.example.test'
    );

    const fetchMock = vi.fn().mockRejectedValue(
      new TypeError('network unavailable')
    );

    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      request({
        walletAddress: WALLET,
        signature: SIGNATURE,
        timestamp: TIMESTAMP,
      })
    );

    expect(response.status).toBe(503);

    const serialized = await response.text();

    expect(serialized).not.toContain(SIGNATURE);
    expect(serialized).not.toContain('network unavailable');
  });

  it('fails closed when no yield service is configured', async () => {
    vi.stubEnv('VITE_YIELD_API_URL', '');
    vi.stubEnv('NEXT_PUBLIC_YIELD_API_URL', '');
    vi.stubEnv('YIELD_SERVICE_URL', '');

    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      request({
        walletAddress: WALLET,
        signature: SIGNATURE,
        timestamp: TIMESTAMP,
      })
    );

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();

    const serialized = await response.text();

    expect(serialized).not.toContain(SIGNATURE);
  });
});
