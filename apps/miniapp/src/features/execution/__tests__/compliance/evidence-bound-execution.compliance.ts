import {
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
} from "vitest";

interface ComplianceOperation {
  correlationId: string;
  evidenceEnabled: boolean;
  preparedPayloadHash: string;
  steps: Array<{
    stepIndex: number;
    to: string;
    data: string;
    value: string;
    chainId: number;
    action?: string;
    gas?: bigint;
  }>;
}

export interface EvidenceExecutionComplianceHarness {
  name: string;

  execute: (args: {
    operation: ComplianceOperation;
    account: any;
    client: any;
    switchChain: (chain: any) => Promise<unknown>;
    submitEvidence?: (...args: any[]) => Promise<unknown>;
    onConfirmed?: (...args: any[]) => void | Promise<void>;
  }) => Promise<any[]>;

  createRequiredOperation: () => ComplianceOperation;

  prepareTransactionMock: Mock;
  sendTransactionMock: Mock;

  evidencePostSubmissionError: new (...args: any[]) => Error;

  reset: () => void;
}

const HASH_0 =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const HASH_1 =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

export function defineEvidenceExecutionComplianceSuite(
  harness: EvidenceExecutionComplianceHarness
): void {
  describe(`${harness.name} evidence execution compliance`, () => {
    beforeEach(() => {
      harness.reset();
    });

    it("refuses a required-chain operation without committed evidence before signing", async () => {
      const operation = harness.createRequiredOperation();

      operation.evidenceEnabled = false;
      operation.correlationId = "";
      operation.preparedPayloadHash = "";

      await expect(
        harness.execute({
          operation,
          account: {},
          client: {},
          switchChain: async () => undefined,
        })
      ).rejects.toThrow(
        "Evidence is required before signing for chain(s): 43114."
      );

      expect(harness.prepareTransactionMock).not.toHaveBeenCalled();
      expect(harness.sendTransactionMock).not.toHaveBeenCalled();
    });

    it("refuses the entire mixed-chain operation before signing when a later step requires evidence", async () => {
      const operation = harness.createRequiredOperation();

      operation.evidenceEnabled = false;
      operation.correlationId = "";
      operation.preparedPayloadHash = "";

      operation.steps = [
        {
          ...operation.steps[0],
          stepIndex: 0,
          chainId: 8453,
          action: "observe-step",
        },
        {
          ...operation.steps[1],
          stepIndex: 1,
          chainId: 43114,
          action: "required-step",
        },
      ];

      await expect(
        harness.execute({
          operation,
          account: {},
          client: {},
          switchChain: async () => undefined,
        })
      ).rejects.toThrow(
        "Evidence is required before signing for chain(s): 43114."
      );

      expect(harness.prepareTransactionMock).not.toHaveBeenCalled();
      expect(harness.sendTransactionMock).not.toHaveBeenCalled();
    });

    it("refuses malformed evidence identity before signing", async () => {
      const operation = harness.createRequiredOperation();

      operation.correlationId = "";

      await expect(
        harness.execute({
          operation,
          account: {},
          client: {},
          switchChain: async () => undefined,
          submitEvidence: async () => undefined,
        })
      ).rejects.toThrow("missing correlationId");

      expect(harness.prepareTransactionMock).not.toHaveBeenCalled();
      expect(harness.sendTransactionMock).not.toHaveBeenCalled();
    });

    it("preserves transaction semantics and step ordering", async () => {
      harness.sendTransactionMock
        .mockResolvedValueOnce({
          transactionHash: HASH_0,
        })
        .mockResolvedValueOnce({
          transactionHash: HASH_1,
        });

      const operation = harness.createRequiredOperation();

      const results = await harness.execute({
        operation,
        account: {},
        client: {},
        switchChain: async () => undefined,
        submitEvidence: async () => ({ verified: true }),
      });

      expect(results.map((result) => result.stepIndex))
        .toEqual([0, 1]);

      expect(harness.prepareTransactionMock)
        .toHaveBeenCalledTimes(2);

      expect(
        harness.prepareTransactionMock.mock.calls[0][0]
      ).toEqual(
        expect.objectContaining({
          to: operation.steps[0].to,
          data: operation.steps[0].data,
          value: BigInt(operation.steps[0].value),
          gas: operation.steps[0].gas,
        })
      );

      expect(
        harness.prepareTransactionMock.mock.calls[1][0]
      ).toEqual(
        expect.objectContaining({
          to: operation.steps[1].to,
          data: operation.steps[1].data,
          value: BigInt(operation.steps[1].value),
          gas: operation.steps[1].gas,
        })
      );
    });

    it("reports each successful submission against its correlation and step", async () => {
      harness.sendTransactionMock
        .mockResolvedValueOnce({
          transactionHash: HASH_0,
        })
        .mockResolvedValueOnce({
          transactionHash: HASH_1,
        });

      const operation = harness.createRequiredOperation();

      const submissions: any[] = [];

      await harness.execute({
        operation,
        account: {},
        client: {},
        switchChain: async () => undefined,
        submitEvidence: async (...args) => {
          submissions.push(args);
          return { verified: true };
        },
      });

      expect(submissions).toHaveLength(2);

      expect(submissions[0][0])
        .toBe(operation.correlationId);

      expect(submissions[0][1]).toMatchObject({
        stepIndex: 0,
        txHash: HASH_0,
      });

      expect(submissions[1][0])
        .toBe(operation.correlationId);

      expect(submissions[1][1]).toMatchObject({
        stepIndex: 1,
        txHash: HASH_1,
      });
    });

    it("does not report evidence for a transaction that was not submitted", async () => {
      harness.sendTransactionMock.mockRejectedValue(
        new Error("wallet rejected")
      );

      let evidenceCalls = 0;

      await expect(
        harness.execute({
          operation: harness.createRequiredOperation(),
          account: {},
          client: {},
          switchChain: async () => undefined,
          submitEvidence: async () => {
            evidenceCalls += 1;
          },
        })
      ).rejects.toThrow("wallet rejected");

      expect(evidenceCalls).toBe(0);
    });

    it("preserves an already-submitted transaction hash when post-chain evidence reporting fails", async () => {
      harness.sendTransactionMock.mockResolvedValueOnce({
        transactionHash: HASH_0,
      });

      const events: string[] = [];
      let caught: unknown;

      try {
        await harness.execute({
          operation: harness.createRequiredOperation(),
          account: {},
          client: {},
          switchChain: async () => undefined,
          onConfirmed: async (result) => {
            events.push(`confirmed:${result.txHash}`);
          },
          submitEvidence: async () => {
            events.push("evidence");
            throw new Error("evidence unavailable");
          },
        });
      } catch (error) {
        caught = error;
      }

      expect(caught)
        .toBeInstanceOf(harness.evidencePostSubmissionError);

      expect(caught).toMatchObject({
        stepIndex: 0,
        txHash: HASH_0,
      });

      expect(events).toEqual([
        `confirmed:${HASH_0}`,
        "evidence",
      ]);
    });

    it("allows an observe-chain operation without evidence", async () => {
      const operation = harness.createRequiredOperation();

      operation.evidenceEnabled = false;
      operation.correlationId = "";
      operation.preparedPayloadHash = "";

      operation.steps = operation.steps.map((step) => ({
        ...step,
        chainId: 8453,
      }));

      harness.sendTransactionMock
        .mockResolvedValueOnce({
          transactionHash: HASH_0,
        })
        .mockResolvedValueOnce({
          transactionHash: HASH_1,
        });

      await expect(
        harness.execute({
          operation,
          account: {},
          client: {},
          switchChain: async () => undefined,
        })
      ).resolves.toHaveLength(2);
    });
  });
}
