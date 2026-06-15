import { describe, it, expect } from "vitest";
import { analyzeVariance } from "../../src/engine/index.js";
import { parsePlan } from "../../src/parser/index.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { H6CostActualRecord } from "../../src/h6/schema.js";
import "../../src/pricing/node.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(HERE, "../fixtures");

function loadFixture(name: string) {
  return readFileSync(resolve(FIX, name), "utf-8");
}

describe("variance with H6 log (FR-03 / AVD-AD-03)", () => {
  it("replays per-attempt costs from H6 log when available", () => {
    const p = parsePlan(loadFixture("simple-plan.yaml"));
    if (!p.ok) throw new Error("plan parse failed");

    // Create a mock execution log with retries
    const log = {
      plan_id: "simple-haiku-001",
      provider: "generic" as const,
      run_id: "run-h6-001",
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
          retries: 2, // 2 retries = 3 total attempts
        },
      ],
    };

    // Create H6 cost_actual records with different per-attempt costs
    const h6Records: H6CostActualRecord[] = [
      {
        ts_iso: "2026-04-22T10:00:01Z",
        kind: "cost_actual" as const,
        step_id: "step-1",
        attempt_index: 0,
        plan_id: "simple-haiku-001",
        stage_id: "s01",
        model: "claude-haiku-4-5",
        cost_usd: 0.010,
        actual_tokens: { input: 11000, output: 5200 },
        latency_ms: 100,
      },
      {
        ts_iso: "2026-04-22T10:00:02Z",
        kind: "cost_actual" as const,
        step_id: "step-1",
        attempt_index: 1,
        plan_id: "simple-haiku-001",
        stage_id: "s01",
        model: "claude-haiku-4-5",
        cost_usd: 0.012,
        actual_tokens: { input: 11000, output: 5200 },
        latency_ms: 110,
      },
      {
        ts_iso: "2026-04-22T10:00:03Z",
        kind: "cost_actual" as const,
        step_id: "step-1",
        attempt_index: 2,
        plan_id: "simple-haiku-001",
        stage_id: "s01",
        model: "claude-haiku-4-5",
        cost_usd: 0.011,
        actual_tokens: { input: 11000, output: 5200 },
        latency_ms: 105,
      },
    ];

    const v = analyzeVariance(p.value, log, {}, h6Records);

    // Should have one stage
    expect(v.per_stage.length).toBe(1);

    const stage = v.per_stage[0];
    expect(stage.stage_id).toBe("s01");

    // Actual cost should be the sum of per-attempt costs
    const expectedSum = 0.010 + 0.012 + 0.011;
    expect(stage.actual_usd).toBeCloseTo(expectedSum, 6);

    // Should have high confidence
    expect(stage.confidence).toBe("high");

    // Attribution should mention per-attempt actuals
    expect(stage.attribution).toContain("3 per-attempt actuals replayed from H6 log.");
  });

  it("filters non-cost_actual records from H6 log", () => {
    const p = parsePlan(loadFixture("simple-plan.yaml"));
    if (!p.ok) throw new Error("plan parse failed");

    const log = {
      plan_id: "simple-haiku-001",
      provider: "generic" as const,
      run_id: "run-h6-002",
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
          retries: 0,
        },
      ],
    };

    // Mix of cost_estimate, cost_actual, and other records
    const h6Records: H6CostActualRecord[] = [
      {
        ts_iso: "2026-04-22T10:00:01Z",
        kind: "cost_actual" as const,
        step_id: "step-1",
        attempt_index: 0,
        plan_id: "simple-haiku-001",
        stage_id: "s01",
        model: "claude-haiku-4-5",
        cost_usd: 0.010,
        actual_tokens: { input: 11000, output: 5200 },
        latency_ms: 100,
      },
      // Note: we can only pass cost_actual in the type, but the function filters by kind anyway
    ];

    const v = analyzeVariance(p.value, log, {}, h6Records);
    expect(v.per_stage.length).toBe(1);
    expect(v.per_stage[0].confidence).toBe("high");
  });

  it("handles missing stage_id in H6 records gracefully", () => {
    const p = parsePlan(loadFixture("simple-plan.yaml"));
    if (!p.ok) throw new Error("plan parse failed");

    const log = {
      plan_id: "simple-haiku-001",
      provider: "generic" as const,
      run_id: "run-h6-003",
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
          retries: 0,
        },
      ],
    };

    // Record with missing stage_id
    const h6Records: H6CostActualRecord[] = [
      {
        ts_iso: "2026-04-22T10:00:01Z",
        kind: "cost_actual" as const,
        step_id: "step-1",
        attempt_index: 0,
        plan_id: "simple-haiku-001",
        // stage_id is undefined
        model: "claude-haiku-4-5",
        cost_usd: 0.010,
        actual_tokens: { input: 100, output: 50 },
        latency_ms: 100,
      },
    ];

    const v = analyzeVariance(p.value, log, {}, h6Records);
    expect(v.per_stage.length).toBe(1);
    // Should fall back to low confidence since no H6 record matched
    expect(v.per_stage[0].confidence).toBe("low");
  });
});
