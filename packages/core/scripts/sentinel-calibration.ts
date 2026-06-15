#!/usr/bin/env node

/**
 * Sentinel Calibration Script (FR-09)
 *
 * Detects tokenizer drift between actual tokenization and the per-model
 * tokenizer_correction values bundled in pricing.json.
 *
 * Placeholder implementation using chars-per-token heuristic (4.0 chars/token).
 * Real implementation would integrate @anthropic-ai/tokenizer or equivalent.
 *
 * Exit codes:
 * - 0: no drift or baseline initialized
 * - 3: drift > 5% (per UXD §1.1 sentinel calibration exit-code spec)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ModelPricing, PricingDatabase } from "../src/schemas/pricing.js";

const DRIFT_FAIL_THRESHOLD = 0.05; // 5%
const DRIFT_WARN_THRESHOLD = 0.02; // 2%
const CHARS_PER_TOKEN_HEURISTIC = 4.0; // placeholder tokenizer

interface SentinelBaseline {
  schema_version: number;
  snapshot_date: string;
  tokens_per_model: Record<string, number>;
}

function estimateTokenCount(text: string): number {
  // Placeholder: chars-per-token heuristic. Real implementation would use
  // @anthropic-ai/tokenizer npm package or Anthropic tokenizer endpoint.
  return Math.ceil(text.length / CHARS_PER_TOKEN_HEURISTIC);
}

function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = join(__filename, "..");
  const packageRoot = join(__dirname, "..");
  const corpusPath = join(packageRoot, "data", "sentinel-corpus.txt");
  const baselinePath = join(packageRoot, "data", "sentinel-baseline.json");
  const pricingPath = join(packageRoot, "data", "pricing.json");

  // Read corpus
  const corpus = readFileSync(corpusPath, "utf-8");
  const corpusTokens = estimateTokenCount(corpus);

  // Read pricing
  const pricingData = JSON.parse(readFileSync(pricingPath, "utf-8")) as PricingDatabase;
  const models = pricingData.models;

  // Read or initialize baseline
  let baseline: SentinelBaseline;
  try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf-8")) as SentinelBaseline;
  } catch {
    baseline = {
      schema_version: 1,
      snapshot_date: new Date().toISOString().split("T")[0],
      tokens_per_model: {},
    };
  }

  // Compute current tokenization for each model
  const current: Record<string, number> = {};
  for (const model of models) {
    current[model.model_id] = corpusTokens;
  }

  // Initialize baseline if empty
  if (Object.keys(baseline.tokens_per_model).length === 0) {
    baseline.tokens_per_model = current;
    baseline.snapshot_date = new Date().toISOString().split("T")[0];
    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
    console.log("BASELINE INITIALIZED");
    process.exit(0);
  }

  // Check drift for each model
  let hasFail = false;
  let hasWarn = false;

  for (const model of models) {
    const baselineTokens = baseline.tokens_per_model[model.model_id];
    const currentTokens = current[model.model_id];

    if (baselineTokens === undefined) {
      // Model is new; add to baseline
      baseline.tokens_per_model[model.model_id] = currentTokens;
      continue;
    }

    const drift = Math.abs(currentTokens - baselineTokens) / baselineTokens;

    if (drift > DRIFT_FAIL_THRESHOLD) {
      console.error(
        `FAIL: ${model.model_id} drift ${(drift * 100).toFixed(1)}% > ${DRIFT_FAIL_THRESHOLD * 100}% threshold (baseline ${baselineTokens}, current ${currentTokens})`,
      );
      hasFail = true;
    } else if (drift > DRIFT_WARN_THRESHOLD) {
      console.warn(
        `WARN: ${model.model_id} drift ${(drift * 100).toFixed(1)}% (baseline ${baselineTokens}, current ${currentTokens})`,
      );
      hasWarn = true;
    }
  }

  if (hasFail) {
    process.exit(3);
  }

  process.exit(0);
}

main();
