import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const lendingPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../components/Lending.tsx"
);

const lendingApiPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../lending/api.ts"
);

const lendingSource =
  fs.readFileSync(lendingPath, "utf8");

const lendingApiSource =
  fs.readFileSync(lendingApiPath, "utf8");

const prepareBorrowStart =
  lendingApiSource.indexOf(
    "async prepareBorrow("
  );

const prepareRepayStart =
  lendingApiSource.indexOf(
    "async prepareRepay("
  );

const prepareBorrowSource =
  lendingApiSource.slice(
    prepareBorrowStart,
    prepareRepayStart
  );

describe("Avalanche lending borrow evidence boundary", () => {
  it("keeps the borrow request expressed in underlying base units", () => {
    expect(prepareBorrowStart)
      .toBeGreaterThan(-1);

    expect(prepareBorrowSource).toContain(
      "const amountInWei = this.toWei(amount, decimals)"
    );

    expect(prepareBorrowSource).toContain(
      "amount: amountInWei"
    );

    expect(prepareBorrowSource).toContain(
      "qTokenAddress: tokenAddress"
    );
  });

  it("routes borrow/open through the generic evidence executor", () => {
    const evidenceExecutor =
      lendingSource.indexOf(
        "await executeEvidenceBoundOperation({"
      );

    expect(evidenceExecutor)
      .toBeGreaterThan(-1);

    const evidenceClientGuard =
      lendingSource.lastIndexOf(
        "if (!evidenceClient)",
        evidenceExecutor
      );

    expect(evidenceClientGuard)
      .toBeGreaterThan(-1);

    const evidenceGuardStart =
      lendingSource.lastIndexOf(
        "if (mode",
        evidenceClientGuard
      );

    expect(evidenceGuardStart)
      .toBeGreaterThan(-1);

    const evidenceGuard =
      lendingSource.slice(
        evidenceGuardStart,
        evidenceClientGuard
      );

    expect(evidenceGuard).toContain(
      "mode === 'borrow' && flow === 'open'"
    );

    const legacyLoop =
      lendingSource.indexOf(
        "let hasTimeout = false;",
        evidenceExecutor
      );

    expect(legacyLoop)
      .toBeGreaterThan(evidenceExecutor);

    const evidenceBlock =
      lendingSource.slice(
        evidenceClientGuard,
        legacyLoop
      );

    expect(evidenceBlock).toContain(
      "prepared.correlationId"
    );

    expect(evidenceBlock).toContain(
      "prepared.evidenceEnabled"
    );

    expect(evidenceBlock).toContain(
      "prepared.preparedPayloadHash"
    );

    expect(evidenceBlock).toContain(
      "lendingApi.submitEvidence"
    );

    expect(evidenceBlock).toContain(
      "return;"
    );
  });

  it("does not migrate repay as part of AVAX-4", () => {
    const evidenceExecutor =
      lendingSource.indexOf(
        "await executeEvidenceBoundOperation({"
      );

    const legacyLoop =
      lendingSource.indexOf(
        "let hasTimeout = false;"
      );

    const evidenceBlock =
      lendingSource.slice(
        evidenceExecutor,
        legacyLoop
      );

    expect(evidenceBlock).not.toContain(
      "mode === 'borrow' && flow === 'close'"
    );
  });
});
