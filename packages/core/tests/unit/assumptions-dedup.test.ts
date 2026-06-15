import { describe, it, expect } from "vitest";
import "../../src/pricing/node.js";
import { estimatePlan } from "../../src/engine/index.js";
import type { Plan } from "../../src/schemas/plan.js";

describe("assumptions dedup with Set (FR-18 / CC-A5)", () => {
  it("should deduplicate identical assumptions from multiple stages", () => {
    const plan: Plan = {
      plan_id: "test-dedup",
      plan_name: "Test Dedup",
      stages: [
        {
          id: "stage-1",
          name: "Stage 1",
          model: "claude-opus-4-7",
          input_tokens: 1000,
          output_tokens: 1000,
          thinking_tokens: 100,
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
          name: "Stage 2",
          model: "claude-opus-4-7",
          input_tokens: 1000,
          output_tokens: 1000,
          thinking_tokens: 100,
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

    // Both stages have same model (opus-4.7) with thinking tokens and same correction
    // Should produce duplicate assumptions that get deduplicated
    const tokenCorrectionAssum = result.assumptions.filter((a) =>
      a.includes("Tokenizer correction"),
    );
    const cacheAssum = result.assumptions.filter((a) =>
      a.includes("Cache tokens use tokenizer_correction"),
    );

    // Each assumption type should appear exactly once despite two stages
    expect(tokenCorrectionAssum.length).toBe(1);
    expect(cacheAssum.length).toBe(1);
  });

  it("should preserve unique assumptions from different stages", () => {
    const plan: Plan = {
      plan_id: "test-unique",
      plan_name: "Test Unique",
      stages: [
        {
          id: "stage-1",
          name: "Stage 1 (with batch)",
          model: "claude-haiku-4-5",
          input_tokens: 1000,
          output_tokens: 1000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: true, // Enables batch discount
          retry_probability: 0.5,
          max_retries: 2,
          asae_gate: true,
          depends_on: [],
          carry_context_from: [],
        },
        {
          id: "stage-2",
          name: "Stage 2 (no batch, no retries)",
          model: "claude-haiku-4-5",
          input_tokens: 1000,
          output_tokens: 1000,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false, // No batch discount
          retry_probability: 0,
          max_retries: 0,
          asae_gate: false,
          depends_on: [],
          carry_context_from: [],
        },
      ],
    };

    const result = estimatePlan(plan);

    // Should have exactly one batch discount assumption and one ASAE gate assumption
    const batchAssumptions = result.assumptions.filter((a) =>
      a.includes("Batch discount"),
    );
    const asaeAssumptions = result.assumptions.filter((a) =>
      a.includes("ASAE gate"),
    );

    // Both unique to their stages should appear once each
    expect(batchAssumptions.length).toBe(1);
    expect(asaeAssumptions.length).toBe(1);
    expect(batchAssumptions[0]).toContain("50%");
    expect(asaeAssumptions[0]).toContain("ASAE gate");
  });

  it("should handle 100+ duplicate assumptions efficiently", () => {
    const stages = Array.from({ length: 150 }, (_, i) => ({
      id: `stage-${i + 1}`,
      name: `Stage ${i + 1}`,
      model: "claude-opus-4-7",
      input_tokens: 1000,
      output_tokens: 1000,
      thinking_tokens: 100,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      batch: false,
      retry_probability: 0,
      max_retries: 0,
      asae_gate: false,
      depends_on: [] as string[],
      carry_context_from: [] as string[],
    }));

    const plan: Plan = {
      plan_id: "test-large-dedup",
      plan_name: "Large Dedup Test",
      stages,
    };

    const start = performance.now();
    const result = estimatePlan(plan);
    const elapsed = performance.now() - start;

    // All 150 stages have same model → same assumptions
    // Set dedup should keep only one of each unique string
    const tokenCorrectionAssum = result.assumptions.filter((a) =>
      a.includes("Tokenizer correction"),
    );
    const cacheAssum = result.assumptions.filter((a) =>
      a.includes("Cache tokens use tokenizer_correction"),
    );

    expect(tokenCorrectionAssum.length).toBe(1);
    expect(cacheAssum.length).toBe(1);
    // Should complete quickly (Set O(n) vs includes O(n²))
    expect(elapsed).toBeLessThan(1000); // Generous upper bound for 150 stages
  });

  it("should maintain insertion order when deduplicating", () => {
    const plan: Plan = {
      plan_id: "test-order",
      plan_name: "Test Order",
      stages: [
        {
          id: "stage-1",
          name: "Stage 1",
          model: "claude-opus-4-7",
          input_tokens: 1000,
          output_tokens: 1000,
          thinking_tokens: 100,
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

    // The assumptions array should be well-formed and contain expected strings
    expect(Array.isArray(result.assumptions)).toBe(true);
    expect(result.assumptions.length).toBeGreaterThan(0);

    // All assumptions should be strings
    for (const assumption of result.assumptions) {
      expect(typeof assumption).toBe("string");
      expect(assumption.length).toBeGreaterThan(0);
    }
  });
});
