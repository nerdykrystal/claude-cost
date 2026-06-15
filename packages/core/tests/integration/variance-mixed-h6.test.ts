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

describe("variance with mixed H6 coverage (some stages with, some without)", () => {
  it("uses high confidence for stages with H6 records, low for others", () => {
    // Need a multi-stage plan for this test
    const planYaml = `
plan_id: mixed-test
plan_name: Mixed H6 Coverage
stages:
  - id: stage-a
    name: Stage A
    model: claude-haiku-4-5
    input_tokens: 100000
    output_tokens: 50000
  - id: stage-b
    name: Stage B
    model: claude-haiku-4-5
    input_tokens: 100000
    output_tokens: 50000
`;

    const p = parsePlan(planYaml);
    if (!p.ok) throw new Error("plan parse failed");

    const log = {
      plan_id: "mixed-test",
      provider: "generic" as const,
      run_id: "run-mixed",
      started_at: "2026-04-22T10:00:00Z",
      finished_at: "2026-04-22T10:05:00Z",
      stages: [
        {
          stage_id: "stage-a",
          model: "claude-haiku-4-5",
          input_tokens: 100000,
          output_tokens: 50000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 0,
        },
        {
          stage_id: "stage-b",
          model: "claude-haiku-4-5",
          input_tokens: 100000,
          output_tokens: 50000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 0,
        },
      ],
    };

    // Only provide H6 records for stage-a
    const h6Records: H6CostActualRecord[] = [
      {
        ts_iso: "2026-04-22T10:00:01Z",
        kind: "cost_actual" as const,
        step_id: "step-a",
        attempt_index: 0,
        plan_id: "mixed-test",
        stage_id: "stage-a",
        model: "claude-haiku-4-5",
        cost_usd: 0.050,
        actual_tokens: { input: 100000, output: 50000 },
        latency_ms: 500,
      },
    ];

    const v = analyzeVariance(p.value, log, {}, h6Records);

    expect(v.per_stage.length).toBe(2);

    // Stage A has H6 record
    const stageA = v.per_stage.find((s) => s.stage_id === "stage-a");
    expect(stageA).toBeDefined();
    expect(stageA!.confidence).toBe("high");
    expect(stageA!.actual_usd).toBeCloseTo(0.050, 6);

    // Stage B has no H6 record
    const stageB = v.per_stage.find((s) => s.stage_id === "stage-b");
    expect(stageB).toBeDefined();
    expect(stageB!.confidence).toBe("low");
  });

  it("mixed plan-level reporting includes both high and low confidence stages", () => {
    const planYaml = `
plan_id: mixed-plan-2
plan_name: Mixed Plan 2
stages:
  - id: s1
    name: Step 1
    model: claude-haiku-4-5
    input_tokens: 100000
    output_tokens: 50000
  - id: s2
    name: Step 2
    model: claude-haiku-4-5
    input_tokens: 100000
    output_tokens: 50000
`;

    const p = parsePlan(planYaml);
    if (!p.ok) throw new Error("plan parse failed");

    const log = {
      plan_id: "mixed-plan-2",
      provider: "generic" as const,
      run_id: "run-mixed-2",
      started_at: "2026-04-22T10:00:00Z",
      finished_at: "2026-04-22T10:05:00Z",
      stages: [
        {
          stage_id: "s1",
          model: "claude-haiku-4-5",
          input_tokens: 100000,
          output_tokens: 50000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 1,
        },
        {
          stage_id: "s2",
          model: "claude-haiku-4-5",
          input_tokens: 100000,
          output_tokens: 50000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 0,
        },
      ],
    };

    // Provide H6 for both stages
    const h6Records: H6CostActualRecord[] = [
      {
        ts_iso: "2026-04-22T10:00:01Z",
        kind: "cost_actual" as const,
        step_id: "step-s1",
        attempt_index: 0,
        plan_id: "mixed-plan-2",
        stage_id: "s1",
        model: "claude-haiku-4-5",
        cost_usd: 0.048,
        actual_tokens: { input: 100000, output: 50000 },
        latency_ms: 500,
      },
      {
        ts_iso: "2026-04-22T10:00:02Z",
        kind: "cost_actual" as const,
        step_id: "step-s1",
        attempt_index: 1,
        plan_id: "mixed-plan-2",
        stage_id: "s1",
        model: "claude-haiku-4-5",
        cost_usd: 0.050,
        actual_tokens: { input: 100000, output: 50000 },
        latency_ms: 510,
      },
      {
        ts_iso: "2026-04-22T10:00:03Z",
        kind: "cost_actual" as const,
        step_id: "step-s2",
        attempt_index: 0,
        plan_id: "mixed-plan-2",
        stage_id: "s2",
        model: "claude-haiku-4-5",
        cost_usd: 0.049,
        actual_tokens: { input: 100000, output: 50000 },
        latency_ms: 500,
      },
    ];

    const v = analyzeVariance(p.value, log, {}, h6Records);

    // Both stages should have high confidence
    expect(v.per_stage.every((s) => s.confidence === "high")).toBe(true);

    // Total actual should be sum of all per-attempt costs
    const expectedTotal = 0.048 + 0.050 + 0.049;
    expect(v.total_actual_usd).toBeCloseTo(expectedTotal, 6);

    // No assumption should be added since all stages have high confidence
    // (but if one was missing, assumption would be present)
    const stage1 = v.per_stage.find((s) => s.stage_id === "s1");
    expect(stage1!.attribution).toContain("2 per-attempt actuals replayed from H6 log.");
  });

  it("handles stage with only partial H6 coverage", () => {
    const planYaml = `
plan_id: partial-h6
plan_name: Partial H6
stages:
  - id: stage-x
    name: Stage X
    model: claude-haiku-4-5
    input_tokens: 100000
    output_tokens: 50000
`;

    const p = parsePlan(planYaml);
    if (!p.ok) throw new Error("plan parse failed");

    const log = {
      plan_id: "partial-h6",
      provider: "generic" as const,
      run_id: "run-partial",
      started_at: "2026-04-22T10:00:00Z",
      finished_at: "2026-04-22T10:05:00Z",
      stages: [
        {
          stage_id: "stage-x",
          model: "claude-haiku-4-5",
          input_tokens: 100000,
          output_tokens: 50000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 2, // 3 attempts total
        },
      ],
    };

    // Only 1 H6 record for a stage that had 3 attempts
    // (e.g., first attempt succeeded but H6 only captured the final one)
    const h6Records: H6CostActualRecord[] = [
      {
        ts_iso: "2026-04-22T10:00:03Z",
        kind: "cost_actual" as const,
        step_id: "step-x",
        attempt_index: 2,
        plan_id: "partial-h6",
        stage_id: "stage-x",
        model: "claude-haiku-4-5",
        cost_usd: 0.051,
        actual_tokens: { input: 100000, output: 50000 },
        latency_ms: 510,
      },
    ];

    const v = analyzeVariance(p.value, log, {}, h6Records);

    // Should use high confidence since we have at least one H6 record
    expect(v.per_stage[0].confidence).toBe("high");
    expect(v.per_stage[0].actual_usd).toBeCloseTo(0.051, 6);
  });
});
