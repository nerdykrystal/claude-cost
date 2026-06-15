import { describe, it, expect } from "vitest";
import { detectCycle } from "../../src/engine/cycle-detect.js";
import type { Plan } from "../../src/schemas/plan.js";

describe("cycle-detect", () => {
  it("Test 1: 2-cycle (A→B, B→A) rejected with CC-SCHEMA-001", () => {
    const plan: Plan = {
      schema_version: 1,
      plan_id: "test-2cycle",
      plan_name: "2-cycle",
      stages: [
        {
          id: "A",
          name: "Stage A",
          model: "opus-4",
          input_tokens: 100,
          output_tokens: 50,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retry_probability: 0,
          max_retries: 0,
          asae_gate: false,
          depends_on: ["B"],
          carry_context_from: [],
        },
        {
          id: "B",
          name: "Stage B",
          model: "opus-4",
          input_tokens: 100,
          output_tokens: 50,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retry_probability: 0,
          max_retries: 0,
          asae_gate: false,
          depends_on: ["A"],
          carry_context_from: [],
        },
      ],
    };

    const cycle = detectCycle(plan);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain("A");
    expect(cycle).toContain("B");
  });

  it("Test 2: 3-cycle (A→B, B→C, C→A) rejected with CC-SCHEMA-001 listing all 3", () => {
    const plan: Plan = {
      schema_version: 1,
      plan_id: "test-3cycle",
      plan_name: "3-cycle",
      stages: [
        {
          id: "A",
          name: "Stage A",
          model: "opus-4",
          input_tokens: 100,
          output_tokens: 50,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retry_probability: 0,
          max_retries: 0,
          asae_gate: false,
          depends_on: ["C"],
          carry_context_from: [],
        },
        {
          id: "B",
          name: "Stage B",
          model: "opus-4",
          input_tokens: 100,
          output_tokens: 50,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retry_probability: 0,
          max_retries: 0,
          asae_gate: false,
          depends_on: ["A"],
          carry_context_from: [],
        },
        {
          id: "C",
          name: "Stage C",
          model: "opus-4",
          input_tokens: 100,
          output_tokens: 50,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retry_probability: 0,
          max_retries: 0,
          asae_gate: false,
          depends_on: ["B"],
          carry_context_from: [],
        },
      ],
    };

    const cycle = detectCycle(plan);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain("A");
    expect(cycle).toContain("B");
    expect(cycle).toContain("C");
  });

  it("Test 3: self-cycle (A→A) rejected", () => {
    const plan: Plan = {
      schema_version: 1,
      plan_id: "test-selfcycle",
      plan_name: "self-cycle",
      stages: [
        {
          id: "A",
          name: "Stage A",
          model: "opus-4",
          input_tokens: 100,
          output_tokens: 50,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retry_probability: 0,
          max_retries: 0,
          asae_gate: false,
          depends_on: ["A"],
          carry_context_from: [],
        },
      ],
    };

    const cycle = detectCycle(plan);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain("A");
  });

  it("Test 4: DAG (A→B→C, A→C) accepted (returns null)", () => {
    const plan: Plan = {
      schema_version: 1,
      plan_id: "test-dag",
      plan_name: "DAG",
      stages: [
        {
          id: "A",
          name: "Stage A",
          model: "opus-4",
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
        {
          id: "B",
          name: "Stage B",
          model: "opus-4",
          input_tokens: 100,
          output_tokens: 50,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retry_probability: 0,
          max_retries: 0,
          asae_gate: false,
          depends_on: ["A"],
          carry_context_from: [],
        },
        {
          id: "C",
          name: "Stage C",
          model: "opus-4",
          input_tokens: 100,
          output_tokens: 50,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retry_probability: 0,
          max_retries: 0,
          asae_gate: false,
          depends_on: ["A", "B"],
          carry_context_from: [],
        },
      ],
    };

    const cycle = detectCycle(plan);
    expect(cycle).toBeNull();
  });

  it("Test 5: empty plan accepted (returns null)", () => {
    const plan: Plan = {
      schema_version: 1,
      plan_id: "test-empty",
      plan_name: "empty",
      stages: [
        {
          id: "A",
          name: "Stage A",
          model: "opus-4",
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

    const cycle = detectCycle(plan);
    expect(cycle).toBeNull();
  });

  it("Test 6: cross-edge from carry_context_from AND depends_on combined → cycle detected", () => {
    const plan: Plan = {
      schema_version: 1,
      plan_id: "test-cross",
      plan_name: "cross-edge-cycle",
      stages: [
        {
          id: "A",
          name: "Stage A",
          model: "opus-4",
          input_tokens: 100,
          output_tokens: 50,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retry_probability: 0,
          max_retries: 0,
          asae_gate: false,
          depends_on: ["B"],
          carry_context_from: [],
        },
        {
          id: "B",
          name: "Stage B",
          model: "opus-4",
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
          carry_context_from: ["A"],
        },
      ],
    };

    const cycle = detectCycle(plan);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain("A");
    expect(cycle).toContain("B");
  });

  it("Test 7: cycle in carry_context_from only (no depends_on overlap) → still detected", () => {
    const plan: Plan = {
      schema_version: 1,
      plan_id: "test-context-cycle",
      plan_name: "context-only-cycle",
      stages: [
        {
          id: "A",
          name: "Stage A",
          model: "opus-4",
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
          carry_context_from: ["B"],
        },
        {
          id: "B",
          name: "Stage B",
          model: "opus-4",
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
          carry_context_from: ["A"],
        },
      ],
    };

    const cycle = detectCycle(plan);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain("A");
    expect(cycle).toContain("B");
  });
});
