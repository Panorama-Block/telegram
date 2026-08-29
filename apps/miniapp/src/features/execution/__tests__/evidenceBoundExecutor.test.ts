import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("thirdweb", () => ({
  defineChain: vi.fn((id: number) => ({ id })),
  prepareTransaction: vi.fn((input: unknown) => ({
    preparedTransaction: input,
  })),
  sendAndConfirmTransaction: vi.fn(),
}));

import {
  defineChain,
  prepareTransaction,
  sendAndConfirmTransaction,
} from "thirdweb";

import {
  EvidencePostSubmissionError,
  executeEvidenceBoundOperation,
  type EvidenceBoundOperation,
} from "../evidenceBoundExecutor";

const HASH_0 =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_1 =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const operation = (): EvidenceBoundOperation => ({
  correlationId: "corr-123",
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
      action: "swap",
      gas: 700000n,
    },
  ],
});

describe("executeEvidenceBoundOperation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses malformed evidence-required operation before signing", async () => {
    const invalid = operation();
    invalid.correlationId = "";

    await expect(
      executeEvidenceBoundOperation({
        operation: invalid,
        account: {},
        client: {},
        switchChain: vi.fn(),
        submitEvidence: vi.fn(),
      })
    ).rejects.toThrow("missing correlationId");

    expect(prepareTransaction).not.toHaveBeenCalled();
    expect(sendAndConfirmTransaction).not.toHaveBeenCalled();
  });

  it("preserves prepared transaction semantics and execution order", async () => {
    vi.mocked(sendAndConfirmTransaction)
      .mockResolvedValueOnce({ transactionHash: HASH_0 } as any)
      .mockResolvedValueOnce({ transactionHash: HASH_1 } as any);

    const switchChain = vi.fn().mockResolvedValue(undefined);
    const submitEvidence = vi.fn().mockResolvedValue({ verified: true });

    const result = await executeEvidenceBoundOperation({
      operation: operation(),
      account: { address: "0xabc" },
      client: { clientId: "test" },
      switchChain,
      submitEvidence,
    });

    expect(result).toEqual([
      {
        stepIndex: 0,
        txHash: HASH_0,
        chainId: 43114,
        action: "approval",
      },
      {
        stepIndex: 1,
        txHash: HASH_1,
        chainId: 43114,
        action: "swap",
      },
    ]);

    expect(switchChain).toHaveBeenCalledTimes(1);
    expect(defineChain).toHaveBeenCalledWith(43114);

    expect(prepareTransaction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: "0x1111111111111111111111111111111111111111",
        data: "0x095ea7b3",
        value: 0n,
        gas: 700000n,
      })
    );

    expect(prepareTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: "0x2222222222222222222222222222222222222222",
        data: "0xdeadbeef",
        value: 123456789n,
        gas: 700000n,
      })
    );

    expect(sendAndConfirmTransaction).toHaveBeenCalledTimes(2);
  });

  it("reports every successful submission against correlation and step", async () => {
    vi.mocked(sendAndConfirmTransaction)
      .mockResolvedValueOnce({ transactionHash: HASH_0 } as any)
      .mockResolvedValueOnce({ transactionHash: HASH_1 } as any);

    const submitEvidence = vi.fn().mockResolvedValue({ verified: true });

    await executeEvidenceBoundOperation({
      operation: operation(),
      account: {},
      client: {},
      switchChain: vi.fn().mockResolvedValue(undefined),
      submitEvidence,
    });

    expect(submitEvidence).toHaveBeenNthCalledWith(
      1,
      "corr-123",
      {
        stepIndex: 0,
        txHash: HASH_0,
        executionMechanism: "thirdweb-client",
        providerMetadata: {
          sdk: "thirdweb",
          flow: "sendAndConfirmTransaction",
          chainId: 43114,
        },
      }
    );

    expect(submitEvidence).toHaveBeenNthCalledWith(
      2,
      "corr-123",
      {
        stepIndex: 1,
        txHash: HASH_1,
        executionMechanism: "thirdweb-client",
        providerMetadata: {
          sdk: "thirdweb",
          flow: "sendAndConfirmTransaction",
          chainId: 43114,
        },
      }
    );
  });

  it("does not report evidence when wallet submission fails", async () => {
    vi.mocked(sendAndConfirmTransaction).mockRejectedValue(
      new Error("wallet rejected")
    );

    const submitEvidence = vi.fn();

    await expect(
      executeEvidenceBoundOperation({
        operation: operation(),
        account: {},
        client: {},
        switchChain: vi.fn().mockResolvedValue(undefined),
        submitEvidence,
      })
    ).rejects.toThrow("wallet rejected");

    expect(submitEvidence).not.toHaveBeenCalled();
  });

  it("surfaces confirmed tx before evidence reporting and preserves it on reporting failure", async () => {
    vi.mocked(sendAndConfirmTransaction).mockResolvedValueOnce({
      transactionHash: HASH_0,
    } as any);

    const events: string[] = [];

    const onConfirmed = vi.fn(async (result) => {
      events.push(`confirmed:${result.txHash}`);
    });

    const submitEvidence = vi.fn(async () => {
      events.push("evidence");
      throw new Error("evidence API unavailable");
    });

    await expect(
      executeEvidenceBoundOperation({
        operation: operation(),
        account: {},
        client: {},
        switchChain: vi.fn().mockResolvedValue(undefined),
        submitEvidence,
        onConfirmed,
      })
    ).rejects.toBeInstanceOf(EvidencePostSubmissionError);

    expect(onConfirmed).toHaveBeenCalledWith({
      stepIndex: 0,
      txHash: HASH_0,
      chainId: 43114,
      action: "approval",
    });

    expect(events).toEqual([
      `confirmed:${HASH_0}`,
      "evidence",
    ]);
  });

  it("preserves tx hash when evidence reporting fails after submission", async () => {
    vi.mocked(sendAndConfirmTransaction).mockResolvedValueOnce({
      transactionHash: HASH_0,
    } as any);

    const submitEvidence = vi
      .fn()
      .mockRejectedValue(new Error("evidence API unavailable"));

    let caught: unknown;

    try {
      await executeEvidenceBoundOperation({
        operation: operation(),
        account: {},
        client: {},
        switchChain: vi.fn().mockResolvedValue(undefined),
        submitEvidence,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EvidencePostSubmissionError);
    expect(caught).toMatchObject({
      correlationId: "corr-123",
      stepIndex: 0,
      txHash: HASH_0,
    });

    expect(sendAndConfirmTransaction).toHaveBeenCalledTimes(1);
  });

  it("allows evidence-disabled execution without an evidence reporter", async () => {
    const disabled = operation();
    disabled.evidenceEnabled = false;
    disabled.correlationId = "";
    disabled.preparedPayloadHash = "";

    vi.mocked(sendAndConfirmTransaction)
      .mockResolvedValueOnce({ transactionHash: HASH_0 } as any)
      .mockResolvedValueOnce({ transactionHash: HASH_1 } as any);

    await expect(
      executeEvidenceBoundOperation({
        operation: disabled,
        account: {},
        client: {},
        switchChain: vi.fn().mockResolvedValue(undefined),
      })
    ).resolves.toHaveLength(2);
  });
});
