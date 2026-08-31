import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  sendAndConfirmTransaction,
} = vi.hoisted(() => ({
  sendAndConfirmTransaction: vi.fn(),
}));

vi.mock("thirdweb", () => ({
  defineChain: vi.fn((id: number) => ({ id })),
  prepareTransaction: vi.fn((args) => args),
  sendAndConfirmTransaction,
}));

import {
  EvidencePostSubmissionError,
  executeEvidenceBoundOperation,
} from "../evidenceBoundExecutor";

const HASH_0 =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function operation() {
  return {
    correlationId: "corr-e8",
    evidenceEnabled: true,
    preparedPayloadHash: "0xprepared",
    steps: [
      {
        stepIndex: 0,
        to:
          "0x1111111111111111111111111111111111111111",
        data: "0x",
        value: "0",
        chainId: 43114,
        action: "approval",
      },
      {
        stepIndex: 1,
        to:
          "0x2222222222222222222222222222222222222222",
        data: "0x",
        value: "0",
        chainId: 43114,
        action: "execute",
      },
    ],
  };
}

describe(
  "evidence execution failure lifecycle",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(
      "reports cancelled-before-submission for explicit wallet rejection before the first hash",
      async () => {
        sendAndConfirmTransaction.mockRejectedValueOnce(
          new Error("User rejected the request")
        );

        const reportOutcome =
          vi.fn().mockResolvedValue({});

        await expect(
          executeEvidenceBoundOperation({
            operation: operation(),
            account: {},
            client: {},
            switchChain:
              vi.fn().mockResolvedValue(undefined),
            submitEvidence:
              vi.fn().mockResolvedValue({}),
            reportOutcome,
          })
        ).rejects.toThrow(
          "User rejected the request"
        );

        expect(reportOutcome).toHaveBeenCalledWith(
          "corr-e8",
          {
            outcome:
              "cancelled-before-submission",
            reason:
              "User rejected the request",
          }
        );
      }
    );

    it(
      "does not mislabel an arbitrary pre-submission failure as cancellation",
      async () => {
        sendAndConfirmTransaction.mockRejectedValueOnce(
          new Error("RPC unavailable")
        );

        const reportOutcome =
          vi.fn().mockResolvedValue({});

        await expect(
          executeEvidenceBoundOperation({
            operation: operation(),
            account: {},
            client: {},
            switchChain:
              vi.fn().mockResolvedValue(undefined),
            submitEvidence:
              vi.fn().mockResolvedValue({}),
            reportOutcome,
          })
        ).rejects.toThrow(
          "RPC unavailable"
        );

        expect(reportOutcome).not.toHaveBeenCalled();
      }
    );

    it(
      "does not mislabel a provider request rejection as user cancellation",
      async () => {
        sendAndConfirmTransaction.mockRejectedValueOnce(
          new Error(
            "RPC request rejected by upstream provider"
          )
        );

        const reportOutcome =
          vi.fn().mockResolvedValue({});

        await expect(
          executeEvidenceBoundOperation({
            operation: operation(),
            account: {},
            client: {},
            switchChain:
              vi.fn().mockResolvedValue(undefined),
            submitEvidence:
              vi.fn().mockResolvedValue({}),
            reportOutcome,
          })
        ).rejects.toThrow(
          "RPC request rejected by upstream provider"
        );

        expect(reportOutcome).not.toHaveBeenCalled();
      }
    );

    it(
      "reports partially-executed when a later step terminates after an earlier durable evidence submission",
      async () => {
        sendAndConfirmTransaction
          .mockResolvedValueOnce({
            transactionHash: HASH_0,
          })
          .mockRejectedValueOnce(
            new Error("User rejected the request")
          );

        const submitEvidence =
          vi.fn().mockResolvedValue({});

        const reportOutcome =
          vi.fn().mockResolvedValue({});

        await expect(
          executeEvidenceBoundOperation({
            operation: operation(),
            account: {},
            client: {},
            switchChain:
              vi.fn().mockResolvedValue(undefined),
            submitEvidence,
            reportOutcome,
          })
        ).rejects.toThrow(
          "User rejected the request"
        );

        expect(submitEvidence).toHaveBeenCalledTimes(1);

        expect(reportOutcome).toHaveBeenCalledWith(
          "corr-e8",
          {
            outcome:
              "partially-executed",
            reason:
              "User rejected the request",
          }
        );
      }
    );

    it(
      "does not report cancellation after a transaction hash has already been observed",
      async () => {
        sendAndConfirmTransaction
          .mockResolvedValueOnce({
            transactionHash: HASH_0,
          });

        const reportOutcome =
          vi.fn().mockResolvedValue({});

        await expect(
          executeEvidenceBoundOperation({
            operation: operation(),
            account: {},
            client: {},
            switchChain:
              vi.fn().mockResolvedValue(undefined),
            submitEvidence:
              vi.fn().mockRejectedValue(
                new Error(
                  "evidence API unavailable"
                )
              ),
            reportOutcome,
          })
        ).rejects.toBeInstanceOf(
          EvidencePostSubmissionError
        );

        expect(reportOutcome).not.toHaveBeenCalled();
      }
    );

    it(
      "preserves the original error if lifecycle reporting itself fails",
      async () => {
        sendAndConfirmTransaction.mockRejectedValueOnce(
          new Error("User rejected the request")
        );

        await expect(
          executeEvidenceBoundOperation({
            operation: operation(),
            account: {},
            client: {},
            switchChain:
              vi.fn().mockResolvedValue(undefined),
            submitEvidence:
              vi.fn().mockResolvedValue({}),
            reportOutcome:
              vi.fn().mockRejectedValue(
                new Error(
                  "outcome API unavailable"
                )
              ),
          })
        ).rejects.toThrow(
          "User rejected the request"
        );
      }
    );
  }
);
