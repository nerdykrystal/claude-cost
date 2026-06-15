import { describe, it, expect } from "vitest";
import { migrateV1ToV2 } from "../../src/schemas/migrations/v1-to-v2.js";
import { PlanSchema } from "../../src/schemas/plan.js";

describe("Schema Migration: v1 → v2", () => {
  it("should migrate a valid v1 plan to v2", () => {
    const v1Plan = {
      schema_version: 1,
      plan_id: "plan-001",
      plan_name: "Test Plan v1",
      description: "A v1 plan",
      stages: [
        {
          id: "stage-001",
          name: "Stage 1",
          model: "claude-opus-4",
          input_tokens: 1000,
          output_tokens: 500,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retry_probability: 0.1,
          max_retries: 2,
          asae_gate: false,
        },
      ],
    };

    const migrated = migrateV1ToV2(v1Plan);

    expect(migrated.schema_version).toBe(2);
    expect(migrated.plan_id).toBe("plan-001");
    expect(migrated.plan_name).toBe("Test Plan v1");
    expect(migrated.stages[0].carry_context_from).toEqual([]);
    expect(migrated.stages[0].depends_on).toEqual([]);
  });

  it("should preserve all stage data verbatim during migration", () => {
    const v1Plan = {
      schema_version: 1,
      plan_id: "plan-002",
      plan_name: "Complex Plan",
      description: "A plan with caching and batching",
      stages: [
        {
          id: "stage-a",
          name: "Encoder",
          model: "claude-opus-4-20250514",
          input_tokens: 5000,
          output_tokens: 2000,
          thinking_tokens: 1000,
          cache_read_tokens: 500,
          cache_write_tokens: 600,
          batch: true,
          retry_probability: 0.05,
          max_retries: 1,
          asae_gate: true,
        },
      ],
    };

    const migrated = migrateV1ToV2(v1Plan);

    const stage = migrated.stages[0];
    expect(stage.id).toBe("stage-a");
    expect(stage.name).toBe("Encoder");
    expect(stage.model).toBe("claude-opus-4-20250514");
    expect(stage.input_tokens).toBe(5000);
    expect(stage.output_tokens).toBe(2000);
    expect(stage.thinking_tokens).toBe(1000);
    expect(stage.cache_read_tokens).toBe(500);
    expect(stage.cache_write_tokens).toBe(600);
    expect(stage.batch).toBe(true);
    expect(stage.retry_probability).toBe(0.05);
    expect(stage.max_retries).toBe(1);
    expect(stage.asae_gate).toBe(true);
  });

  it("should pass v2 plans through unchanged", () => {
    const v2Plan = {
      schema_version: 2,
      plan_id: "plan-003",
      plan_name: "Native v2 Plan",
      description: "Created with v2 schema",
      stages: [
        {
          id: "stage-x",
          name: "Step 1",
          model: "claude-opus-4",
          input_tokens: 1000,
          output_tokens: 500,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retry_probability: 0,
          max_retries: 0,
          asae_gate: false,
          carry_context_from: [],
          depends_on: [],
        },
      ],
    };

    const migrated = migrateV1ToV2(v2Plan);

    expect(migrated.schema_version).toBe(2);
    expect(migrated).toEqual(v2Plan);
  });

  it("should reject unknown schema_version", () => {
    const malformedPlan = {
      schema_version: 3,
      plan_id: "plan-bad",
      plan_name: "Invalid Schema",
      description: "",
      stages: [
        {
          id: "stage-1",
          name: "S1",
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
          carry_context_from: [],
          depends_on: [],
        },
      ],
    };

    expect(() => migrateV1ToV2(malformedPlan)).toThrow("CC-MIGRATE-001");
  });

  it("should reject plan without required fields", () => {
    const incomplete = {
      plan_id: "incomplete",
      plan_name: "No stages",
      stages: [],
    };

    expect(() => migrateV1ToV2(incomplete)).toThrow("CC-MIGRATE-001");
  });

  it("should handle v1 plan with missing optional schema_version", () => {
    const v1PlanNoVersion = {
      plan_id: "plan-004",
      plan_name: "Implicit v1",
      description: "No schema_version field",
      stages: [
        {
          id: "s1",
          name: "Step",
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
        },
      ],
    };

    const migrated = migrateV1ToV2(v1PlanNoVersion);
    expect(migrated.schema_version).toBe(2);
    expect(migrated.plan_id).toBe("plan-004");
  });
});
