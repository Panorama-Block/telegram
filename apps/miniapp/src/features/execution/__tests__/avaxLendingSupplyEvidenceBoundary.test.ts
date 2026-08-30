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

const lendingSource = fs.readFileSync(lendingPath, "utf8");
const lendingApiSource = fs.readFileSync(lendingApiPath, "utf8");

describe("Avalanche lending supply evidence boundary", () => {
  it("routes Benqi supply through the generic evidence-bound executor", () => {
    expect(lendingSource).toContain(
      'executeEvidenceBoundOperation'
    );

    expect(lendingSource).toContain(
      'prepared.correlationId'
    );

    expect(lendingSource).toContain(
      'prepared.evidenceEnabled'
    );

    expect(lendingSource).toContain(
      'prepared.preparedPayloadHash'
    );

    expect(lendingSource).toContain(
      'lendingApi.submitEvidence'
    );
  });

  it("keeps the evidence boundary scoped to migrated supply flows", () => {
    const evidenceBranch =
      lendingSource.indexOf(
        "if (mode === 'supply' && (flow === 'open' || flow === 'close')) {"
      );

    const genericLegacyExecution =
      lendingSource.indexOf(
        'executeTransactionWithStatus'
      );

    expect(evidenceBranch).toBeGreaterThan(-1);
    expect(genericLegacyExecution).toBeGreaterThan(-1);
    expect(genericLegacyExecution).toBeLessThan(evidenceBranch);
  });

  it("exposes a lending-specific evidence submission endpoint", () => {
    expect(lendingApiSource).toContain(
      'async submitEvidence('
    );

    expect(lendingApiSource).toContain(
      '/avax/lending/evidence/'
    );

    expect(lendingApiSource).toContain(
      '/submissions'
    );
  });
});
