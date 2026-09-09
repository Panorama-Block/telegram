import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('@/features/admin/runtimeDiagnostics', () => ({
  probeZicoRuntimeEvidence: vi.fn(),
}));

import {
  probeZicoRuntimeEvidence,
} from '@/features/admin/runtimeDiagnostics';
import {
  collectHuggingFaceRuntimeEvidenceExport,
  downloadHuggingFaceRuntimeEvidenceExport,
} from './huggingFaceRuntimeEvidenceClient';

const mockedProbe =
  vi.mocked(probeZicoRuntimeEvidence);

describe('Hugging Face runtime evidence client', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(
      new Date('2026-09-09T20:15:30.000Z')
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('preserves the complete runtime evidence object unchanged', async () => {
    const evidence = {
      service: 'zico-agent',
      version: '2026.09.09',
      tenant: 'panorama',
      effective_auth_mode: 'dedicated',
      panorama_gateway: {
        tenant: 'panorama',
        service: 'zico',
        roles: ['agent'],
      },
      environment: {
        variables: [
          {
            name: 'HF_SPACE_ID',
            present: true,
            redacted: false,
            value: 'colettogs/zico-agent',
          },
          {
            name: 'JWT_SECRET',
            present: true,
            redacted: true,
            value: null,
          },
        ],
      },
      runtime: {
        python: '3.11',
        platform: 'linux',
      },
    };

    mockedProbe.mockResolvedValue({
      url:
        'https://colettogs-zico-agent.hf.space/' +
        '__runtime_evidence',
      reachable: true,
      status: 200,
      ok: true,
      latencyMs: 41,
      response: {
        contentType: 'application/json',
        server: 'uvicorn',
        vercelId: null,
      },
      evidence,
      error: null,
    });

    const result =
      await collectHuggingFaceRuntimeEvidenceExport();

    expect(result).toEqual({
      schemaVersion: '1.0',
      type:
        'panoramablock-hugging-face-runtime-evidence-export',
      generatedAt: '2026-09-09T20:15:30.000Z',
      source: {
        provider: 'hugging-face',
        endpoint:
          'https://colettogs-zico-agent.hf.space/' +
          '__runtime_evidence',
        reachable: true,
        status: 200,
        latencyMs: 41,
        response: {
          contentType: 'application/json',
          server: 'uvicorn',
          vercelId: null,
        },
      },
      evidence,
    });

    expect(result.evidence).toBe(evidence);
  });

  it('does not introduce authentication material into the export', async () => {
    const evidence = {
      service: 'zico-agent',
      environment: {
        variables: [
          {
            name: 'JWT_SECRET',
            redacted: true,
            value: null,
          },
        ],
      },
    };

    mockedProbe.mockResolvedValue({
      url:
        'https://colettogs-zico-agent.hf.space/' +
        '__runtime_evidence',
      reachable: true,
      status: 200,
      ok: true,
      latencyMs: 10,
      response: {
        contentType: 'application/json',
        server: null,
        vercelId: null,
      },
      evidence,
      error: null,
    });

    const result =
      await collectHuggingFaceRuntimeEvidenceExport();

    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('Authorization');
    expect(serialized).not.toContain('Bearer ');
    expect(serialized).not.toContain('authToken');
  });

  it('fails closed when the runtime evidence endpoint is not successful', async () => {
    mockedProbe.mockResolvedValue({
      url:
        'https://colettogs-zico-agent.hf.space/' +
        '__runtime_evidence',
      reachable: true,
      status: 401,
      ok: false,
      latencyMs: 15,
      response: {
        contentType: 'application/json',
        server: null,
        vercelId: null,
      },
      evidence: null,
      error:
        'Zico runtime evidence authentication failed',
    });

    await expect(
      collectHuggingFaceRuntimeEvidenceExport()
    ).rejects.toThrow(
      'Zico runtime evidence authentication failed'
    );
  });

  it('fails closed when a successful response contains no evidence object', async () => {
    mockedProbe.mockResolvedValue({
      url:
        'https://colettogs-zico-agent.hf.space/' +
        '__runtime_evidence',
      reachable: true,
      status: 200,
      ok: true,
      latencyMs: 12,
      response: {
        contentType: 'application/json',
        server: null,
        vercelId: null,
      },
      evidence: null,
      error: null,
    });

    await expect(
      collectHuggingFaceRuntimeEvidenceExport()
    ).rejects.toThrow(
      'Hugging Face runtime evidence is unavailable'
    );
  });

  it('creates a JSON download with the dedicated Hugging Face filename', () => {
    const runtimeEvidence = {
      schemaVersion: '1.0' as const,
      type:
        'panoramablock-hugging-face-runtime-evidence-export' as const,
      generatedAt: '2026-09-09T20:15:30.000Z',
      source: {
        provider: 'hugging-face' as const,
        endpoint:
          'https://colettogs-zico-agent.hf.space/' +
          '__runtime_evidence',
        reachable: true,
        status: 200,
        latencyMs: 9,
        response: {
          contentType: 'application/json',
          server: 'uvicorn',
          vercelId: null,
        },
      },
      evidence: {
        service: 'zico-agent',
      },
    };

    const createObjectURL = vi
      .fn()
      .mockReturnValue(
        'blob:panoramablock-hugging-face-evidence'
      );

    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const remove = vi.fn();

    const realCreateElement =
      document.createElement.bind(document);

    const link = realCreateElement('a');

    vi.spyOn(link, 'click').mockImplementation(click);
    vi.spyOn(link, 'remove').mockImplementation(remove);

    const createElement = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        if (tagName.toLowerCase() === 'a') {
          return link;
        }

        return realCreateElement(tagName);
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

    downloadHuggingFaceRuntimeEvidenceExport(
      runtimeEvidence
    );

    expect(createElement).toHaveBeenCalledWith('a');
    expect(appendChild).toHaveBeenCalledWith(link);

    expect(link.download).toBe(
      'panoramablock-hugging-face-runtime-evidence-' +
        '2026-09-09T20-15-30-000Z.json'
    );

    expect(link.href).toContain(
      'blob:panoramablock-hugging-face-evidence'
    );

    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);

    expect(revokeObjectURL).toHaveBeenCalledWith(
      'blob:panoramablock-hugging-face-evidence'
    );
  });
});
