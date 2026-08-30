import { describe, expect, it } from "vitest";

import {
  chainRequiresEvidence,
  getChainEvidencePolicy,
} from "../chainEvidencePolicy";

describe("chain evidence policy", () => {
  it("requires evidence for Avalanche C-Chain", () => {
    expect(getChainEvidencePolicy(43114)).toEqual({
      mode: "required",
    });
    expect(chainRequiresEvidence(43114)).toBe(true);
  });

  it("keeps Base in observe mode", () => {
    expect(getChainEvidencePolicy(8453)).toEqual({
      mode: "observe",
    });
    expect(chainRequiresEvidence(8453)).toBe(false);
  });

  it("keeps Ethereum in observe mode", () => {
    expect(getChainEvidencePolicy(1)).toEqual({
      mode: "observe",
    });
    expect(chainRequiresEvidence(1)).toBe(false);
  });

  it("defaults unknown chains to observe mode", () => {
    expect(getChainEvidencePolicy(999999)).toEqual({
      mode: "observe",
    });
    expect(chainRequiresEvidence(999999)).toBe(false);
  });
});
