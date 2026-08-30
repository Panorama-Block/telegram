export interface AvaxBridgeEvidenceIntentParams {
  userAddress: string;
  destinationChainId: number;
  sourceToken: string;
  destinationToken?: string;
  amountRaw: string;
}

export interface AvaxBridgeEvidenceIntent {
  correlationId: string;
  evidenceVersion: string;
  evidenceEnabled: boolean;
}

export interface AvaxBridgeEvidenceStep {
  to: string;
  data: string;
  value: string;
  chainId: number;
  description?: string;
}

export interface AvaxBridgeEvidenceCommitParams {
  correlationId: string;
  destinationChainId: number;
  provider: string;
  steps: AvaxBridgeEvidenceStep[];
}

export interface AvaxBridgeEvidenceCommitResult {
  correlationId: string;
  evidenceVersion: string;
  evidenceEnabled: boolean;
  preparedPayloadHash: string;
}

export async function beginAvaxBridgeEvidence(
  params: AvaxBridgeEvidenceIntentParams
): Promise<AvaxBridgeEvidenceIntent> {
  const res = await fetch(
    "/api/yield/avax/swap/bridge/evidence/intent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `avax bridge evidence intent failed (${res.status}): ${body}`
    );
  }

  return res.json() as Promise<AvaxBridgeEvidenceIntent>;
}

export async function commitAvaxBridgeEvidence(
  params: AvaxBridgeEvidenceCommitParams
): Promise<AvaxBridgeEvidenceCommitResult> {
  const res = await fetch(
    `/api/yield/avax/swap/bridge/evidence/${encodeURIComponent(
      params.correlationId
    )}/prepare`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        destinationChainId: params.destinationChainId,
        provider: params.provider,
        steps: params.steps,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `avax bridge evidence prepare failed (${res.status}): ${body}`
    );
  }

  return res.json() as Promise<AvaxBridgeEvidenceCommitResult>;
}

export interface AvaxBridgeDestinationEvidenceIntentParams {
  userAddress: string;
  sourceChainId: number;
  destinationToken: string;
  amountRaw: string;
}

export interface AvaxBridgeDestinationEvidenceCommitParams {
  correlationId: string;
  sourceChainId: number;
  provider: string;
  steps: AvaxBridgeEvidenceStep[];
}

export async function beginAvaxBridgeDestinationEvidence(
  params: AvaxBridgeDestinationEvidenceIntentParams
): Promise<AvaxBridgeEvidenceIntent> {
  const res = await fetch(
    "/api/yield/avax/swap/bridge/destination/evidence/intent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    }
  );

  if (!res.ok) {
    const body = await res.text();

    throw new Error(
      `avax bridge destination evidence intent failed (${res.status}): ${body}`
    );
  }

  return res.json() as Promise<AvaxBridgeEvidenceIntent>;
}

export async function commitAvaxBridgeDestinationEvidence(
  params: AvaxBridgeDestinationEvidenceCommitParams
): Promise<AvaxBridgeEvidenceCommitResult> {
  const res = await fetch(
    `/api/yield/avax/swap/bridge/destination/evidence/${encodeURIComponent(
      params.correlationId
    )}/prepare`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceChainId: params.sourceChainId,
        provider: params.provider,
        steps: params.steps,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();

    throw new Error(
      `avax bridge destination evidence prepare failed (${res.status}): ${body}`
    );
  }

  return res.json() as Promise<AvaxBridgeEvidenceCommitResult>;
}
