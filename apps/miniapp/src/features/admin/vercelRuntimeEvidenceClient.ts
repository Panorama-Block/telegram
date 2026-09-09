export interface VercelRuntimeEvidenceAccount {
  address: string;
  signMessage: (args: { message: string }) => Promise<string>;
}

export interface VercelRuntimeEvidenceExport {
  schemaVersion: '1.0';
  type: 'panoramablock-vercel-runtime-evidence-export';
  generatedAt: string;
  administrator: {
    verified: true;
    walletAddress: string;
  };
  evidence: unknown;
}

const VERCEL_RUNTIME_EVIDENCE_ENDPOINT =
  '/miniapp/api/admin/vercel-runtime-evidence';

export async function collectVercelRuntimeEvidenceExport(
  account: VercelRuntimeEvidenceAccount
): Promise<VercelRuntimeEvidenceExport> {
  const timestamp = Date.now();
  const message = `PanoramaBlock auth: ${timestamp}`;
  const signature = await account.signMessage({ message });

  const response = await fetch(
    VERCEL_RUNTIME_EVIDENCE_ENDPOINT,
    {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: account.address,
        signature,
        timestamp,
      }),
    }
  );

  if (!response.ok) {
    let errorMessage =
      `Vercel runtime evidence export failed (${response.status})`;

    try {
      const body = await response.json() as {
        error?: unknown;
      };

      if (
        typeof body.error === 'string' &&
        body.error.length > 0
      ) {
        errorMessage = body.error;
      }
    } catch {
    }

    throw new Error(errorMessage);
  }

  return await response.json() as VercelRuntimeEvidenceExport;
}

export function downloadVercelRuntimeEvidenceExport(
  evidence: VercelRuntimeEvidenceExport
): void {
  const timestamp = evidence.generatedAt.replace(/[:.]/g, '-');

  const filename =
    `panoramablock-vercel-runtime-evidence-${timestamp}.json`;

  const blob = new Blob(
    [JSON.stringify(evidence, null, 2) + '\n'],
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
