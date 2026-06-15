import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { estimatePlan, estimateStage } from "../../src/engine/index.js";
import { comparePlans, analyzeVariance } from "../../src/engine/index.js";
import { parsePlan } from "../../src/parser/index.js";
import { parseLog } from "../../src/logs/index.js";
import "../../src/pricing/node.js";
import { getPricing, loadPricing } from "../../src/pricing/index.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Stage } from "../../src/schemas/plan.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(HERE, "../fixtures");

function loadFixture(name: string) {
  return readFileSync(resolve(FIX, name), "utf-8");
}

describe("engine — single stage estimate (FR-02)", () => {
  const haiku = getPricing("claude-haiku-4-5");

  it("computes haiku cost for 1M/1M tokens", () => {
    const stage: Stage = {
      id: "t",
      name: "t",
      model: "claude-haiku-4-5",
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      thinking_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      batch: false,
      retry_probability: 0,
      max_retries: 0,
      asae_gate: false,
      depends_on: [],
      carry_context_from: [],
    };
    const c = estimateStage(stage, haiku);
    // 1M in @ 0.80 + 1M out @ 4.00 = 4.80
    expect(c.subtotal_usd).toBeCloseTo(4.8, 6);
  });

  it("applies batch discount (FR-03)", () => {
    const base: Stage = {
      id: "t", name: "t", model: "claude-haiku-4-5",
      input_tokens: 1_000_000, output_tokens: 1_000_000,
      thinking_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0,
      batch: false, retry_probability: 0, max_retries: 0, asae_gate: false,
      depends_on: [], carry_context_from: [],
    };
    const withBatch = { ...base, batch: true };
    const a = estimateStage(base, haiku);
    const b = estimateStage(withBatch, haiku);
    expect(b.subtotal_usd).toBeLessThan(a.subtotal_usd);
    expect(b.subtotal_usd).toBeCloseTo(a.subtotal_usd * 0.5, 6);
  });

  it("applies Opus 4.7 tokenizer correction (FR-04)", () => {
    const opus47 = getPricing("claude-opus-4-7");
    const opus46 = getPricing("claude-opus-4-6");
    const stage: Stage = {
      id: "t", name: "t", model: "claude-opus-4-7",
      input_tokens: 1_000_000, output_tokens: 0,
      thinking_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0,
      batch: false, retry_probability: 0, max_retries: 0, asae_gate: false,
      depends_on: [], carry_context_from: [],
    };
    const c47 = estimateStage(stage, opus47);
    const c46 = estimateStage({ ...stage, model: "claude-opus-4-6" }, opus46);
    expect(c47.subtotal_usd).toBeGreaterThan(c46.subtotal_usd);
    expect(c47.tokenizer_correction_applied).toBe(1.35);
  });

  it("computes retry envelope: best ≤ expected ≤ worst (FR-05)", () => {
    const stage: Stage = {
      id: "t", name: "t", model: "claude-haiku-4-5",
      input_tokens: 100_000, output_tokens: 50_000,
      thinking_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0,
      batch: false, retry_probability: 0.3, max_retries: 3, asae_gate: true,
      depends_on: [], carry_context_from: [],
    };
    const c = estimateStage(stage, haiku);
    expect(c.best_case_usd).toBeLessThanOrEqual(c.expected_cost_usd);
    expect(c.expected_cost_usd).toBeLessThanOrEqual(c.worst_case_usd);
  });
});

