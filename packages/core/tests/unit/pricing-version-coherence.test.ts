import { describe, it, expect } from "vitest";
import "../../src/pricing/node.js";
import { analyzeVariance } from "../../src/engine/index.js";
import type { Plan } from "../../src/schemas/plan.js";
import type { ExecutionLog } from "../../src/schemas/log.js";

describe("pricing_version coherence (FR-17 / CC-14)", () => {
  const plan: Plan = {
    plan_id: "test-pricing-version",
    plan_name: "Test Pricing Version",
    stages: [
      {
        id: "stage-1",
        name: "Stage 1",
        model: "claude-haiku-4-5",
        input_tokens: 1000,
        output_tokens: 1000,
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

  it("should not emit warning when pricing_version matches", () => {
    const log: ExecutionLog = {
      run_id: "run-1",
      pricing_version: "2026-04-22", // Same as bundled pricing
      stages: [
        {
          stage_id: "stage-1",
          model: "claude-haiku-4-5",
          input_tokens: 1000,
          output_tokens: 1000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 0,
        },
      ],
    };

    const result = analyzeVariance(plan, log);

    // Should not emit mismatch assumption
    const mismatchAssumption = result.assumptions?.find((a) =>
      a.includes("pricing_version mismatch"),
    );
    expect(mismatchAssumption).toBeUndefined();
  });

  it("should emit warning when pricing_version mismatches", () => {
    const log: ExecutionLog = {
      run_id: "run-2",
      pricing_version: "2026-04-20-v0", // Different from estimate
      stages: [
        {
          stage_id: "stage-1",
          model: "claude-haiku-4-5",
          input_tokens: 1000,
          output_tokens: 1000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 0,
        },
      ],
    };

    const result = analyzeVariance(plan, log);

    // Should emit mismatch assumption
    const mismatchAssumption = result.assumptions?.find((a) =>
      a.includes("pricing_version mismatch"),
    );
    expect(mismatchAssumption).toBeDefined();
    expect(mismatchAssumption).toContain("2026-04-20-v0");
    expect(mismatchAssumption).toContain("cost comparisons may be skewed");
  });

  it("should not emit warning when log lacks pricing_version", () => {
    const log: ExecutionLog = {
      run_id: "run-3",
      // pricing_version deliberately absent
      stages: [
        {
          stage_id: "stage-1",
          model: "claude-haiku-4-5",
          input_tokens: 1000,
          output_tokens: 1000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 0,
        },
      ],
    };

    const result = analyzeVariance(plan, log);

    // Should not emit mismatch assumption
    const mismatchAssumption = result.assumptions?.find((a) =>
      a.includes("pricing_version mismatch"),
    );
    expect(mismatchAssumption).toBeUndefined();
  });

  it("should include estimate pricing_version in mismatch message", () => {
    const log: ExecutionLog = {
      run_id: "run-4",
      pricing_version: "2026-03-15-old",
      stages: [
        {
          stage_id: "stage-1",
          model: "claude-haiku-4-5",
          input_tokens: 1000,
          output_tokens: 1000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 0,
        },
      ],
    };

    const result = analyzeVariance(plan, log);

    const mismatchAssumption = result.assumptions?.find((a) =>
      a.includes("pricing_version mismatch"),
    );
    expect(mismatchAssumption).toContain("estimate");
    expect(mismatchAssumption).toContain("log 2026-03-15-old");
  });
});
