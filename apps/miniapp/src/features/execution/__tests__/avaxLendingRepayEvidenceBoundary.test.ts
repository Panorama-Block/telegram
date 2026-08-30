import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const lendingPath = path.resolve(
  path.dirname(
    new URL(import.meta.url).pathname
  ),
  "../../../components/Lending.tsx"
);

const lendingApiPath = path.resolve(
  path.dirname(
    new URL(import.meta.url).pathname
  ),
  "../../lending/api.ts"
);

const lendingSource =
  fs.readFileSync(
    lendingPath,
    "utf8"
  );

const lendingApiSource =
  fs.readFileSync(
    lendingApiPath,
    "utf8"
  );

const prepareRepayStart =
  lendingApiSource.indexOf(
    "async prepareRepay("
  );

const submitEvidenceStart =
  lendingApiSource.indexOf(
    "async submitEvidence("
  );

const prepareRepaySource =
  lendingApiSource.slice(
    prepareRepayStart,
    submitEvidenceStart
  );

describe(
  "Avalanche lending repay evidence boundary",
  () => {
    it(
      "keeps repay expressed in underlying base units",
      () => {
        expect(
          prepareRepayStart
        ).toBeGreaterThan(-1);

        expect(
          prepareRepaySource
        ).toContain(
          "const amountInWei = this.toWei(amount, decimals)"
        );

        expect(
          prepareRepaySource
        ).toContain(
          "amount: amountInWei"
        );

        expect(
          prepareRepaySource
        ).toContain(
          "qTokenAddress: tokenAddress"
        );
      }
    );

    it(
      "routes borrow/close through the generic evidence executor",
      () => {
        const evidenceExecutor =
          lendingSource.indexOf(
            "await executeEvidenceBoundOperation({"
          );

        expect(
          evidenceExecutor
        ).toBeGreaterThan(-1);

        const evidenceClientGuard =
          lendingSource.lastIndexOf(
            "if (!evidenceClient)",
            evidenceExecutor
          );

        expect(
          evidenceClientGuard
        ).toBeGreaterThan(-1);

        const evidenceGuardStart =
          lendingSource.lastIndexOf(
            "if (",
            evidenceClientGuard - 1
          );

        expect(
          evidenceGuardStart
        ).toBeGreaterThan(-1);

        const evidenceGuard =
          lendingSource.slice(
            evidenceGuardStart,
            evidenceClientGuard
          );

        expect(
          evidenceGuard
        ).toContain(
          "mode === 'borrow' && (flow === 'open' || flow === 'close')"
        );

        const legacyLoop =
          lendingSource.indexOf(
            "let hasTimeout = false;",
            evidenceExecutor
          );

        expect(
          legacyLoop
        ).toBeGreaterThan(
          evidenceExecutor
        );

        const evidenceBlock =
          lendingSource.slice(
            evidenceClientGuard,
            legacyLoop
          );

        expect(
          evidenceBlock
        ).toContain(
          "prepared.correlationId"
        );

        expect(
          evidenceBlock
        ).toContain(
          "prepared.evidenceEnabled"
        );

        expect(
          evidenceBlock
        ).toContain(
          "prepared.preparedPayloadHash"
        );

        expect(
          evidenceBlock
        ).toContain(
          "lendingApi.submitEvidence"
        );

        expect(
          evidenceBlock
        ).toContain(
          "return;"
        );
      }
    );
  }
);
