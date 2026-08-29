import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectRuntimeDiagnostics } from './runtimeDiagnostics';

describe('runtime diagnostics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requires verified administrator capability', async () => {
    await expect(
      collectRuntimeDiagnostics({
        walletAddress: '0x73fE164B67193e564b630B7925158EB0f9021303',
        verifiedAdmin: false,
      })
    ).rejects.toThrow('Verified administrator capability is required.');
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
