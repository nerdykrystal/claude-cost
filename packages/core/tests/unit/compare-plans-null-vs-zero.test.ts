import { describe, it, expect } from "vitest";
import { comparePlans } from "../../src/engine/index.js";
import type { Plan } from "../../src/schemas/plan.js";
import "../../src/pricing/node.js";

describe("comparePlans heatmap null vs zero distinction", () => {
  const basePlan1: Plan = {
    plan_id: "plan-stageA-001",
    plan_name: "Plan with Stage A",
    stages: [
      {
        id: "stage-a",
        name: "Stage A",
        model: "claude-haiku-4-5",
        input_tokens: 1000,
        output_tokens: 100,
        thinking_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        batch: false,
        retry_probability: 0,
        max_retries: 0,
        asae_gate: false,
        depends_on: [],
        carry_context_from: [],
      },
    ],
  };

  const basePlan2: Plan = {
    plan_id: "plan-stageB-001",
    plan_name: "Plan with Stage B",
    stages: [
      {
        id: "stage-b",
        name: "Stage B",
        model: "claude-haiku-4-5",
        input_tokens: 2000,
        output_tokens: 200,
        thinking_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        batch: false,
        retry_probability: 0,
        max_retries: 0,
        asae_gate: false,
        depends_on: [],
        carry_context_from: [],
      },
    ],
  };

  it("uses null in heatmap matrix when stage is absent from a plan", () => {
    const report = comparePlans([basePlan1, basePlan2]);
    expect(report.heatmap.stage_ids).toContain("stage-a");
    expect(report.heatmap.stage_ids).toContain("stage-b");

    // Stage A is in Plan 1 (index 0) and absent from Plan 2 (index 1)
    const stageAIdx = report.heatmap.stage_ids.indexOf("stage-a");
    const stageBIdx = report.heatmap.stage_ids.indexOf("stage-b");

    // Plan 1 should have stage-a with a cost, stage-b with null
    expect(report.heatmap.matrix_usd[stageAIdx][0]).not.toBe(null);
    expect(report.heatmap.matrix_usd[stageBIdx][0]).toBe(null);

    // Plan 2 should have stage-b with a cost, stage-a with null
    expect(report.heatmap.matrix_usd[stageBIdx][1]).not.toBe(null);
    expect(report.heatmap.matrix_usd[stageAIdx][1]).toBe(null);
  });

  it("uses 0 in heatmap matrix when stage is present with $0 cost", () => {
    // Create a plan with a stage that has zero cost (edge case)
    const zeroCostPlan: Plan = {
      plan_id: "plan-zero-cost",
      plan_name: "Zero Cost Plan",
      stages: [
        {
          id: "stage-zero",
          name: "Stage with Zero Cost",
          model: "claude-haiku-4-5",
          input_tokens: 0,
          output_tokens: 0,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retry_probability: 0,
          max_retries: 0,
          asae_gate: false,
          depends_on: [],
          carry_context_from: [],
        },
      ],
    };

    const report = comparePlans([basePlan1, zeroCostPlan]);
    const stageZeroIdx = report.heatmap.stage_ids.indexOf("stage-zero");
    const stageAIdx = report.heatmap.stage_ids.indexOf("stage-a");

    // stage-zero is absent from Plan 1
    expect(report.heatmap.matrix_usd[stageZeroIdx][0]).toBe(null);

    // stage-zero is present but with 0 cost in Plan 2
    expect(report.heatmap.matrix_usd[stageZeroIdx][1]).toBe(0);

    // stage-a is present in Plan 1 with non-zero cost
    expect(report.heatmap.matrix_usd[stageAIdx][0]).not.toBe(null);
    expect(report.heatmap.matrix_usd[stageAIdx][0]).toBeGreaterThan(0);

    // stage-a is absent from Plan 2
    expect(report.heatmap.matrix_usd[stageAIdx][1]).toBe(null);
  });

  it("heatmap matrix has correct dimensions (stages x plans)", () => {
    const report = comparePlans([basePlan1, basePlan2]);
    expect(report.heatmap.matrix_usd.length).toBe(2); // 2 stages (stage-a, stage-b)
    expect(report.heatmap.matrix_usd[0].length).toBe(2); // 2 plans
  });

  it("distinguishes between null (absent) and 0 (present-with-zero-cost) visually in heatmap", () => {
    const zeroCostPlan: Plan = {
      plan_id: "plan-zero-stage-a",
      plan_name: "Plan with Zero-Cost Stage A",
      stages: [
        {
          id: "stage-a",
          name: "Stage A",
          model: "claude-haiku-4-5",
          input_tokens: 0,
          output_tokens: 0,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retry_probability: 0,
          max_retries: 0,
          asae_gate: false,
          depends_on: [],
          carry_context_from: [],
        },
      ],
    };

    const report = comparePlans([basePlan1, zeroCostPlan]);
    const stageAIdx = 0;

    // Plan 1 has stage-a with non-zero cost
    const plan1Cost = report.heatmap.matrix_usd[stageAIdx][0];
    expect(plan1Cost).not.toBe(null);
    expect(plan1Cost).toBeGreaterThan(0);

    // Plan 2 has stage-a with zero cost (present, not absent)
    const plan2Cost = report.heatmap.matrix_usd[stageAIdx][1];
    expect(plan2Cost).toBe(0);
    expect(plan2Cost).not.toBe(null); // Explicitly not null
  });
});
