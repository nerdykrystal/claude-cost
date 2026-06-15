import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { planId } from "../../src/util/plan-id";
import { canonicalJson } from "../../src/util/canonical-json";
import type { Plan } from "../../src/schemas/plan";

describe("planId (property-based tests)", () => {
  it("deterministic: planId(p) === planId(p)", () => {
    const minimalPlan: Plan = {
      schema_version: 1,
      plan_id: "base-id",
      plan_name: "Test Plan",
      description: "",
      stages: [
        {
          id: "stage-1",
          name: "Stage 1",
          model: "claude-opus-4-1",
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

    const hash1 = planId(minimalPlan);
    const hash2 = planId(minimalPlan);
    expect(hash1).toBe(hash2);
  });

  it("64-hex format: matches /^[0-9a-f]{64}$/", () => {
    const minimalPlan: Plan = {
      schema_version: 1,
      plan_id: "base-id",
      plan_name: "Test Plan",
      description: "",
      stages: [
        {
          id: "stage-1",
          name: "Stage 1",
          model: "claude-opus-4-1",
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

    const hash = planId(minimalPlan);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("key-order independent at canonicalization: {a:1,b:2} == {b:2,a:1}", () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { b: 2, a: 1 };

    const canon1 = canonicalJson(obj1);
    const canon2 = canonicalJson(obj2);
    expect(canon1).toBe(canon2);
  });

  it("array-order dependent: [1,2] !== [2,1]", () => {
    const arr1 = canonicalJson([1, 2]);
    const arr2 = canonicalJson([2, 1]);
    expect(arr1).not.toBe(arr2);
  });

  it("property: varying plan_id field produces different hash (200 trials)", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (id1, id2) => {
        if (id1 === id2) return true;

        const plan1: Plan = {
          schema_version: 1,
          plan_id: id1,
          plan_name: "Test",
          description: "",
          stages: [
            {
              id: "s1",
              name: "S1",
              model: "claude-opus-4-1",
              input_tokens: 100,
              output_tokens: 50,
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

        const plan2: Plan = {
          schema_version: 1,
          plan_id: id2,
          plan_name: "Test",
          description: "",
          stages: [
            {
              id: "s1",
              name: "S1",
              model: "claude-opus-4-1",
              input_tokens: 100,
              output_tokens: 50,
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

        const hash1 = planId(plan1);
        const hash2 = planId(plan2);
        return hash1 !== hash2;
      }),
      { numRuns: 200 },
    );
  });
});
