import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const miniappRoot = process.cwd();

const swapWidgetSource = fs.readFileSync(
  path.join(
    miniappRoot,
    "src/components/SwapWidget.tsx"
  ),
  "utf8"
);

const bridgeEvidenceApiPath = path.join(
  miniappRoot,
  "src/features/swap/avaxBridgeEvidenceApi.ts"
);

function between(
  source: string,
  startMarker: string,
  endMarker: string
): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  expect(
    start,
    `missing start marker: ${startMarker}`
  ).toBeGreaterThanOrEqual(0);

  expect(
    end,
    `missing end marker: ${endMarker}`
  ).toBeGreaterThan(start);

  return source.slice(start, end);
}

describe(
  "AVAX-9 Avalanche bridge source evidence boundary",
  () => {
    it(
      "provides a two-phase client API for bridge intent and prepared bundle commitment",
      () => {
        expect(
          fs.existsSync(bridgeEvidenceApiPath)
        ).toBe(true);

        if (!fs.existsSync(bridgeEvidenceApiPath)) {
          return;
        }

        const apiSource =
          fs.readFileSync(bridgeEvidenceApiPath, "utf8");

        expect(apiSource)
          .toContain("beginAvaxBridgeEvidence");

        expect(apiSource)
          .toContain("commitAvaxBridgeEvidence");

        expect(apiSource)
          .toContain("/api/yield/avax/swap/bridge/evidence/intent");

        expect(apiSource)
          .toContain("/bridge/evidence/");

        expect(apiSource)
          .toContain("/prepare");
      }
    );

    it(
      "evidence-binds Avalanche to TON before the LayerSwap deposit transaction is signed",
      () => {
        const block = between(
          swapWidgetSource,
          "if (buyToken.network === 'TON') {",
          "// Standard EVM Swap - SDK with approval FIRST"
        );

        expect(block)
          .toContain("fromChainId === 43114");

        expect(block)
          .toContain("beginAvaxBridgeEvidence");

        expect(block)
          .toContain("commitAvaxBridgeEvidence");

        expect(block)
          .toContain("executeEvidenceBoundOperation");

        expect(block)
          .toContain("provider: 'layerswap'");

        const beginIndex =
          block.indexOf("beginAvaxBridgeEvidence");
        const prepareIndex =
          block.indexOf("bridgeApi.createTransaction");
        const commitIndex =
          block.indexOf("commitAvaxBridgeEvidence");
        const executeIndex =
          block.indexOf("executeEvidenceBoundOperation");

        expect(beginIndex).toBeGreaterThanOrEqual(0);
        expect(prepareIndex).toBeGreaterThan(beginIndex);
        expect(commitIndex).toBeGreaterThan(prepareIndex);
        expect(executeIndex).toBeGreaterThan(commitIndex);
      }
    );

    it(
      "evidence-binds Avalanche to EVM Thirdweb source transactions before signing",
      () => {
        const executionStart =
          swapWidgetSource.indexOf("// Execution Logic");

        expect(executionStart)
          .toBeGreaterThanOrEqual(0);

        const executionSource =
          swapWidgetSource.slice(executionStart);

        const block = between(
          executionSource,
          "// Other EVM swaps → ThirdWeb SDK",
          "setTxHashes(hashes);"
        );

        expect(block)
          .toContain("fromChainId === 43114");

        expect(block)
          .toContain("beginAvaxBridgeEvidence");

        expect(block)
          .toContain("commitAvaxBridgeEvidence");

        expect(block)
          .toContain("executeEvidenceBoundOperation");

        expect(block)
          .toContain('provider: "thirdweb"');

        const beginIndex =
          block.indexOf("beginAvaxBridgeEvidence");
        const prepareIndex =
          block.indexOf("Bridge.Sell.prepare");
        const commitIndex =
          block.indexOf("commitAvaxBridgeEvidence");
        const executeIndex =
          block.indexOf("executeEvidenceBoundOperation");

        expect(beginIndex).toBeGreaterThanOrEqual(0);
        expect(prepareIndex).toBeGreaterThan(beginIndex);
        expect(commitIndex).toBeGreaterThan(prepareIndex);
        expect(executeIndex).toBeGreaterThan(commitIndex);
      }
    );

    it(
      "does not dynamically sign an uncommitted Avalanche reset-approval",
      () => {
        const executionStart =
          swapWidgetSource.indexOf("// Execution Logic");

        expect(executionStart)
          .toBeGreaterThanOrEqual(0);

        const executionSource =
          swapWidgetSource.slice(executionStart);

        const block = between(
          executionSource,
          "// Other EVM swaps → ThirdWeb SDK",
          "setTxHashes(hashes);"
        );

        expect(block)
          .toContain("avaxSourceSteps");

        expect(block)
          .toContain("Reset bridge allowance");

        expect(block)
          .not.toContain(
            "const resetReceipt = await sendAndConfirmTransaction"
          );
      }
    );
  }
);
