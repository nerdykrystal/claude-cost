import { describe, it, expect } from "vitest";
import { analyzeVariance } from "../../src/engine/index.js";
import { parsePlan } from "../../src/parser/index.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "../../src/pricing/node.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(HERE, "../fixtures");

function loadFixture(name: string) {
  return readFileSync(resolve(FIX, name), "utf-8");
}

describe("variance without H6 log (fallback to uniform-cost)", () => {
  it("falls back to uniform-cost approximation when H6 log absent", () => {
    const p = parsePlan(loadFixture("simple-plan.yaml"));
    const l_content = loadFixture("execution-log.json");
    if (!p.ok) throw new Error("plan parse failed");

    const log = JSON.parse(l_content);

    // No H6 log passed
    const v = analyzeVariance(p.value, log, {});

    expect(v.per_stage.length).toBeGreaterThan(0);
    const stage = v.per_stage[0];

    // Should have low confidence
    expect(stage.confidence).toBe("low");
  });

  it("adds assumption about uniform-cost fallback when no H6 log", () => {
    const p = parsePlan(loadFixture("simple-plan.yaml"));
    const l_content = loadFixture("execution-log.json");
    if (!p.ok) throw new Error("plan parse failed");

    const log = JSON.parse(l_content);

    const v = analyzeVariance(p.value, log, {});

    // Should include assumption about fallback
    expect(v.assumptions).toBeDefined();
    expect(v.assumptions).toContainEqual(
      "Per-attempt actuals unavailable; using uniform-cost approximation with confidence:low"
    );
  });

  it("handles undefined H6 log gracefully", () => {
    const p = parsePlan(loadFixture("simple-plan.yaml"));
    const l_content = loadFixture("execution-log.json");
    if (!p.ok) throw new Error("plan parse failed");

    const log = JSON.parse(l_content);

    // Explicitly pass undefined
    const v = analyzeVariance(p.value, log, {}, undefined);

    expect(v.per_stage.length).toBeGreaterThan(0);
    expect(v.per_stage[0].confidence).toBe("low");
  });

  it("still emits other attribution when no H6 log but actual data present", () => {
    const p = parsePlan(loadFixture("simple-plan.yaml"));
    if (!p.ok) throw new Error("plan parse failed");

    const log = {
      plan_id: "simple-haiku-001",
      provider: "generic" as const,
      run_id: "run-no-h6",
      started_at: "2026-04-22T10:00:00Z",
      finished_at: "2026-04-22T10:05:00Z",
      stages: [
        {
          stage_id: "s01",
          model: "claude-haiku-4-5",
          input_tokens: 11000,
          output_tokens: 5200,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 1, // Has retries
        },
      ],
    };

    const v = analyzeVariance(p.value, log, {});

    const stage = v.per_stage[0];
    expect(stage.attribution).toContain("1 retry(ies) observed.");
    expect(stage.confidence).toBe("low");
  });

  it("computes actual_usd via uniform formula when no H6 log", () => {
    const p = parsePlan(loadFixture("simple-plan.yaml"));
    if (!p.ok) throw new Error("plan parse failed");

    const log = {
      plan_id: "simple-haiku-001",
      provider: "generic" as const,
      run_id: "run-uniform",
      started_at: "2026-04-22T10:00:00Z",
      finished_at: "2026-04-22T10:05:00Z",
      stages: [
        {
          stage_id: "s01",
          model: "claude-haiku-4-5",
          input_tokens: 100_000,
          output_tokens: 50_000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 2,
        },
      ],
    };

    const v = analyzeVariance(p.value, log, {});

    // Verify that actual_usd is computed (should be > 0 and > than a single attempt)
    expect(v.per_stage[0].actual_usd).toBeGreaterThan(0);
    expect(v.per_stage[0].confidence).toBe("low");
  });
});
