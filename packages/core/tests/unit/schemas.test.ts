import { describe, it, expect } from "vitest";
import { PlanSchema } from "../../src/schemas/plan.js";
import { ExecutionLogSchema } from "../../src/schemas/log.js";

describe("schemas (PlanSchema / ExecutionLogSchema)", () => {
  it("PlanSchema accepts a minimal valid plan", () => {
    const r = PlanSchema.safeParse({
      plan_id: "p1",
      plan_name: "n",
      stages: [
        {
          id: "s01",
          name: "step",
          model: "claude-haiku-4-5",
          input_tokens: 10,
          output_tokens: 5,
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("PlanSchema rejects missing stages", () => {
    const r = PlanSchema.safeParse({ plan_id: "p1", plan_name: "n" });
    expect(r.success).toBe(false);
  });

  it("ExecutionLogSchema accepts a minimal log without pricing_version", () => {
    const r = ExecutionLogSchema.safeParse({
      plan_id: "p1",
      run_id: "r1",
      stages: [],
    });
    expect(r.success).toBe(true);
  });

  it("ExecutionLogSchema accepts optional pricing_version (FR-17)", () => {
    const r = ExecutionLogSchema.safeParse({
      plan_id: "p1",
      run_id: "r1",
      pricing_version: "2026-04-01",
      stages: [],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.pricing_version).toBe("2026-04-01");
    }
  });

  it("ExecutionLogSchema defaults provider to generic", () => {
    const r = ExecutionLogSchema.safeParse({
      plan_id: "p1",
      run_id: "r1",
      stages: [],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.provider).toBe("generic");
    }
  });
});
