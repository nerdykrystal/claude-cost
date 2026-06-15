import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setDefaultPricing, clearDefaultPricing, estimatePlan, loadPricing } from "../../src/index.js";
import "../../src/pricing/node.js";
import type { Plan, Stage } from "../../src/schemas/plan.js";

describe("clearDefaultPricing (FR-07 / CC-5 + CC-A4 isolation)", () => {
  let originalDb: ReturnType<typeof loadPricing>;

  beforeEach(() => {
    originalDb = loadPricing();
  });

  afterEach(() => {
    // Reset to original bundled pricing for next test
    clearDefaultPricing();
    setDefaultPricing(originalDb);
  });

  function createTestPlan(stages: Partial<Stage>[]): Plan {
    return {
      schema_version: 2,
      plan_id: "test-clear-default",
      plan_name: "Test Plan",
      stages: stages.map((s, i) => ({
        id: s.id ?? `stage-${i}`,
        name: s.name ?? `Stage ${i}`,
        model: s.model ?? "claude-3-5-sonnet-20241022",
        input_tokens: s.input_tokens ?? 100,
        output_tokens: s.output_tokens ?? 100,
        thinking_tokens: s.thinking_tokens ?? 0,
        cache_read_tokens: s.cache_read_tokens ?? 0,
        cache_write_tokens: s.cache_write_tokens ?? 0,
        batch: s.batch ?? false,
        retry_probability: s.retry_probability ?? 0,
        max_retries: s.max_retries ?? 0,
        asae_gate: s.asae_gate ?? false,
        depends_on: s.depends_on ?? [],
        carry_context_from: s.carry_context_from ?? [],
      })),
    };
  }

  it("setDefaultPricing should pollute module state", () => {
    const customDb = { ...originalDb, version: "custom-1.0" };
    setDefaultPricing(customDb);

    const plan = createTestPlan([{ model: "claude-3-5-sonnet-20241022" }]);
    const result = estimatePlan(plan);

    expect(result.pricing_version).toBe("custom-1.0");
  });

  it("clearDefaultPricing should isolate test runs and reset to default behavior", () => {
    const customDb = { ...originalDb, version: "custom-1.0" };
    setDefaultPricing(customDb);

    // Verify pollution
    let plan = createTestPlan([{ model: "claude-3-5-sonnet-20241022" }]);
    let result = estimatePlan(plan);
    expect(result.pricing_version).toBe("custom-1.0");

    // Clear and verify reset
    clearDefaultPricing();

    // Now re-estimate without setting default; should throw or require explicit db
    plan = createTestPlan([{ model: "claude-3-5-sonnet-20241022" }]);
    expect(() => estimatePlan(plan)).toThrow("No pricing database registered");
  });

  it("clearDefaultPricing should allow subsequent tests to set fresh defaults", () => {
    const customDb1 = { ...originalDb, version: "custom-1.0" };
    setDefaultPricing(customDb1);

    let plan = createTestPlan([{ model: "claude-3-5-sonnet-20241022" }]);
    let result = estimatePlan(plan);
    expect(result.pricing_version).toBe("custom-1.0");

    clearDefaultPricing();

    const customDb2 = { ...originalDb, version: "custom-2.0" };
    setDefaultPricing(customDb2);

    plan = createTestPlan([{ model: "claude-3-5-sonnet-20241022" }]);
    result = estimatePlan(plan);
    expect(result.pricing_version).toBe("custom-2.0");
  });
});
