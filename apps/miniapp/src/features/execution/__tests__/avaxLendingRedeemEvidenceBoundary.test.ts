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

const prepareWithdrawStart =
  lendingApiSource.indexOf(
    "async prepareWithdraw("
  );

const prepareBorrowStart =
  lendingApiSource.indexOf(
    "async prepareBorrow("
  );

const prepareWithdrawSource =
  lendingApiSource.slice(
    prepareWithdrawStart,
    prepareBorrowStart
  );

describe("Avalanche lending redeem evidence boundary", () => {
  it("sends the requested underlying amount to the execution layer", () => {
    expect(prepareWithdrawStart)
      .toBeGreaterThan(-1);

    expect(prepareWithdrawSource).toContain(
      "amount: amountInWei"
    );

    expect(prepareWithdrawSource).not.toContain(
      "qTokenAmountOverride"
    );

    expect(prepareWithdrawSource).not.toContain(
      "qTokenAmount,"
    );
  });

  it("keeps qToken conversion out of the client", () => {
    expect(lendingSource).not.toContain(
      "qTokenOverride"
    );

    expect(lendingSource).not.toContain(
      "((opWei * qTokenBal) / suppliedW)"
    );
  });

  it("routes supply/close through the generic evidence-bound executor before the legacy loop", () => {
    const evidenceBranch =
      lendingSource.indexOf(
        "if ((mode === 'supply' && (flow === 'open' || flow === 'close')) || (mode === 'borrow' && flow === 'open')) {"
      );

    const legacyLoop =
      lendingSource.indexOf(
        "let hasTimeout = false;"
      );

    expect(evidenceBranch)
      .toBeGreaterThan(-1);

    expect(legacyLoop)
      .toBeGreaterThan(evidenceBranch);

    const evidenceBlock =
      lendingSource.slice(
        evidenceBranch,
        legacyLoop
      );

    expect(evidenceBlock).toContain(
      "executeEvidenceBoundOperation"
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
});
