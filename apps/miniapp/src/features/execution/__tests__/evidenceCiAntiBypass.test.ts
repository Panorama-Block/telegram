import {
  describe,
  expect,
  it,
} from "vitest";

import {
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";

import {
  relative,
  resolve,
} from "node:path";

const SRC_ROOT = resolve(
  process.cwd(),
  "src"
);

const APPROVED_SUBMISSION_BOUNDARIES =
  new Set([
    "features/execution/evidenceBoundExecutor.ts",
    "features/execution/nonEvidenceTransactionExecutor.ts",
  ]);

function productionSourceFiles(
  directory: string
): string[] {
  const files: string[] = [];

  for (
    const entry of readdirSync(directory)
  ) {
    const fullPath =
      resolve(directory, entry);

    const stat =
      statSync(fullPath);

    if (stat.isDirectory()) {
      if (
        entry === "__tests__" ||
        entry === "node_modules"
      ) {
        continue;
      }

      files.push(
        ...productionSourceFiles(
          fullPath
        )
      );

      continue;
    }

    if (
      !/\.(ts|tsx)$/.test(entry) ||
      /\.(test|spec)\.(ts|tsx)$/.test(
        entry
      )
    ) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function relativeSourcePath(
  file: string
): string {
  return relative(
    SRC_ROOT,
    file
  ).replaceAll("\\", "/");
}

function containsRawSubmission(
  source: string
): boolean {
  return [
    /\bsendAndConfirmTransaction\s*\(/,
    /(^|[^.A-Za-z0-9_$])sendTransaction\s*\(/m,
    /\b(?:this\.)?account\.sendTransaction\s*\(/,
    /method\s*:\s*["']eth_sendTransaction["']/,
  ].some(
    pattern => pattern.test(source)
  );
}

describe(
  "evidence CI anti-bypass",
  () => {
    it(
      "permits wallet submission primitives only inside approved policy boundaries",
      () => {
        const violations: string[] = [];

        for (
          const file of productionSourceFiles(
            SRC_ROOT
          )
        ) {
          const sourcePath =
            relativeSourcePath(file);

          if (
            APPROVED_SUBMISSION_BOUNDARIES
              .has(sourcePath)
          ) {
            continue;
          }

          const source =
            readFileSync(
              file,
              "utf8"
            );

          if (
            containsRawSubmission(
              source
            )
          ) {
            violations.push(
              sourcePath
            );
          }
        }

        expect(
          violations,
          [
            "Raw wallet submission bypasses chain evidence policy.",
            "Production submission primitives are permitted only inside:",
            "- evidenceBoundExecutor.ts",
            "- nonEvidenceTransactionExecutor.ts",
            ...violations.map(
              file => `VIOLATION: ${file}`
            ),
          ].join("\n")
        ).toEqual([]);
      }
    );
  }
);
