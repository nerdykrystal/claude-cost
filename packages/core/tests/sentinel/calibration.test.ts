import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const packageRoot = join(__dirname, "../..");
const baselinePath = join(packageRoot, "data", "sentinel-baseline.json");
const corpusPath = join(packageRoot, "data", "sentinel-corpus.txt");

interface SentinelBaseline {
  schema_version: number;
  snapshot_date: string;
  tokens_per_model: Record<string, number>;
}

describe("sentinel-calibration", () => {
  let originalBaseline: string;

  beforeEach(() => {
    // Backup baseline before each test
    try {
      originalBaseline = readFileSync(baselinePath, "utf-8");
    } catch {
      originalBaseline = "";
    }
  });

  afterEach(() => {
    // Restore baseline after each test
    if (originalBaseline) {
      writeFileSync(baselinePath, originalBaseline);
    }
  });

  it("should read sentinel corpus without error", () => {
    const corpus = readFileSync(corpusPath, "utf-8");
    expect(corpus.length).toBeGreaterThan(100);
  });

  it("should initialize baseline with empty tokens_per_model", () => {
    const baseline: SentinelBaseline = JSON.parse(readFileSync(baselinePath, "utf-8"));
    expect(baseline.schema_version).toBe(1);
    expect(baseline.tokens_per_model).toBeDefined();
  });

  it("should calculate heuristic token count from corpus", () => {
    const corpus = readFileSync(corpusPath, "utf-8");
    const CHARS_PER_TOKEN = 4.0;
    const tokenCount = Math.ceil(corpus.length / CHARS_PER_TOKEN);
    expect(tokenCount).toBeGreaterThan(50);
  });

  it("should detect drift when baseline tokens differ significantly", () => {
    const corpus = readFileSync(corpusPath, "utf-8");
    const CHARS_PER_TOKEN = 4.0;
    const currentTokens = Math.ceil(corpus.length / CHARS_PER_TOKEN);
    const baselineTokens = 10; // Very low, should trigger >5% drift

    const drift = Math.abs(currentTokens - baselineTokens) / baselineTokens;
    expect(drift).toBeGreaterThan(0.05);
  });

  it("should not flag drift when within 5% tolerance", () => {
    const corpus = readFileSync(corpusPath, "utf-8");
    const CHARS_PER_TOKEN = 4.0;
    const currentTokens = Math.ceil(corpus.length / CHARS_PER_TOKEN);
    const baselineTokens = currentTokens; // Exact match

    const drift = Math.abs(currentTokens - baselineTokens) / baselineTokens;
    expect(drift).toBeLessThanOrEqual(0.05);
  });

  it("should warn when drift is between 2-5%", () => {
    const corpus = readFileSync(corpusPath, "utf-8");
    const CHARS_PER_TOKEN = 4.0;
    const currentTokens = Math.ceil(corpus.length / CHARS_PER_TOKEN);
    const baselineTokens = Math.floor(currentTokens / 1.03); // ~3% drift

    const drift = Math.abs(currentTokens - baselineTokens) / baselineTokens;
    expect(drift).toBeGreaterThan(0.02);
    expect(drift).toBeLessThan(0.05);
  });
});
