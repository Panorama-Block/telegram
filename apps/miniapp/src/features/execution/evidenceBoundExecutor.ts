import {
  defineChain,
  prepareTransaction,
  sendAndConfirmTransaction,
} from "thirdweb";

import { chainRequiresEvidence } from "./chainEvidencePolicy";

export interface EvidenceBoundExecutionStep {
  stepIndex: number;
  to: string;
  data: string;
  value: string;
  chainId: number;
  action?: string;

  /**
   * Execution-only parameter.
   * This is deliberately not part of the prepared evidence commitment.
   */
  gas?: bigint;
}

export interface EvidenceBoundOperation {
  correlationId: string;
  evidenceEnabled: boolean;
  preparedPayloadHash: string;
  steps: EvidenceBoundExecutionStep[];
}

export interface EvidenceSubmission {
  stepIndex: number;
  txHash: string;
  executionMechanism: string;
  providerMetadata: Record<string, unknown>;
}

export interface EvidenceBoundExecutionResult {
  stepIndex: number;
  txHash: string;
  chainId: number;
  action?: string;
}

export type EvidenceSubmissionHandler = (
  correlationId: string,
  submission: EvidenceSubmission
) => Promise<unknown>;

export type ExecutionConfirmedHandler = (
  result: EvidenceBoundExecutionResult
) => void | Promise<void>;

export class EvidencePostSubmissionError extends Error {
  readonly correlationId: string;
  readonly stepIndex: number;
  readonly txHash: string;

  constructor(args: {
    correlationId: string;
    stepIndex: number;
    txHash: string;
    cause: unknown;
  }) {
    super(
      `Transaction ${args.txHash} was submitted, but evidence reporting failed for step ${args.stepIndex}.`
    );

    this.name = "EvidencePostSubmissionError";
    this.correlationId = args.correlationId;
    this.stepIndex = args.stepIndex;
    this.txHash = args.txHash;

    (this as Error & { cause?: unknown }).cause = args.cause;
  }
}

function assertGovernedOperation(
  operation: EvidenceBoundOperation,
  submitEvidence?: EvidenceSubmissionHandler
): void {
  const requiredChainIds = Array.from(
    new Set(
      operation.steps
        .filter((step) => chainRequiresEvidence(step.chainId))
        .map((step) => step.chainId)
    )
  );

  if (requiredChainIds.length > 0 && !operation.evidenceEnabled) {
    throw new Error(
      `Evidence is required before signing for chain(s): ${requiredChainIds.join(", ")}.`
    );
  }

  if (!operation.evidenceEnabled) {
    return;
  }

  if (!operation.correlationId?.trim()) {
    throw new Error(
      "Evidence-required operation is missing correlationId."
    );
  }

  if (!operation.preparedPayloadHash?.trim()) {
    throw new Error(
      "Evidence-required operation is missing preparedPayloadHash."
    );
  }

  if (!submitEvidence) {
    throw new Error(
      "Evidence-required operation is missing evidence submission handler."
    );
  }
}

export async function executeEvidenceBoundOperation(args: {
  operation: EvidenceBoundOperation;
  account: any;
  client: any;
  switchChain: (chain: ReturnType<typeof defineChain>) => Promise<unknown>;
  submitEvidence?: EvidenceSubmissionHandler;
  onConfirmed?: ExecutionConfirmedHandler;
}): Promise<EvidenceBoundExecutionResult[]> {
  const {
    operation,
    account,
    client,
    switchChain,
    submitEvidence,
    onConfirmed,
  } = args;

  assertGovernedOperation(operation, submitEvidence);

  const results: EvidenceBoundExecutionResult[] = [];
  let currentChainId: number | null = null;

  for (const step of operation.steps) {
    if (currentChainId !== step.chainId) {
      await switchChain(defineChain(step.chainId));
      currentChainId = step.chainId;
    }

    const transaction = prepareTransaction({
      client,
      chain: defineChain(step.chainId),
      to: step.to,
      data: (step.data || "0x") as `0x${string}`,
      value: BigInt(step.value || "0"),
      gas: step.gas,
    });

    const receipt = await sendAndConfirmTransaction({
      transaction,
      account,
    });

    const result: EvidenceBoundExecutionResult = {
      stepIndex: step.stepIndex,
      txHash: receipt.transactionHash,
      chainId: step.chainId,
      action: step.action,
    };

    results.push(result);

    // The transaction is already on-chain at this point. Record the hash
    // immediately before any subsequent evidence API call can fail.
    await onConfirmed?.(result);

    if (operation.evidenceEnabled) {
      try {
        await submitEvidence!(
          operation.correlationId,
          {
            stepIndex: step.stepIndex,
            txHash: receipt.transactionHash,
            executionMechanism: "thirdweb-client",
            providerMetadata: {
              sdk: "thirdweb",
              flow: "sendAndConfirmTransaction",
              chainId: step.chainId,
            },
          }
        );
      } catch (cause) {
        throw new EvidencePostSubmissionError({
          correlationId: operation.correlationId,
          stepIndex: step.stepIndex,
          txHash: receipt.transactionHash,
          cause,
        });
      }
    }
  }

  return results;
}
