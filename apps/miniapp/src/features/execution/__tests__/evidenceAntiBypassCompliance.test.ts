import { beforeEach, describe, expect, it, vi } from "vitest";

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
  executeEvidenceBoundOperation,
  type EvidenceBoundOperation,
} from "../evidenceBoundExecutor";

describe("evidence anti-bypass compliance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses the entire operation before signing when any step requires evidence", async () => {
    const operation: EvidenceBoundOperation = {
      correlationId: "",
      evidenceEnabled: false,
      preparedPayloadHash: "",
      steps: [
        {
          stepIndex: 0,
          to: "0x1111111111111111111111111111111111111111",
          data: "0xdeadbeef",
          value: "0",
          chainId: 8453,
          action: "observe-step",
        },
        {
          stepIndex: 1,
          to: "0x2222222222222222222222222222222222222222",
          data: "0xcafebabe",
          value: "0",
          chainId: 43114,
          action: "required-step",
        },
      ],
    };

    await expect(
      executeEvidenceBoundOperation({
        operation,
        account: {},
        client: {},
        switchChain: vi.fn(),
      })
    ).rejects.toThrow(
      "Evidence is required before signing for chain(s): 43114."
    );

    expect(prepareTransaction).not.toHaveBeenCalled();
    expect(sendAndConfirmTransaction).not.toHaveBeenCalled();
  });
});
