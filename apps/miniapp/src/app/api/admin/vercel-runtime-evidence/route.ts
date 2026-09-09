import { NextRequest, NextResponse } from 'next/server';
import { collectVercelRuntimeEvidence } from '@/features/admin/vercelRuntimeEvidence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AdminProofRequest {
  walletAddress?: unknown;
  signature?: unknown;
  timestamp?: unknown;
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

function json(
  body: Record<string, unknown>,
  status: number
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function configuredYieldBase(): string | null {
  const raw =
    process.env.VITE_YIELD_API_URL ||
    process.env.NEXT_PUBLIC_YIELD_API_URL ||
    process.env.YIELD_SERVICE_URL ||
    '';

  const trimmed = raw.trim().replace(/\/+$/, '');

  return trimmed.length > 0 ? trimmed : null;
}

function validWalletAddress(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^0x[a-fA-F0-9]{40}$/.test(value)
  );
}

function validSignature(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 2048
  );
}

function validTimestamp(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

export async function POST(request: NextRequest) {
  let body: AdminProofRequest;

  try {
    body = await request.json() as AdminProofRequest;
  } catch {
    return json(
      { error: 'Invalid JSON body' },
      400
    );
  }

  const walletAddress = body.walletAddress;
  const signature = body.signature;
  const timestamp = body.timestamp;

  if (!validWalletAddress(walletAddress)) {
    return json(
      { error: 'Invalid wallet address' },
      400
    );
  }

  if (!validSignature(signature)) {
    return json(
      { error: 'Invalid signature' },
      400
    );
  }

  if (!validTimestamp(timestamp)) {
    return json(
      { error: 'Invalid timestamp' },
      400
    );
  }

  const yieldBase = configuredYieldBase();

  if (!yieldBase) {
    return json(
      {
        error:
          'Yield service is not configured for administrator verification',
      },
      503
    );
  }

  const params = new URLSearchParams({
    signature,
    timestamp: String(timestamp),
  });

  const verificationUrl =
    `${yieldBase}/avax/swap/evidence/admin/status/` +
    `${encodeURIComponent(walletAddress)}?${params.toString()}`;

  let verificationResponse: Response;

  try {
    verificationResponse = await fetch(verificationUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    return json(
      {
        error:
          'Administrator verification service is unavailable',
      },
      503
    );
  }

  if (!verificationResponse.ok) {
    return json(
      {
        error: 'Administrator verification failed',
        verificationStatus: verificationResponse.status,
      },
      403
    );
  }

  let verification: unknown;

  try {
    verification = await verificationResponse.json();
  } catch {
    return json(
      {
        error:
          'Administrator verification returned an invalid response',
      },
      502
    );
  }

  const isAdmin =
    verification !== null &&
    typeof verification === 'object' &&
    !Array.isArray(verification) &&
    (verification as { isAdmin?: unknown }).isAdmin === true;

  if (!isAdmin) {
    return json(
      { error: 'Verified administrator capability is required' },
      403
    );
  }

  const evidence = collectVercelRuntimeEvidence();

  return NextResponse.json(
    {
      schemaVersion: '1.0',
      type: 'panoramablock-vercel-runtime-evidence-export',
      generatedAt: new Date().toISOString(),
      administrator: {
        verified: true,
        walletAddress: walletAddress.toLowerCase(),
      },
      evidence,
    },
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    }
  );
}
