import {
  vi,
} from "vitest";

vi.mock("thirdweb", () => ({
  defineChain: vi.fn((id: number) => ({ id })),
  prepareTransaction: vi.fn((input: unknown) => ({
    preparedTransaction: input,
  })),
  sendAndConfirmTransaction: vi.fn(),
}));

import {
  prepareTransaction,
  sendAndConfirmTransaction,
} from "thirdweb";

import {
  EvidencePostSubmissionError,
  executeEvidenceBoundOperation,
  type EvidenceBoundOperation,
} from "../evidenceBoundExecutor";

import {
  defineEvidenceExecutionComplianceSuite,
} from "./compliance/evidence-bound-execution.compliance";

function createOperation(): EvidenceBoundOperation {
  return {
    correlationId: "corr-compliance",
    evidenceEnabled: true,
    preparedPayloadHash: "0xprepared",
    steps: [
      {
        stepIndex: 0,
        to: "0x1111111111111111111111111111111111111111",
        data: "0x095ea7b3",
        value: "0",
        chainId: 43114,
        action: "approval",
        gas: 700000n,
      },
      {
        stepIndex: 1,
        to: "0x2222222222222222222222222222222222222222",
        data: "0xdeadbeef",
        value: "123456789",
        chainId: 43114,
        action: "state-change",
        gas: 700000n,
      },
    ],
  };
}

defineEvidenceExecutionComplianceSuite({
  name: "generic client executor",

  execute: executeEvidenceBoundOperation,

  createRequiredOperation: createOperation,

  prepareTransactionMock:
    vi.mocked(prepareTransaction) as any,

  sendTransactionMock:
    vi.mocked(sendAndConfirmTransaction) as any,

  evidencePostSubmissionError:
    EvidencePostSubmissionError,

  reset: () => {
    vi.clearAllMocks();
  },
});
