import { describe, it, expect } from "vitest";
import { z } from "zod";
import { StageSchema, PlanSchema } from "../../src/schemas/plan.js";
import { estimateStage } from "../../src/engine/index.js";

describe("No Silent Clamp: retry_probability validation", () => {
  it("should reject out-of-range retry_probability at schema validation", () => {
    const outOfRange = {
      id: "stage-1",
      name: "Bad Stage",
      model: "claude-opus-4",
      input_tokens: 100,
      output_tokens: 50,
      thinking_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      batch: false,
      retry_probability: 1.5, // Out of range: > 1
      max_retries: 1,
      asae_gate: false,
      depends_on: [],
      carry_context_from: [],
    };

    expect(() => StageSchema.parse(outOfRange)).toThrow();
  });

  it("should reject negative retry_probability at schema validation", () => {
    const negative = {
      id: "stage-1",
      name: "Negative Stage",
      model: "claude-opus-4",
      input_tokens: 100,
      output_tokens: 50,
      thinking_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      batch: false,
      retry_probability: -0.1, // Out of range: < 0
      max_retries: 1,
      asae_gate: false,
      depends_on: [],
      carry_context_from: [],
    };

    expect(() => StageSchema.parse(negative)).toThrow();
  });

  it("should accept valid retry_probability values", () => {
    const valid = {
      id: "stage-1",
      name: "Good Stage",
      model: "claude-opus-4",
      input_tokens: 100,
      output_tokens: 50,
      thinking_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      batch: false,
      retry_probability: 0.5,
      max_retries: 2,
      asae_gate: false,
      depends_on: [],
      carry_context_from: [],
    };

    expect(() => StageSchema.parse(valid)).not.toThrow();
  });

  it("should accept boundary values 0 and 1", () => {
    const zeroProb = {
      id: "stage-zero",
      name: "No retries",
      model: "claude-opus-4",
      input_tokens: 100,
      output_tokens: 50,
      thinking_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      batch: false,
      retry_probability: 0,
      max_retries: 0,
      asae_gate: false,
      depend_on: [],
      carry_context_from: [],
    };
    expect(() => StageSchema.parse(zeroProb)).not.toThrow();

    const oneProb = {
      id: "stage-one",
      name: "Always retry",
      model: "claude-opus-4",
      input_tokens: 100,
      output_tokens: 50,
      thinking_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      batch: false,
      retry_probability: 1,
      max_retries: 5,
      asae_gate: false,
      depends_on: [],
      carry_context_from: [],
    };
    expect(() => StageSchema.parse(oneProb)).not.toThrow();
  });

  it("should pass valid p value unchanged to engine (no silent transformation)", () => {
    // Build a valid plan with p = 0.3
    const plan = {
      schema_version: 2,
      plan_id: "test-plan",
      plan_name: "Test",
      description: "",
      stages: [
        {
          id: "s1",
          name: "Stage",
          model: "claude-opus-4",
          input_tokens: 1000,
          output_tokens: 500,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retry_probability: 0.3,
          max_retries: 2,
          asae_gate: false,
          depends_on: [],
          carry_context_from: [],
        },
      ],
    };

    const validPlan = PlanSchema.parse(plan);
    const stage = validPlan.stages[0];

    // Verify the stage contains the exact probability (not clamped)
    expect(stage.retry_probability).toBe(0.3);

    // Mock pricing data for the engine
    const mockPricing = {
      model_id: "claude-opus-4",
      generation: "opus-4",
      input_per_mtok_usd: 0.015,
      output_per_mtok_usd: 0.06,
      thinking_per_mtok_usd: 0,
      cache_read_per_mtok_usd: 0.00375,
      cache_write_per_mtok_usd: 0.03,
      batch_discount: 0,
      tokenizer_correction: 1.0,
    };

    // Call engine and verify it uses p as-is
    const result = estimateStage(stage, mockPricing);

    // The envelope should reflect p=0.3, not a clamped value
    // With p=0.3 and max_retries=2, expected_cost includes retry envelope
    expect(result.expected_cost_usd).toBeGreaterThan(result.best_case_usd);
    expect(result.expected_cost_usd).toBeLessThan(result.worst_case_usd);
    // Rough sanity check: expected should be somewhere between best and worst
    expect(result.expected_cost_usd).toBeDefined();
  });

  it("should enforce Zod validation on full plans with out-of-range retry_probability", () => {
    const planWithBadRetry = {
      schema_version: 2,
      plan_id: "bad-plan",
      plan_name: "Out of Range Retry",
      description: "",
      stages: [
        {
          id: "s1",
          name: "Bad",
          model: "claude-opus-4",
          input_tokens: 100,
          output_tokens: 50,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retry_probability: 2.0, // Invalid
          max_retries: 1,
          asae_gate: false,
          depends_on: [],
          carry_context_from: [],
        },
      ],
    };

    expect(() => PlanSchema.parse(planWithBadRetry)).toThrow();
  });
});
