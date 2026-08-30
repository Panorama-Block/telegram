import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const miniappRoot = process.cwd();

const swapWidgetSource =
  fs.readFileSync(
    path.join(
      miniappRoot,
      "src/components/SwapWidget.tsx"
    ),
    "utf8"
  );

const apiPath =
  path.join(
    miniappRoot,
    "src/features/swap/avaxBridgeEvidenceApi.ts"
  );

const apiSource =
  fs.readFileSync(apiPath, "utf8");

function executionSource(): string {
  const start =
    swapWidgetSource.indexOf("// Execution Logic");

  expect(start).toBeGreaterThanOrEqual(0);

  return swapWidgetSource.slice(start);
}

describe(
  "AVAX-10 Avalanche bridge destination evidence boundary",
  () => {
    it(
      "provides destination-side two-phase evidence API calls",
      () => {
        expect(apiSource)
          .toContain(
            "beginAvaxBridgeDestinationEvidence"
          );

        expect(apiSource)
          .toContain(
            "commitAvaxBridgeDestinationEvidence"
          );
      }
    );

    it(
      "creates destination evidence before Thirdweb preparation and commits before Avalanche signing",
      () => {
        const source = executionSource();

        const thirdwebStart =
          source.indexOf(
            "// Other EVM swaps → ThirdWeb SDK"
          );

        expect(thirdwebStart)
          .toBeGreaterThanOrEqual(0);

        const block =
          source.slice(thirdwebStart);

        const beginIndex =
          block.indexOf(
            "beginAvaxBridgeDestinationEvidence"
          );

        const prepareIndex =
          block.indexOf("Bridge.Sell.prepare");

        const commitIndex =
          block.indexOf(
            "commitAvaxBridgeDestinationEvidence"
          );

        const executeIndex =
          block.indexOf(
            "executeEvidenceBoundOperation"
          );

        expect(beginIndex)
          .toBeGreaterThanOrEqual(0);

        expect(prepareIndex)
          .toBeGreaterThan(beginIndex);

        expect(commitIndex)
          .toBeGreaterThan(prepareIndex);

        expect(executeIndex)
          .toBeGreaterThan(commitIndex);

        expect(block)
          .toContain("toChainId === 43114");

        expect(block)
          .toContain("fromChainId !== 43114");
      }
    );

    it(
      "skips raw Thirdweb signing for Avalanche destination transactions",
      () => {
        const source = executionSource();

        const thirdwebStart =
          source.indexOf(
            "// Other EVM swaps → ThirdWeb SDK"
          );

        expect(thirdwebStart)
          .toBeGreaterThanOrEqual(0);

        const block =
          source.slice(thirdwebStart);

        expect(block)
          .toContain(
            "toChainId === 43114"
          );

        expect(block)
          .toContain(
            "txChainId === 43114"
          );

        const destinationSkip =
          block.indexOf(
            "toChainId === 43114"
          );

        const rawSend =
          block.lastIndexOf(
            "sendAndConfirmTransaction"
          );

        expect(destinationSkip)
          .toBeGreaterThanOrEqual(0);

        expect(rawSend)
          .toBeGreaterThan(destinationSkip);

        const rawExecutionBlock =
          block.slice(
            destinationSkip,
            rawSend + 64
          );

        expect(rawExecutionBlock)
          .toContain(
            "executeEvidenceBoundOperation"
          );

        expect(rawExecutionBlock)
          .toMatch(
            /toChainId === 43114[\s\S]*txChainId === 43114[\s\S]*continue;/
          );
      }
    );

    it(
      "fails closed rather than reordering interleaved Avalanche destination transactions",
      () => {
        const source = executionSource();

        const thirdwebStart =
          source.indexOf(
            "// Other EVM swaps → ThirdWeb SDK"
          );

        const block =
          source.slice(thirdwebStart);

        expect(block)
          .toContain(
            "slice(firstDestination)"
          );

        expect(block)
          .toContain(
            "item.chainId !== 43114"
          );

        expect(block)
          .toContain(
            "Thirdweb returned interleaved Avalanche destination transactions; refusing to reorder bridge execution"
          );
      }
    );

    it(
      "executes the committed Avalanche destination suffix after the raw source prefix",
      () => {
        const source = executionSource();

        const thirdwebStart =
          source.indexOf(
            "// Other EVM swaps → ThirdWeb SDK"
          );

        const block =
          source.slice(thirdwebStart);

        const rawLoop =
          block.indexOf(
            "for (const step of prepared.steps)"
          );

        const destinationVerification =
          block.indexOf(
            "Avalanche bridge destination evidence verification failed"
          );

        const destinationExecute =
          block.lastIndexOf(
            "executeEvidenceBoundOperation",
            destinationVerification
          );

        expect(rawLoop)
          .toBeGreaterThanOrEqual(0);

        expect(destinationVerification)
          .toBeGreaterThan(rawLoop);

        expect(destinationExecute)
          .toBeGreaterThan(rawLoop);

        expect(destinationExecute)
          .toBeLessThan(destinationVerification);
      }
    );

    it(
      "keeps TON destination settlement provider-driven rather than signing Avalanche destination transactions",
      () => {
        const tonStart =
          swapWidgetSource.indexOf(
            "// --- TON SWAP FLOW ---"
          );

        const executionStart =
          swapWidgetSource.indexOf(
            "// Execution Logic"
          );

        const evmStart =
          swapWidgetSource.indexOf(
            "// --- EVM SWAP FLOW",
            tonStart
          );

        expect(executionStart)
          .toBeGreaterThanOrEqual(0);

        expect(tonStart)
          .toBeGreaterThan(executionStart);

        expect(evmStart)
          .toBeGreaterThan(tonStart);

        const tonBlock =
          swapWidgetSource.slice(
            tonStart,
            evmStart
          );

        expect(tonBlock)
          .toContain(
            "bridgeApi.createTransaction"
          );

        expect(tonBlock)
          .not.toContain(
            "beginAvaxBridgeDestinationEvidence"
          );

        expect(tonBlock)
          .not.toContain(
            "commitAvaxBridgeDestinationEvidence"
          );

        expect(tonBlock)
          .not.toContain(
            "executeEvidenceBoundOperation"
          );
      }
    );
  }
);
