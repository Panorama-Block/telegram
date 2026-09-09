import {
  probeZicoRuntimeEvidence,
} from '@/features/admin/runtimeDiagnostics';

export interface HuggingFaceRuntimeEvidenceExport {
  schemaVersion: '1.0';
  type: 'panoramablock-hugging-face-runtime-evidence-export';
  generatedAt: string;

  source: {
    provider: 'hugging-face';
    endpoint: string;
    reachable: boolean;
    status: number;
    latencyMs: number;
    response: {
      contentType: string | null;
      server: string | null;
      vercelId: string | null;
    } | null;
  };

  evidence: Record<string, unknown>;
}

export async function collectHuggingFaceRuntimeEvidenceExport():
Promise<HuggingFaceRuntimeEvidenceExport> {
  const probe = await probeZicoRuntimeEvidence();

  if (
    probe.ok !== true ||
    probe.status === null ||
    probe.evidence === null
  ) {
    throw new Error(
      probe.error ||
        'Hugging Face runtime evidence is unavailable'
    );
  }

  return {
    schemaVersion: '1.0',
    type: 'panoramablock-hugging-face-runtime-evidence-export',
    generatedAt: new Date().toISOString(),

    source: {
      provider: 'hugging-face',
      endpoint: probe.url,
      reachable: probe.reachable,
      status: probe.status,
      latencyMs: probe.latencyMs,
      response: probe.response,
    },

    evidence: probe.evidence,
  };
}

export function downloadHuggingFaceRuntimeEvidenceExport(
  runtimeEvidence: HuggingFaceRuntimeEvidenceExport
): void {
  const timestamp =
    runtimeEvidence.generatedAt.replace(/[:.]/g, '-');

  const filename =
    `panoramablock-hugging-face-runtime-evidence-${timestamp}.json`;

  const blob = new Blob(
    [JSON.stringify(runtimeEvidence, null, 2) + '\n'],
    { type: 'application/json' }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
