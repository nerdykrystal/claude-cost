import { describe, it, expect } from "vitest";
import { parsePlans } from "../../src/parser/index.js";

const validPlan1 = {
  plan_id: "plan-001-valid",
  plan_name: "Valid Plan 1",
  stages: [
    {
      id: "s01",
      name: "Stage 1",
      model: "claude-haiku-4-5",
      input_tokens: 100,
      output_tokens: 50,
    },
  ],
};

const validPlan2 = {
  plan_id: "plan-002-valid",
  plan_name: "Valid Plan 2",
  stages: [
    {
      id: "s01",
      name: "Stage 1",
      model: "claude-haiku-4-5",
      input_tokens: 200,
      output_tokens: 100,
    },
  ],
};

const invalidPlan = {
  // Missing plan_id (required)
  plan_name: "Invalid Plan",
  stages: [
    {
      id: "s01",
      name: "Stage 1",
      model: "claude-haiku-4-5",
      input_tokens: 100,
      output_tokens: 50,
    },
  ],
};

describe("parsePlans accumulation", () => {
  it("accumulates successes and failures from mixed batch [valid, invalid, valid]", () => {
    const input = JSON.stringify([validPlan1, invalidPlan, validPlan2]);
    const result = parsePlans(input);
    expect(result.successes.length).toBe(2);
    expect(result.failures.length).toBe(1);
    expect(result.successes[0].plan_name).toBe("Valid Plan 1");
    expect(result.successes[1].plan_name).toBe("Valid Plan 2");
  });

  it("returns both empty successes and failures for empty input", () => {
    const input = "[]";
    const result = parsePlans(input);
    expect(result.successes.length).toBe(0);
    expect(result.failures.length).toBe(0);
  });

  it("returns all items in failures when all plans are invalid", () => {
    const input = JSON.stringify([invalidPlan, invalidPlan]);
    const result = parsePlans(input);
    expect(result.successes.length).toBe(0);
    expect(result.failures.length).toBe(2);
    expect(result.failures[0].error.code).toBe("schema_validation_error");
  });

  it("accumulates YAML multi-document plans with mixed success/failure", () => {
    const yamlInput = `---
plan_id: plan-yaml-001
plan_name: Plan 1
stages:
  - id: s01
    name: Stage 1
    model: claude-haiku-4-5
    input_tokens: 100
    output_tokens: 50
---
plan_name: Plan 2
stages:
  - id: s01
    name: Stage 1
    model: claude-haiku-4-5
    input_tokens: 100
    output_tokens: 50
---
plan_id: plan-yaml-003
plan_name: Plan 3
stages:
  - id: s01
    name: Stage 1
    model: claude-haiku-4-5
    input_tokens: 100
    output_tokens: 50`;
    const result = parsePlans(yamlInput);
    expect(result.successes.length).toBe(2);
    expect(result.failures.length).toBe(1);
  });

  it("handles malformed JSON by putting error in failures", () => {
    const input = "[invalid json";
    const result = parsePlans(input);
    expect(result.successes.length).toBe(0);
    expect(result.failures.length).toBe(1);
    expect(result.failures[0].error.code).toBe("parse_error");
  });
});
