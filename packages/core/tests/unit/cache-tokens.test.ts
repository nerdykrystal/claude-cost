import { describe, it, expect } from "vitest";
import { estimateStage } from "../../src/engine/index.js";
import type { Stage } from "../../src/schemas/plan.js";
import type { ModelPricing } from "../../src/schemas/pricing.js";

describe("Cache token symmetry (FR-04 / CC-A1)", () => {
  const baseStage: Stage = {
    id: "cache-test",
    name: "Cache Test Stage",
    model: "claude-opus-4-7",
    input_tokens: 0,
    output_tokens: 0,
    thinking_tokens: 0,
    cache_read_tokens: 1000,
    cache_write_tokens: 1000,
    batch: false,
    asae_gate: false,
    retry_probability: 0,
    max_retries: 0,
    carry_context_from: [],
  };

  const pricingWithCorrection: ModelPricing = {
    model_id: "claude-opus-4-7",
    provider: "anthropic",
    generation: "opus-4.7",
    input_per_mtok_usd: 15.0,
    output_per_mtok_usd: 75.0,
    thinking_per_mtok_usd: 75.0,
    cache_read_per_mtok_usd: 1.5,
    cache_write_per_mtok_usd: 18.75,
    batch_discount: 0.5,
    tokenizer_correction: 1.35,
    notes: "Opus 4.7 with correction",
  };

  const pricingNoCorrection: ModelPricing = {
    ...pricingWithCorrection,
    tokenizer_correction: 1.0,
  };

  it("cache_read_cost scales with tokenizer_correction under correction=1.35", () => {
    const result = estimateStage(baseStage, pricingWithCorrection);

    // Expected: (cache_read_tokens * correction / PER_MTOK) * rate
    // = (1000 * 1.35 / 1_000_000) * 1.5
    // = (1350 / 1_000_000) * 1.5
    // = 0.001350 * 1.5
    // = 0.002025
    const expected = (1000 * 1.35) / 1_000_000 * 1.5;
    expect(result.cache_read_cost_usd).toBeCloseTo(expected, 9);
    expect(result.cache_read_cost_usd).toBeCloseTo(0.002025, 9);
  });

  it("cache_write_cost scales with tokenizer_correction under correction=1.35", () => {
    const result = estimateStage(baseStage, pricingWithCorrection);

    // Expected: (cache_write_tokens * correction / PER_MTOK) * rate
    // = (1000 * 1.35 / 1_000_000) * 18.75
    // = (1350 / 1_000_000) * 18.75
    // = 0.001350 * 18.75
    // = 0.0253125
    const expected = (1000 * 1.35) / 1_000_000 * 18.75;
    expect(result.cache_write_cost_usd).toBeCloseTo(expected, 9);
    expect(result.cache_write_cost_usd).toBeCloseTo(0.0253125, 9);
  });

  it("cache_read_cost is unaffected when correction=1.0 (no-op baseline)", () => {
    const result = estimateStage(baseStage, pricingNoCorrection);

    // Expected: (1000 * 1.0 / 1_000_000) * 1.5
    // = 0.001 * 1.5
    // = 0.0015
    const expected = (1000 * 1.0) / 1_000_000 * 1.5;
    expect(result.cache_read_cost_usd).toBeCloseTo(expected, 9);
    expect(result.cache_read_cost_usd).toBeCloseTo(0.0015, 9);
  });

  it("cache_write_cost is unaffected when correction=1.0 (no-op baseline)", () => {
    const result = estimateStage(baseStage, pricingNoCorrection);

    // Expected: (1000 * 1.0 / 1_000_000) * 18.75
    // = 0.001 * 18.75
    // = 0.01875
    const expected = (1000 * 1.0) / 1_000_000 * 18.75;
    expect(result.cache_write_cost_usd).toBeCloseTo(expected, 9);
    expect(result.cache_write_cost_usd).toBeCloseTo(0.01875, 9);
  });

  it("cache costs with correction=1.35 scale proportionally to correction factor", () => {
    const resultWith = estimateStage(baseStage, pricingWithCorrection);
    const resultWithout = estimateStage(baseStage, pricingNoCorrection);

    // Ratio should be 1.35 / 1.0 = 1.35
    const readRatio =
      resultWith.cache_read_cost_usd / resultWithout.cache_read_cost_usd;
    const writeRatio =
      resultWith.cache_write_cost_usd / resultWithout.cache_write_cost_usd;

    expect(readRatio).toBeCloseTo(1.35, 9);
    expect(writeRatio).toBeCloseTo(1.35, 9);
  });

  it("subtotal_usd includes scaled cache costs", () => {
    const result = estimateStage(baseStage, pricingWithCorrection);

    // subtotal = input + output + thinking + cache_read + cache_write
    // With correction=1.35 and no input/output/thinking:
    // = 0 + 0 + 0 + 0.002025 + 0.0253125
    // = 0.0273375
    const expected = 0.002025 + 0.0253125;
    expect(result.subtotal_usd).toBeCloseTo(expected, 9);
  });

  it("assumptions array includes disclosure when correction != 1.0", () => {
    const result = estimateStage(baseStage, pricingWithCorrection);

    const assumptions = result.assumptions;
    expect(assumptions.length).toBeGreaterThanOrEqual(2);
    expect(assumptions[0]).toContain("Tokenizer correction");
    expect(assumptions[0]).toContain("1.35");
    expect(assumptions[1]).toContain(
      "Cache tokens use tokenizer_correction symmetric with input/output/thinking"
    );
    expect(assumptions[1]).toContain("Anthropic pricing spec");
    expect(assumptions[1]).toContain("verified 2026-04-26");
  });

  it("assumptions array excludes cache disclosure when correction=1.0", () => {
    const result = estimateStage(baseStage, pricingNoCorrection);

    const assumptions = result.assumptions;
    expect(assumptions.length).toBe(0);
  });

  it("handles zero cache_read_tokens gracefully", () => {
    const stageZeroRead = {
      ...baseStage,
      cache_read_tokens: 0,
    };
    const result = estimateStage(stageZeroRead, pricingWithCorrection);

    expect(result.cache_read_cost_usd).toBe(0);
  });

  it("handles zero cache_write_tokens gracefully", () => {
    const stageZeroWrite = {
      ...baseStage,
      cache_write_tokens: 0,
    };
    const result = estimateStage(stageZeroWrite, pricingWithCorrection);

    expect(result.cache_write_cost_usd).toBe(0);
  });
});
