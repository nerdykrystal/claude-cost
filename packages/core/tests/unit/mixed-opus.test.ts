import { describe, it, expect } from "vitest";
import "../../src/pricing/node.js";
import { estimatePlan } from "../../src/engine/index.js";
import type { Plan } from "../../src/schemas/plan.js";

describe("mixed-opus warning text", () => {
  it("should include per-generation corrections in MIXED OPUS message for 4.6 + 4.7", () => {
    const plan: Plan = {
      plan_id: "test-mixed-4-6-4-7",
      plan_name: "Mixed Opus 4.6 and 4.7",
      stages: [
        {
          id: "stage-1",
          name: "Stage 1 (4.6)",
          model: "claude-opus-4-6",
          input_tokens: 1000,
          output_tokens: 500,
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
        {
          id: "stage-2",
          name: "Stage 2 (4.7)",
          model: "claude-opus-4-7",
          input_tokens: 1000,
          output_tokens: 500,
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

    const result = estimatePlan(plan);

    // Find the MIXED OPUS assumption
    const mixedAssumption = result.assumptions.find((a) =>
      a.includes("MIXED OPUS GENERATIONS detected"),
    );

    expect(mixedAssumption).toBeDefined();
    expect(mixedAssumption).toContain("opus-4.6 (correction 1.00x)");
    expect(mixedAssumption).toContain("opus-4.7 (correction 1.35x)");
    expect(mixedAssumption).not.toContain("Opus 4.7 tokenizer correction applied");
  });

  it("should not emit MIXED OPUS message for single-Opus plan", () => {
    const plan: Plan = {
      plan_id: "test-single-4-7",
      plan_name: "Single Opus 4.7",
      stages: [
        {
          id: "stage-1",
          name: "Stage 1 (4.7)",
          model: "claude-opus-4-7",
          input_tokens: 1000,
          output_tokens: 500,
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

    const result = estimatePlan(plan);

    // Find MIXED OPUS assumption
    const mixedAssumption = result.assumptions.find((a) =>
      a.includes("MIXED OPUS GENERATIONS detected"),
    );

    expect(mixedAssumption).toBeUndefined();
  });

  it("should set mixed_opus_generations flag correctly", () => {
    const mixedPlan: Plan = {
      plan_id: "test-mixed-flag",
      plan_name: "Mixed for flag test",
      stages: [
        {
          id: "s1",
          name: "S1 (4.6)",
          model: "claude-opus-4-6",
          input_tokens: 500,
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
        {
          id: "s2",
          name: "S2 (4.7)",
          model: "claude-opus-4-7",
          input_tokens: 500,
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

    const mixedResult = estimatePlan(mixedPlan);
    expect(mixedResult.mixed_opus_generations).toBe(true);

    const singlePlan: Plan = {
      plan_id: "test-single-flag",
      plan_name: "Single for flag test",
      stages: [
        {
          id: "s1",
          name: "S1 (4.7)",
          model: "claude-opus-4-7",
          input_tokens: 500,
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

    const singleResult = estimatePlan(singlePlan);
    expect(singleResult.mixed_opus_generations).toBe(false);
  });
});
