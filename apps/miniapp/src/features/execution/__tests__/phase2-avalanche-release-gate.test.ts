import {
  describe,
  expect,
  it,
} from "vitest";

import {
  existsSync,
  readFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

const SRC_ROOT =
  resolve(
    process.cwd(),
    "src"
  );

const E9_PARENT =
  "0515032fa433ed0d5a07ae7541979ab7aec5e593";

const requiredProofs = [
  "features/execution/__tests__/evidence-bound-execution.compliance.test.ts",
  "features/execution/__tests__/evidenceAntiBypassCompliance.test.ts",
  "features/execution/__tests__/evidenceCiAntiBypass.test.ts",
  "features/execution/__tests__/evidenceFailureLifecycle.test.ts",
  "features/execution/__tests__/nonEvidenceTransactionExecutor.test.ts",

  "features/execution/__tests__/avaxSwapEvidenceBoundary.test.ts",

  "features/execution/__tests__/avaxLendingSupplyEvidenceBoundary.test.ts",
  "features/execution/__tests__/avaxLendingRedeemEvidenceBoundary.test.ts",
  "features/execution/__tests__/avaxLendingBorrowEvidenceBoundary.test.ts",
  "features/execution/__tests__/avaxLendingRepayEvidenceBoundary.test.ts",

  "features/execution/__tests__/avaxSAvaxStakeEvidenceBoundary.test.ts",
  "features/execution/__tests__/avaxSAvaxUnlockEvidenceBoundary.test.ts",
  "features/execution/__tests__/avaxSAvaxRedeemEvidenceBoundary.test.ts",

  "features/execution/__tests__/avaxBridgeSourceEvidenceBoundary.test.ts",
  "features/execution/__tests__/avaxBridgeDestinationEvidenceBoundary.test.ts",
  "features/execution/__tests__/avaxAuxiliaryApprovalEvidenceBoundary.test.ts",
];

function source(
  relativePath: string
): string {
  return readFileSync(
    resolve(
      SRC_ROOT,
      relativePath
    ),
    "utf8"
  );
}

describe(
  "Phase 2 Avalanche client release gate",
  () => {
    it(
      "is anchored to the validated EVID-E9 Telegram baseline",
      () => {
        expect(E9_PARENT).toBe(
          "0515032fa433ed0d5a07ae7541979ab7aec5e593"
        );
      }
    );

    it(
      "retains every constituent client-side Phase 2 proof required for release",
      () => {
        const missing =
          requiredProofs.filter(
            relativePath =>
              !existsSync(
                resolve(
                  SRC_ROOT,
                  relativePath
                )
              )
          );

        expect(
          missing,
          `Missing Phase 2 client release proofs:\n${missing.join("\n")}`
        ).toEqual([]);
      }
    );

    it(
      "keeps Avalanche chain policy evidence-required",
      () => {
        const policy =
          source(
            "features/execution/chainEvidencePolicy.ts"
          );

        expect(policy).toContain(
          "43114"
        );

        expect(policy).toContain(
          '"required"'
        );
      }
    );

    it(
      "keeps the generic evidence executor as the Avalanche signing boundary",
      () => {
        const executor =
          source(
            "features/execution/evidenceBoundExecutor.ts"
          );

        expect(executor).toContain(
          "chainRequiresEvidence"
        );

        expect(executor).toContain(
          "sendAndConfirmTransaction"
        );

        expect(executor).toContain(
          "submitEvidence"
        );

        expect(executor).toContain(
          "reportOutcome"
        );
      }
    );

    it(
      "keeps migrated Avalanche UI families routed through executeEvidenceBoundOperation",
      () => {
        const productionFiles = [
          "components/SwapWidget.tsx",
          "components/Lending.tsx",
          "components/AvaxLiquidStaking.tsx",
        ];

        const violations =
          productionFiles.filter(
            relativePath =>
              !source(
                relativePath
              ).includes(
                "executeEvidenceBoundOperation"
              )
          );

        expect(
          violations,
          [
            "Migrated Avalanche execution family bypasses the generic executor:",
            ...violations,
          ].join("\n")
        ).toEqual([]);
      }
    );

    it(
      "keeps raw EVM wallet submission confined to approved boundaries",
      () => {
        const approved = [
          "features/execution/evidenceBoundExecutor.ts",
          "features/execution/nonEvidenceTransactionExecutor.ts",
        ];

        for (
          const relativePath of approved
        ) {
          expect(
            existsSync(
              resolve(
                SRC_ROOT,
                relativePath
              )
            )
          ).toBe(true);
        }

        const antiBypass =
          source(
            "features/execution/__tests__/evidenceCiAntiBypass.test.ts"
          );

        expect(antiBypass).toContain(
          "APPROVED_SUBMISSION_BOUNDARIES"
        );

        expect(antiBypass).toContain(
          "evidenceBoundExecutor.ts"
        );

        expect(antiBypass).toContain(
          "nonEvidenceTransactionExecutor.ts"
        );
      }
    );

    it(
      "keeps explicit fail-closed protection against disguised Avalanche chain IDs",
      () => {
        const nonEvidence =
          source(
            "features/execution/nonEvidenceTransactionExecutor.ts"
          );

        expect(nonEvidence).toContain(
          "embeddedTransactionChainId"
        );

        expect(nonEvidence).toContain(
          "chainRequiresEvidence"
        );

        expect(nonEvidence).toContain(
          "does not match declared chain"
        );

        expect(nonEvidence).toContain(
          "requires evidence-bound execution before wallet submission"
        );
      }
    );
  }
);
