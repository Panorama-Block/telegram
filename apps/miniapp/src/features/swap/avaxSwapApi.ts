// API client para swap same-chain na Avalanche via Execution Layer (TraderJoe)

const WAVAX = '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7';

// O frontend normaliza AVAX nativo para 0xeeee... — o backend espera WAVAX
function toBackendToken(addr: string): string {
  const a = addr.toLowerCase();
  if (a === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || a === '0x0000000000000000000000000000000000000000') {
    return WAVAX;
  }
  return a;
}

export interface AvaxSwapPrepareParams {
  userAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string; // wei string
  slippageBps?: number;
}

export async function prepareAvaxSwap(params: AvaxSwapPrepareParams) {
  const res = await fetch('/api/yield/avax/swap/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: params.userAddress,
      tokenIn: toBackendToken(params.tokenIn),
      tokenOut: toBackendToken(params.tokenOut),
      amountIn: params.amountIn,
      slippageBps: params.slippageBps ?? 50,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`avax-swap prepare failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<{
    correlationId: string;
    evidenceVersion: string;
    evidenceEnabled: boolean;
    preparedPayloadHash: string;
    bundle: {
      steps: Array<{
        to: string;
        data: string;
        value: string;
        chainId: number;
        description?: string;
      }>;
      totalSteps: number;
      summary: string;
    };
    metadata: {
      amountOut: string;
      amountOutMin: string;
      swapType: string;
    };
  }>;
}

export interface AvaxEvidenceSubmission {
  stepIndex: number;
  txHash: string;
  executionMechanism?: string;
  providerMetadata?: Record<string, unknown>;
}

export interface AvaxEvidenceVerification {
  correlationId: string;
  stepIndex: number;
  txHash: string;
  verified: boolean;
  receiptStatus: number | null;
  blockNumber: string;
  blockHash: string;
  senderMatchesExpected: boolean;
  destinationMatchesExpected: boolean;
  chainMatchesExpected: boolean;
  dataMatchesExpected: boolean;
  valueMatchesExpected: boolean;
}

export async function submitAvaxSwapEvidence(
  correlationId: string,
  submission: AvaxEvidenceSubmission
): Promise<AvaxEvidenceVerification> {
  const res = await fetch(
    `/api/yield/avax/swap/evidence/${encodeURIComponent(correlationId)}/submissions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `avax-swap evidence verification failed (${res.status}): ${body}`
    );
  }

  return res.json() as Promise<AvaxEvidenceVerification>;
}

export async function downloadAvaxEvidenceExport(account: {
  address: string;
  signMessage: (args: { message: string }) => Promise<string>;
}) {
  const timestamp = Date.now();
  const message = `PanoramaBlock auth: ${timestamp}`;
  const signature = await account.signMessage({ message });

  const params = new URLSearchParams({
    signature,
    timestamp: String(timestamp),
  });

  const res = await fetch(
    `/api/yield/avax/swap/evidence/export/${encodeURIComponent(account.address)}?${params.toString()}`
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`avax evidence export failed (${res.status}): ${body}`);
  }

  return res;
}

export async function downloadAvaxAdminEvidenceExport(account: {
  address: string;
  signMessage: (args: { message: string }) => Promise<string>;
}) {
  const timestamp = Date.now();
  const message = `PanoramaBlock auth: ${timestamp}`;
  const signature = await account.signMessage({ message });

  const params = new URLSearchParams({
    signature,
    timestamp: String(timestamp),
  });

  const res = await fetch(
    `/api/yield/avax/swap/evidence/admin/export/${encodeURIComponent(account.address)}?${params.toString()}`
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`avax admin evidence export failed (${res.status}): ${body}`);
  }

  return res;
}
