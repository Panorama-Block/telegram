import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectRuntimeDiagnostics } from './runtimeDiagnostics';

describe('runtime diagnostics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('requires verified administrator capability', async () => {
    await expect(
      collectRuntimeDiagnostics({
        walletAddress: '0x73fE164B67193e564b630B7925158EB0f9021303',
        verifiedAdmin: false,
      })
    ).rejects.toThrow('Verified administrator capability is required.');
  });


  it('collects authenticated redacted Zico runtime evidence without serializing the token', async () => {
    vi.stubEnv(
      'NEXT_PUBLIC_AGENTS_API_BASE',
      'https://colettogs-zico-agent.hf.space/'
    );

    localStorage.setItem(
      'authToken',
      'test-panorama-auth-token-that-must-never-be-serialized'
    );

    const zicoEvidence = {
      application: {
        name: 'Zico Agent API',
        version: '3.0',
      },
      panorama_gateway: {
        tenant: 'tenant-agent',
        service: 'zico-agent',
        roles: ['agent'],
        dedicated_jwt_secret: {
          present: true,
          empty: false,
          length: 47,
          redacted: true,
        },
        generic_jwt_secret: {
          present: false,
          empty: false,
          length: 0,
          redacted: true,
        },
        effective_auth_mode: 'dedicated-panorama-gateway-jwt',
      },
    };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response('', {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        })
      )
      .mockResolvedValueOnce(
        new Response('', {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(zicoEvidence), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const diagnostics = await collectRuntimeDiagnostics({
      walletAddress: '0x73fE164B67193e564b630B7925158EB0f9021303',
      verifiedAdmin: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [zicoUrl, zicoOptions] = fetchMock.mock.calls[2];

    expect(zicoUrl).toBe(
      'https://colettogs-zico-agent.hf.space/__runtime_evidence'
    );

    expect(zicoOptions).toEqual(
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        headers: {
          Authorization:
            'Bearer test-panorama-auth-token-that-must-never-be-serialized',
        },
      })
    );

    expect(diagnostics.probes.zicoRuntimeEvidence).toEqual(
      expect.objectContaining({
        reachable: true,
        status: 200,
        ok: true,
        evidence: zicoEvidence,
        error: null,
      })
    );

    const serialized = JSON.stringify(diagnostics);

    expect(serialized).not.toContain(
      'test-panorama-auth-token-that-must-never-be-serialized'
    );
    expect(serialized.toLowerCase()).not.toContain('authorization');
  });


  it('does not call Zico when the Panorama authentication token is unavailable', async () => {
    vi.stubEnv(
      'NEXT_PUBLIC_AGENTS_API_BASE',
      'https://colettogs-zico-agent.hf.space'
    );

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const diagnostics = await collectRuntimeDiagnostics({
      walletAddress: '0x73fE164B67193e564b630B7925158EB0f9021303',
      verifiedAdmin: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(diagnostics.probes.zicoRuntimeEvidence).toEqual(
      expect.objectContaining({
        reachable: false,
        status: null,
        ok: null,
        evidence: null,
        error: 'Panorama authentication token unavailable',
      })
    );
  });

  it('reports Zico 401 as an authentication failure without retaining the response body', async () => {
    vi.stubEnv(
      'NEXT_PUBLIC_AGENTS_API_BASE',
      'https://colettogs-zico-agent.hf.space'
    );
    localStorage.setItem('authToken', 'expired-test-token');

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ detail: 'Invalid authentication token.' }),
          {
            status: 401,
            headers: {
              'content-type': 'application/json',
              'www-authenticate': 'Bearer',
            },
          }
        )
      );

    vi.stubGlobal('fetch', fetchMock);

    const diagnostics = await collectRuntimeDiagnostics({
      walletAddress: '0x73fE164B67193e564b630B7925158EB0f9021303',
      verifiedAdmin: true,
    });

    expect(diagnostics.probes.zicoRuntimeEvidence).toEqual(
      expect.objectContaining({
        reachable: true,
        status: 401,
        ok: false,
        evidence: null,
        error: 'Zico runtime evidence authentication failed',
      })
    );

    const serialized = JSON.stringify(diagnostics);
    expect(serialized).not.toContain('expired-test-token');
    expect(serialized).not.toContain('Invalid authentication token.');
  });

  it('reports Zico 503 as authentication service unavailable without retaining the response body', async () => {
    vi.stubEnv(
      'NEXT_PUBLIC_AGENTS_API_BASE',
      'https://colettogs-zico-agent.hf.space'
    );
    localStorage.setItem('authToken', 'valid-looking-test-token');

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ detail: 'Authentication service unavailable.' }),
          {
            status: 503,
            headers: {
              'content-type': 'application/json',
            },
          }
        )
      );

    vi.stubGlobal('fetch', fetchMock);

    const diagnostics = await collectRuntimeDiagnostics({
      walletAddress: '0x73fE164B67193e564b630B7925158EB0f9021303',
      verifiedAdmin: true,
    });

    expect(diagnostics.probes.zicoRuntimeEvidence).toEqual(
      expect.objectContaining({
        reachable: true,
        status: 503,
        ok: false,
        evidence: null,
        error: 'Zico runtime evidence authentication service unavailable',
      })
    );
  });

  it('reports a Zico network failure without exposing authentication material', async () => {
    vi.stubEnv(
      'NEXT_PUBLIC_AGENTS_API_BASE',
      'https://colettogs-zico-agent.hf.space'
    );
    localStorage.setItem(
      'authToken',
      'network-test-token-that-must-not-be-serialized'
    );

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    vi.stubGlobal('fetch', fetchMock);

    const diagnostics = await collectRuntimeDiagnostics({
      walletAddress: '0x73fE164B67193e564b630B7925158EB0f9021303',
      verifiedAdmin: true,
    });

    expect(diagnostics.probes.zicoRuntimeEvidence).toEqual(
      expect.objectContaining({
        reachable: false,
        status: null,
        ok: null,
        evidence: null,
        error: 'TypeError',
      })
    );

    expect(JSON.stringify(diagnostics)).not.toContain(
      'network-test-token-that-must-not-be-serialized'
    );
  });

  it('collects only the explicitly defined diagnostic structure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response('', {
          status: 502,
          headers: {
            'content-type': 'text/plain',
            'x-vercel-id': 'test-vercel-id',
          },
        })
      )
      .mockResolvedValueOnce(
        new Response('', {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const diagnostics = await collectRuntimeDiagnostics({
      walletAddress: '0x73fE164B67193e564b630B7925158EB0f9021303',
      verifiedAdmin: true,
    });

    expect(diagnostics.schemaVersion).toBe('1.0');
    expect(diagnostics.type).toBe('panoramablock-runtime-diagnostics');

    expect(diagnostics.administrator).toEqual({
      verified: true,
      walletAddress: '0x73fe164b67193e564b630b7925158eb0f9021303',
    });

    expect(diagnostics.probes.deployedGatewayProxy.status).toBe(502);
    expect(diagnostics.probes.panoramaControlledGateway.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const serialized = JSON.stringify(diagnostics).toLowerCase();

    expect(serialized).not.toContain('privatekey');
    expect(serialized).not.toContain('private_key');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('authorization');
    expect(serialized).not.toContain('cookie');
    expect(serialized).not.toContain('db_gateway_token');
  });
});
