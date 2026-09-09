import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  collectVercelRuntimeEvidenceExport,
  downloadVercelRuntimeEvidenceExport,
} from './vercelRuntimeEvidenceClient';

const WALLET =
  '0x73fE164B67193e564b630B7925158EB0f9021303';

const SIGNATURE =
  '0xsignature-that-must-only-exist-in-the-post-body';

const FIXED_TIMESTAMP = 1788984000000;

describe('Vercel runtime evidence client', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_TIMESTAMP);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('signs the established PanoramaBlock administrator challenge', async () => {
    const signMessage = vi.fn().mockResolvedValue(SIGNATURE);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: '1.0',
          type: 'panoramablock-vercel-runtime-evidence-export',
          generatedAt: '2026-09-09T19:30:00.000Z',
          administrator: {
            verified: true,
            walletAddress: WALLET.toLowerCase(),
          },
          evidence: {},
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }
      )
    );

    vi.stubGlobal('fetch', fetchMock);

    await collectVercelRuntimeEvidenceExport({
      address: WALLET,
      signMessage,
    });

    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(signMessage).toHaveBeenCalledWith({
      message: `PanoramaBlock auth: ${FIXED_TIMESTAMP}`,
    });
  });

  it('posts the signed proof in the request body and never in the URL', async () => {
    const signMessage = vi.fn().mockResolvedValue(SIGNATURE);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: '1.0',
          type: 'panoramablock-vercel-runtime-evidence-export',
          generatedAt: '2026-09-09T19:30:00.000Z',
          administrator: {
            verified: true,
            walletAddress: WALLET.toLowerCase(),
          },
          evidence: {},
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }
      )
    );

    vi.stubGlobal('fetch', fetchMock);

    await collectVercelRuntimeEvidenceExport({
      address: WALLET,
      signMessage,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe(
      '/miniapp/api/admin/vercel-runtime-evidence'
    );

    expect(String(url)).not.toContain(SIGNATURE);
    expect(String(url)).not.toContain('signature=');

    expect(options).toEqual(
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
    );

    expect(JSON.parse(String(options.body))).toEqual({
      walletAddress: WALLET,
      signature: SIGNATURE,
      timestamp: FIXED_TIMESTAMP,
    });
  });

  it('returns only the server evidence response and does not add authentication material', async () => {
    const signMessage = vi.fn().mockResolvedValue(SIGNATURE);

    const serverEvidence = {
      schemaVersion: '1.0',
      type: 'panoramablock-vercel-runtime-evidence-export',
      generatedAt: '2026-09-09T19:30:00.000Z',
      administrator: {
        verified: true,
        walletAddress: WALLET.toLowerCase(),
      },
      evidence: {
        vercel: {
          detected: true,
        },
      },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify(serverEvidence),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          }
        )
      )
    );

    const result =
      await collectVercelRuntimeEvidenceExport({
        address: WALLET,
        signMessage,
      });

    expect(result).toEqual(serverEvidence);

    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(SIGNATURE);
    expect(serialized).not.toContain(
      `PanoramaBlock auth: ${FIXED_TIMESTAMP}`
    );
  });

  it('surfaces a server-provided error without exposing the signature', async () => {
    const signMessage = vi.fn().mockResolvedValue(SIGNATURE);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'Verified administrator capability is required',
          }),
          {
            status: 403,
            headers: {
              'content-type': 'application/json',
            },
          }
        )
      )
    );

    let capturedError: Error | null = null;

    try {
      await collectVercelRuntimeEvidenceExport({
        address: WALLET,
        signMessage,
      });
    } catch (error) {
      capturedError =
        error instanceof Error
          ? error
          : new Error(String(error));
    }

    expect(capturedError).not.toBeNull();
    expect(capturedError?.message).toBe(
      'Verified administrator capability is required'
    );
    expect(capturedError?.message).not.toContain(SIGNATURE);
  });

  it('creates a JSON download with the expected PanoramaBlock filename', () => {
    const evidence = {
      schemaVersion: '1.0' as const,
      type:
        'panoramablock-vercel-runtime-evidence-export' as const,
      generatedAt: '2026-09-09T19:30:00.000Z',
      administrator: {
        verified: true as const,
        walletAddress: WALLET.toLowerCase(),
      },
      evidence: {
        vercel: {
          detected: true,
        },
      },
    };

    const createObjectURL = vi
      .fn()
      .mockReturnValue('blob:panoramablock-vercel-evidence');

    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const remove = vi.fn();

    const link = document.createElement('a');

    vi.spyOn(link, 'click').mockImplementation(click);
    vi.spyOn(link, 'remove').mockImplementation(remove);

    const createElement = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        if (tagName.toLowerCase() === 'a') {
          return link;
        }

        return document.createElement(tagName);
      });

    const appendChild = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node);

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });

    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });

    downloadVercelRuntimeEvidenceExport(evidence);

    expect(createElement).toHaveBeenCalledWith('a');
    expect(appendChild).toHaveBeenCalledWith(link);

    expect(link.download).toBe(
      'panoramablock-vercel-runtime-evidence-' +
        '2026-09-09T19-30-00-000Z.json'
    );

    expect(link.href).toContain(
      'blob:panoramablock-vercel-evidence'
    );

    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);

    expect(revokeObjectURL).toHaveBeenCalledWith(
      'blob:panoramablock-vercel-evidence'
    );
  });
});
