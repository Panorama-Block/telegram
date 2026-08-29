import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function getAvalancheSwapExecutionBlock(): string {
  const source = readFileSync(
    resolve(process.cwd(), "src/components/SwapWidget.tsx"),
    "utf8"
  );

  const startMarker =
    "// Avalanche same-chain → Execution Layer (TraderJoe) via backend";
  const endMarker =
    "// Other EVM swaps → ThirdWeb SDK";

  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  if (start === -1 || end === -1) {
    throw new Error(
      "Could not locate Avalanche same-chain execution block in SwapWidget."
    );
  }

  return source.slice(start, end);
}

describe("Avalanche swap evidence-bound migration", () => {
  it("routes the Avalanche same-chain flow through the generic evidence executor", () => {
    const block = getAvalancheSwapExecutionBlock();

    expect(block).toContain("executeEvidenceBoundOperation({");
    expect(block).toContain("correlationId: avaxPrepare.correlationId");
    expect(block).toContain("evidenceEnabled: avaxPrepare.evidenceEnabled");
    expect(block).toContain(
      "preparedPayloadHash: avaxPrepare.preparedPayloadHash"
    );
    expect(block).toContain("submitAvaxSwapEvidence(");
  });

  it("does not directly prepare or submit wallet transactions inside the Avalanche block", () => {
    const block = getAvalancheSwapExecutionBlock();

    expect(block).not.toContain("sendAndConfirmTransaction(");
    expect(block).not.toContain("prepareTransaction({");
  });

  it("preserves the existing Avalanche execution gas override", () => {
    const block = getAvalancheSwapExecutionBlock();

    expect(block).toContain("gas: 700000n");
  });
});
