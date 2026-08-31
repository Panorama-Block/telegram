import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const root = process.cwd();

const transactionUtilsSource =
  fs.readFileSync(
    path.join(
      root,
      "src/shared/utils/transactionUtilsV2.ts"
    ),
    "utf8"
  );

const lendingSource =
  fs.readFileSync(
    path.join(
      root,
      "src/features/lending/api.ts"
    ),
    "utf8"
  );

const yieldSource =
  fs.readFileSync(
    path.join(
      root,
      "src/features/yield/api.ts"
    ),
    "utf8"
  );

const swapSource =
  fs.readFileSync(
    path.join(
      root,
      "src/components/SwapWidget.tsx"
    ),
    "utf8"
  );

describe(
  "AVAX-11 auxiliary Avalanche approval boundary",
  () => {
    it(
      "provides a reusable guard against raw Avalanche approve submissions",
      () => {
        expect(transactionUtilsSource)
          .toContain(
            "assertNoRawAvalancheApproval"
          );

        expect(transactionUtilsSource)
          .toContain(
            "chainId === 43114"
          );

        expect(transactionUtilsSource)
          .toContain(
            "0x095ea7b3"
          );

        expect(transactionUtilsSource)
          .toContain(
            "Avalanche approval must be executed through an evidence-bound operation"
          );
      }
    );

    it(
      "blocks legacy lending from raw-signing an Avalanche approval",
      () => {
        expect(lendingSource)
          .toContain(
            "assertNoRawAvalancheApproval"
          );

        const targetChain =
          lendingSource.indexOf(
            "const targetChainId = Number("
          );

        const guard =
          lendingSource.indexOf(
            "assertNoRawAvalancheApproval(",
            targetChain
          );

        const rawSend =
          lendingSource.indexOf(
            "eth_sendTransaction",
            targetChain
          );

        expect(targetChain)
          .toBeGreaterThanOrEqual(0);

        expect(guard)
          .toBeGreaterThan(targetChain);

        expect(rawSend)
          .toBeGreaterThan(guard);
      }
    );

    it(
      "blocks generic yield execution from raw-signing an Avalanche approval",
      () => {
        expect(yieldSource)
          .toContain(
            "assertNoRawAvalancheApproval"
          );

        const executeStart =
          yieldSource.indexOf(
            "private async _doExecute"
          );

        const block =
          yieldSource.slice(executeStart);

        const guard =
          block.indexOf(
            "assertNoRawAvalancheApproval("
          );

        const rawSend =
          block.indexOf(
            "this.account.sendTransaction"
          );

        expect(guard)
          .toBeGreaterThanOrEqual(0);

        expect(rawSend)
          .toBeGreaterThan(guard);
      }
    );

    it(
      "precomputes Avalanche destination reset approvals before evidence commitment",
      () => {
        const start =
          swapSource.indexOf(
            "// AVAX-10 T1:"
          );

        expect(start)
          .toBeGreaterThanOrEqual(0);

        const block =
          swapSource.slice(start);

        const firstDestination =
          block.indexOf(
            "firstDestination"
          );

        const allowance =
          block.indexOf(
            "currentDestinationAllowance",
            firstDestination
          );

        const resetDescription =
          block.indexOf(
            "Reset Avalanche bridge destination allowance",
            firstDestination
          );

        const commit =
          block.indexOf(
            "commitAvaxBridgeDestinationEvidence",
            firstDestination
          );

        expect(firstDestination)
          .toBeGreaterThanOrEqual(0);

        expect(allowance)
          .toBeGreaterThan(firstDestination);

        expect(resetDescription)
          .toBeGreaterThan(allowance);

        expect(commit)
          .toBeGreaterThan(resetDescription);
      }
    );

    it(
      "does not duplicate a provider-prepared Avalanche reset approval",
      () => {
        const start =
          swapSource.indexOf(
            "// Some ERC-20s require allowance to be reset to zero"
          );

        expect(start)
          .toBeGreaterThanOrEqual(0);

        const block =
          swapSource.slice(
            start,
            swapSource.indexOf(
              "avaxDestinationSteps.push({",
              swapSource.indexOf(
                "description:",
                start
              ) + 1
            )
          );

        expect(block)
          .toContain(
            "const approvalAmount"
          );

        expect(block)
          .toContain(
            "approvalAmount > 0n"
          );

        expect(block)
          .toContain(
            "const hasPreparedReset"
          );

        expect(block)
          .toContain(
            "!hasPreparedReset"
          );

        expect(block)
          .toContain(
            "Malformed Avalanche bridge destination approval"
          );
      }
    );

    it(
      "never dynamically raw-signs an Avalanche reset approval",
      () => {
        const rawResetStart =
          swapSource.indexOf(
            "// Existing non-Avalanche reset behaviour is preserved."
          );

        expect(rawResetStart)
          .toBeGreaterThanOrEqual(0);

        const block =
          swapSource.slice(
            rawResetStart,
            swapSource.indexOf(
              "const txTo =",
              rawResetStart
            )
          );

        expect(block)
          .toContain(
            "txChainId !== 43114"
          );

        expect(block)
          .toContain(
            "sendAndConfirmThirdwebTransactionNonEvidence"
          );
      }
    );
  }
);
