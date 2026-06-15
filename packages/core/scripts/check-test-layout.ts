#!/usr/bin/env tsx
/**
 * check-test-layout.ts
 * Asserts test directory structure AND per-module test file presence
 * per Stage 14 / FR-19 split. Exit 0 on success; exit 1 on missing.
 */

import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const requiredDirs = [
  "tests/unit",
  "tests/property",
  "tests/integration",
  "tests/sentinel",
];

const requiredUnitFiles = [
  "tests/unit/engine.test.ts",
  "tests/unit/parser.test.ts",
  "tests/unit/pricing.test.ts",
  "tests/unit/schemas.test.ts",
  "tests/unit/logs.test.ts",
  "tests/unit/export.test.ts",
];

const requiredPropertyFiles = [
  "tests/property/retry-envelope.test.ts",
];

const missing: string[] = [];

for (const p of [...requiredDirs, ...requiredUnitFiles, ...requiredPropertyFiles]) {
  const abs = resolve(root, p);
  if (!existsSync(abs)) {
    missing.push(abs);
  }
}

if (missing.length > 0) {
  console.error("FAIL: Missing test layout entries:");
  for (const p of missing) console.error(`  - ${p}`);
  process.exit(1);
}

console.log("OK: test layout structure + per-module file split present.");
process.exit(0);
