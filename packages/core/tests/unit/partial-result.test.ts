import { describe, it, expect } from "vitest";
import { estimatePlan, tryGetPricing, loadPricing } from "../../src/index.js";
import "../../src/pricing/node.js";
import type { Plan } from "../../src/schemas/plan.js";

describe("estimatePlan partial results (FR-16 / CC-6)", () => {
  it("tryGetPricing returns { found: true } for known models", () => {
    const db = loadPricing();
    const result = tryGetPricing("claude-opus-4-7", db);

    if (result.found) {
      expect(result.pricing).toBeDefined();
      expect(result.pricing.model_id).toBe("claude-opus-4-7");
    } else {
      throw new Error("Expected to find known model");
    }
  });

  it("tryGetPricing returns { found: false } for unknown models", () => {
    const db = loadPricing();
    const result = tryGetPricing("unknown-model-xyz", db);

    if (!result.found) {
      expect(result.error.code).toBe("CC-PRICING-001");
      expect(result.error.model).toBe("unknown-model-xyz");
      expect(result.error.message).toContain("Unknown model");
    } else {
      throw new Error("Expected unknown model to fail");
    }
  });

  it("estimatePlan accumulates errors and continues processing", () => {
    const db = loadPricing();
    const plan: Plan = {
      schema_version: 2,
      plan_id: "test-partial-result",
      plan_name: "Partial Result Test",
      stages: [
        {
          id: "valid",
          name: "Valid Stage",
          model: "claude-opus-4-7",
          input_tokens: 100,
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
          id: "invalid",
          name: "Invalid Stage",
          model: "unknown-model",
          input_tokens: 100,
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

    const result = estimatePlan(plan, { pricingDb: db });

    // Should have processed the valid stage
    expect(result.per_stage.length).toBeGreaterThan(0);
    expect(result.per_stage[0].stage_id).toBe("valid");

    // Should mark results as partial
    expect(result.partial_results).toBe(true);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    expect(result.errors![0].model).toBe("unknown-model");
    expect(result.errors![0].code).toBe("CC-PRICING-001");
  });

  it("estimatePlan does not set partial_results when all stages succeed", () => {
    const db = loadPricing();
    const plan: Plan = {
      schema_version: 2,
      plan_id: "test-all-valid",
      plan_name: "All Valid",
      stages: [
        {
          id: "stage1",
          name: "Stage 1",
          model: "claude-opus-4-7",
          input_tokens: 100,
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

    const result = estimatePlan(plan, { pricingDb: db });

    expect(result.per_stage).toHaveLength(1);
    expect(result.partial_results).toBeUndefined();
    expect(result.errors).toBeUndefined();
  });
});
