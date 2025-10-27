#!/usr/bin/env node

/**
 * Next.js sometimes records sanitized chunk names in
 * `.next/server/middleware-react-loadable-manifest.js`
 * without emitting matching files under `.next/static/chunks/`.
 *
 * When the browser later requests those chunks (for example
 * `_app-pages-browser_node_modules_thirdweb_dist_esm_utils_encoding_helpers_concat-hex_js.js`)
 * it receives a 404 and the page crashes.
 *
 * This script copies the real emitted chunk (from the standard
 * `react-loadable-manifest.json` mapping) to the missing filename so
 * that both manifests stay in sync and the chunk can be served.
 *
 * Run after `next build` or any time `.next/` is regenerated.
 */

import { existsSync, readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

const NEXT_DIR = resolve(process.cwd(), ".next");
const HASHED_MANIFEST_PATH = join(NEXT_DIR, "react-loadable-manifest.json");
const MIDDLEWARE_MANIFEST_PATH = join(NEXT_DIR, "server", "middleware-react-loadable-manifest.js");

if (!existsSync(NEXT_DIR) || !existsSync(HASHED_MANIFEST_PATH) || !existsSync(MIDDLEWARE_MANIFEST_PATH)) {
  console.warn("[patch-loadable-chunks] Skipped: required build artifacts not found.");
  process.exit(0);
}

/** @typedef {{ files?: string[] }} ManifestEntry */

/** @type Record<string, { files?: string[] }> */
const hashedManifest = JSON.parse(readFileSync(HASHED_MANIFEST_PATH, "utf-8"));

const middlewareRaw = readFileSync(MIDDLEWARE_MANIFEST_PATH, "utf-8");
const prefix = "self.__REACT_LOADABLE_MANIFEST=";
if (!middlewareRaw.startsWith(prefix)) {
  console.warn("[patch-loadable-chunks] Unexpected middleware manifest format. Aborting.");
  process.exit(0);
}

let manifestChunk = middlewareRaw.slice(prefix.length).trim();
if (manifestChunk.startsWith("'") || manifestChunk.startsWith("\"")) {
  const quote = manifestChunk[0];
  const end = manifestChunk.lastIndexOf(quote);
  manifestChunk = manifestChunk.slice(1, end);
}

/** @type Record<string, { id: string; files?: string[] }> */
const middlewareManifest = JSON.parse(manifestChunk);

/** @type {string[]} */
const created = [];

for (const [moduleId, middlewareEntry] of Object.entries(middlewareManifest)) {
  const middlewareFiles = middlewareEntry.files ?? [];
  if (middlewareFiles.length === 0) continue;

  const hashedEntry = hashedManifest[moduleId];
  const hashedFiles = hashedEntry?.files ?? [];
  const hashedExisting = hashedFiles
    .map((file) => join(NEXT_DIR, file))
    .filter((filePath) => existsSync(filePath));

  if (hashedExisting.length === 0) continue;

  for (const relativeTarget of middlewareFiles) {
    const targetPath = join(NEXT_DIR, relativeTarget);
    if (existsSync(targetPath)) continue;

    const sourcePath = hashedExisting[0];

    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
    created.push(relativeTarget);
  }
}

if (created.length === 0) {
  console.log("[patch-loadable-chunks] No missing chunk aliases detected.");
  process.exit(0);
}

console.log("[patch-loadable-chunks] Created aliases for missing chunks:");
for (const file of created) {
  console.log(`  - ${file}`);
}

// No need to rewrite the middleware manifest; it already points to the new files.