describe("engine — plan rollup (FR-03)", () => {
  it("estimates the D2R mixed plan", () => {
    const r = parsePlan(loadFixture("d2r-plan.yaml"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const e = estimatePlan(r.value);
    expect(e.per_stage.length).toBe(r.value.stages.length);
    expect(e.total_expected_usd).toBeGreaterThan(0);
    expect(e.total_best_case_usd).toBeLessThanOrEqual(e.total_expected_usd);
    expect(e.total_expected_usd).toBeLessThanOrEqual(e.total_worst_case_usd);
  });

  it("surfaces stale-pricing flag when pricing is old", () => {
    const r = parsePlan(loadFixture("simple-plan.yaml"));
    if (!r.ok) throw new Error("parse failed");
    const db = loadPricing();
    const future = new Date(new Date(db.updated).getTime() + 60 * 86400 * 1000);
    const e = estimatePlan(r.value, { asOf: future });
    expect(e.pricing_stale).toBe(true);
  });
});

describe("comparison (FR-06)", () => {
  it("compares multiple plans", () => {
    const a = parsePlan(loadFixture("simple-plan.yaml"));
    const b = parsePlan(loadFixture("d2r-plan.yaml"));
    if (!a.ok || !b.ok) throw new Error("parse failed");
    const report = comparePlans([a.value, b.value]);
    expect(report.plan_ids.length).toBe(2);
    expect(report.per_plan_total_usd.length).toBe(2);
    expect(report.deltas.length).toBe(1);
    expect(report.heatmap.matrix_usd.length).toBe(report.heatmap.stage_ids.length);
  });

  it("rejects <2 plans", () => {
    const a = parsePlan(loadFixture("simple-plan.yaml"));
    if (!a.ok) throw new Error("parse");
    expect(() => comparePlans([a.value])).toThrow();
  });
});

describe("variance (FR-07)", () => {
  it("analyzes variance for simple plan", () => {
    const p = parsePlan(loadFixture("simple-plan.yaml"));
    const l = parseLog(loadFixture("execution-log.json"));
    if (!p.ok || !l.ok) throw new Error("fixture parse");
    const v = analyzeVariance(p.value, l.value);
    expect(v.per_stage.length).toBe(1);
    expect(v.absolute_percentage_error).toBeGreaterThanOrEqual(0);
  });
});

describe("property-based invariants", () => {
  const haiku = getPricing("claude-haiku-4-5");

  it("cost is never negative", () => {
    fc.assert(fc.property(
      fc.record({
        input: fc.integer({ min: 0, max: 10_000_000 }),
        output: fc.integer({ min: 0, max: 10_000_000 }),
        thinking: fc.integer({ min: 0, max: 1_000_000 }),
        cacheRead: fc.integer({ min: 0, max: 1_000_000 }),
        cacheWrite: fc.integer({ min: 0, max: 1_000_000 }),
        batch: fc.boolean(),
      }),
      ({ input, output, thinking, cacheRead, cacheWrite, batch }) => {
        const stage: Stage = {
          id: "t", name: "t", model: "claude-haiku-4-5",
          input_tokens: input, output_tokens: output, thinking_tokens: thinking,
          cache_read_tokens: cacheRead, cache_write_tokens: cacheWrite,
          batch, retry_probability: 0, max_retries: 0, asae_gate: false,
          depends_on: [], carry_context_from: [],
        };
        const c = estimateStage(stage, haiku);
        return c.subtotal_usd >= 0 && c.best_case_usd >= 0;
      }
    ), { numRuns: 200 });
  });

  it("cost(batch) ≤ cost(no-batch) for same inputs", () => {
    fc.assert(fc.property(
      fc.record({
        input: fc.integer({ min: 0, max: 1_000_000 }),
        output: fc.integer({ min: 0, max: 1_000_000 }),
      }),
      ({ input, output }) => {
        const base: Stage = {
          id: "t", name: "t", model: "claude-haiku-4-5",
          input_tokens: input, output_tokens: output, thinking_tokens: 0,
          cache_read_tokens: 0, cache_write_tokens: 0,
          batch: false, retry_probability: 0, max_retries: 0, asae_gate: false,
          depends_on: [], carry_context_from: [],
        };
        const a = estimateStage(base, haiku);
        const b = estimateStage({ ...base, batch: true }, haiku);
        return b.subtotal_usd <= a.subtotal_usd + 1e-9;
      }
    ), { numRuns: 100 });
  });

  it("cost(retry) ≥ cost(no-retry) for same plan", () => {
    fc.assert(fc.property(
      fc.record({
        p: fc.double({ min: 0, max: 1, noNaN: true }),
        r: fc.integer({ min: 0, max: 5 }),
        input: fc.integer({ min: 100, max: 100_000 }),
        output: fc.integer({ min: 100, max: 100_000 }),
      }),
      ({ p, r, input, output }) => {
        const base: Stage = {
          id: "t", name: "t", model: "claude-haiku-4-5",
          input_tokens: input, output_tokens: output, thinking_tokens: 0,
          cache_read_tokens: 0, cache_write_tokens: 0,
          batch: false, retry_probability: 0, max_retries: 0, asae_gate: false,
          depends_on: [], carry_context_from: [],
        };
        const withRetry = { ...base, retry_probability: p, max_retries: r, asae_gate: true };
        const a = estimateStage(base, haiku);
        const b = estimateStage(withRetry, haiku);
        return b.expected_cost_usd >= a.expected_cost_usd - 1e-9 && b.worst_case_usd >= a.worst_case_usd - 1e-9;
      }
    ), { numRuns: 100 });
  });

  it("Opus 4.7 ≥ Opus 4.6 for equivalent pipelines", () => {
    const opus47 = getPricing("claude-opus-4-7");
    const opus46 = getPricing("claude-opus-4-6");
    fc.assert(fc.property(
      fc.record({
        input: fc.integer({ min: 1, max: 1_000_000 }),
        output: fc.integer({ min: 1, max: 1_000_000 }),
      }),
      ({ input, output }) => {
        const stage: Stage = {
          id: "t", name: "t", model: "claude-opus-4-6",
          input_tokens: input, output_tokens: output, thinking_tokens: 0,
          cache_read_tokens: 0, cache_write_tokens: 0,
          batch: false, retry_probability: 0, max_retries: 0, asae_gate: false,
          depends_on: [], carry_context_from: [],
        };
        const c46 = estimateStage(stage, opus46);
        const c47 = estimateStage({ ...stage, model: "claude-opus-4-7" }, opus47);
        return c47.subtotal_usd >= c46.subtotal_usd - 1e-9;
      }
    ), { numRuns: 100 });
  });
});
