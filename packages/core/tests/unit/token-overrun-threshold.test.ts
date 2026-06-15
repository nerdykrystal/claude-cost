import { describe, it, expect } from "vitest";
import "../../src/pricing/node.js";
import { analyzeVariance } from "../../src/engine/index.js";
import type { Plan } from "../../src/schemas/plan.js";
import type { ExecutionLog } from "../../src/schemas/log.js";

describe("tokenOverrunThreshold option (FR-14 / CC-10)", () => {
  const plan: Plan = {
    plan_id: "test-threshold",
    plan_name: "Test Threshold",
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

  it("should use default 1.2 threshold when not specified", () => {
    const log: ExecutionLog = {
      run_id: "run-1",
      stages: [
        {
          stage_id: "stage-1",
          model: "claude-haiku-4-5",
          input_tokens: 1250, // 25% over estimate (1000 * 1.25) — exceeds 1.2 threshold
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

    // Should trigger overrun message because 1250 > 1000 * 1.2 (1200)
    const attribution = result.per_stage[0].attribution;
    expect(attribution.some((a) => a.includes("Input tokens exceeded estimate"))).toBe(true);
  });

  it("should honor custom 1.5 threshold", () => {
    const log: ExecutionLog = {
      run_id: "run-2",
      stages: [
        {
          stage_id: "stage-1",
          model: "claude-haiku-4-5",
          input_tokens: 1250, // 25% over estimate (1000 * 1.25)
          output_tokens: 1000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 0,
        },
      ],
    };

    const result = analyzeVariance(plan, log, { tokenOverrunThreshold: 1.5 });

    // Should NOT trigger overrun message because 1250 < 1000 * 1.5 (1500)
    const attribution = result.per_stage[0].attribution;
    expect(attribution.some((a) => a.includes("Input tokens exceeded estimate"))).toBe(false);
  });

  it("should honor zero threshold (always overrun)", () => {
    const log: ExecutionLog = {
      run_id: "run-3",
      stages: [
        {
          stage_id: "stage-1",
          model: "claude-haiku-4-5",
          input_tokens: 1001, // Just 1 token over
          output_tokens: 1000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 0,
        },
      ],
    };

    const result = analyzeVariance(plan, log, { tokenOverrunThreshold: 0 });

    // Should trigger because any overage > 0 * 1000
    const attribution = result.per_stage[0].attribution;
    expect(attribution.some((a) => a.includes("Input tokens exceeded estimate"))).toBe(true);
  });

  it("should honor high threshold (never overrun)", () => {
    const log: ExecutionLog = {
      run_id: "run-4",
      stages: [
        {
          stage_id: "stage-1",
          model: "claude-haiku-4-5",
          input_tokens: 9999, // Way over
          output_tokens: 1000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 0,
        },
      ],
    };

    const result = analyzeVariance(plan, log, { tokenOverrunThreshold: 999 });

    // Should NOT trigger because 9999 < 1000 * 999
    const attribution = result.per_stage[0].attribution;
    expect(attribution.some((a) => a.includes("Input tokens exceeded estimate"))).toBe(false);
  });

  it("should format percentage correctly in attribution", () => {
    const log: ExecutionLog = {
      run_id: "run-5",
      stages: [
        {
          stage_id: "stage-1",
          model: "claude-haiku-4-5",
          input_tokens: 1300, // 30% over estimate
          output_tokens: 1000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 0,
        },
      ],
    };

    const result = analyzeVariance(plan, log, { tokenOverrunThreshold: 1.25 });

    // Should trigger with threshold 1.25, and message should say ">25%"
    const attribution = result.per_stage[0].attribution;
    const overrunMsg = attribution.find((a) => a.includes("Input tokens exceeded estimate"));
    expect(overrunMsg).toContain(">25%");
  });
});
