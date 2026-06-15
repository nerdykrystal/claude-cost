import { describe, it, expect } from "vitest";
import "../../src/pricing/node.js";
import { estimatePlan, analyzeVariance } from "../../src/engine/index.js";
import type { Plan, Stage } from "../../src/schemas/plan.js";
import type { ExecutionLog } from "../../src/schemas/log.js";

describe("carry-context 3-stage integration", () => {
  function makeStage(
    id: string,
    name: string,
    inputTokens: number,
    outputTokens: number,
    carryContextFrom: string[] = [],
    dependsOn: string[] = [],
  ): Stage {
    return {
      id,
      name,
      model: "claude-opus-4-7",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      thinking_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      batch: false,
      retry_probability: 0,
      max_retries: 0,
      asae_gate: false,
      depends_on: dependsOn,
      carry_context_from: carryContextFrom,
    };
  }

  it("Test 1: full estimate emits stage costs computed from effective tokens (A→B carries A's output)", () => {
    // A: input=100, output=200
    // B: input=50, carries context from A → effective input = 50 + 200 = 250
    const plan: Plan = {
      schema_version: 1,
      plan_id: "test-carry-1",
      plan_name: "3-stage with carry",
      stages: [
        makeStage("A", "Stage A", 100, 200),
        makeStage("B", "Stage B", 50, 100, ["A"]),
        makeStage("C", "Stage C", 30, 150),
      ],
    };

    const result = estimatePlan(plan);

    // Stage A: should use raw input_tokens=100
    const stageACost = result.per_stage.find((s) => s.stage_id === "A")!;
    expect(stageACost).toBeDefined();
    expect(stageACost.input_cost_usd).toBeGreaterThan(0);

    // Stage B: should use effective input = 50 + 200 = 250
    const stageBCost = result.per_stage.find((s) => s.stage_id === "B")!;
    expect(stageBCost).toBeDefined();
    // B's effective input is 5x larger than A's (250 vs 100),
    // so B's input cost should be ~5x A's (before tokenizer correction)
    // This verifies carry_context is being applied
    expect(stageBCost.input_cost_usd).toBeGreaterThan(stageACost.input_cost_usd * 2);

    // Stage C: no carry_context_from, uses raw input=30
    const stageCCost = result.per_stage.find((s) => s.stage_id === "C")!;
    expect(stageCCost).toBeDefined();
    expect(stageCCost.input_cost_usd).toBeGreaterThan(0);
  });

  it("Test 2: removing carry_context_from from B reverts to raw input_tokens", () => {
    // Same as test 1, but without carry_context_from in B
    const planWithCarry: Plan = {
      schema_version: 1,
      plan_id: "test-carry-2a",
      plan_name: "3-stage with carry",
      stages: [
        makeStage("A", "Stage A", 100, 200),
        makeStage("B", "Stage B", 50, 100, ["A"]),
        makeStage("C", "Stage C", 30, 150),
      ],
    };

    const planWithoutCarry: Plan = {
      schema_version: 1,
      plan_id: "test-carry-2b",
      plan_name: "3-stage without carry",
      stages: [
        makeStage("A", "Stage A", 100, 200),
        makeStage("B", "Stage B", 50, 100), // NO carry_context_from
        makeStage("C", "Stage C", 30, 150),
      ],
    };

    const resultWith = estimatePlan(planWithCarry);
    const resultWithout = estimatePlan(planWithoutCarry);

    const stageBWithCarry = resultWith.per_stage.find((s) => s.stage_id === "B")!;
    const stageBWithoutCarry = resultWithout.per_stage.find((s) => s.stage_id === "B")!;

    expect(stageBWithCarry).toBeDefined();
    expect(stageBWithoutCarry).toBeDefined();
    // B with carry should have higher input cost than B without carry
    expect(stageBWithCarry.input_cost_usd).toBeGreaterThan(
      stageBWithoutCarry.input_cost_usd
    );
  });

  it("Test 3: analyzeVariance still works (no carry_context interference)", () => {
    const plan: Plan = {
      schema_version: 1,
      plan_id: "test-carry-variance",
      plan_name: "variance with carry",
      stages: [
        makeStage("A", "Stage A", 100, 200),
        makeStage("B", "Stage B", 50, 100, ["A"]),
      ],
    };

    // Create a dummy execution log
    const log: ExecutionLog = {
      run_id: "run-123",
      stages: [
        {
          stage_id: "A",
          model: "claude-opus-4-7",
          input_tokens: 100,
          output_tokens: 200,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 0,
        },
        {
          stage_id: "B",
          model: "claude-opus-4-7",
          input_tokens: 50,
          output_tokens: 100,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          batch: false,
          retries: 0,
        },
      ],
    };

    const variance = analyzeVariance(plan, log);
    expect(variance).toBeDefined();
    expect(variance.per_stage.length).toBe(2);
    expect(variance.per_stage[0].stage_id).toBe("A");
    expect(variance.per_stage[1].stage_id).toBe("B");
  });

  it("Test 4: multiple carry_context_from sources sum correctly", () => {
    // A: output=100, B: output=50, C: carries from A and B → effective = base + 100 + 50
    // Compare C's cost in three scenarios
    const planNone: Plan = {
      schema_version: 1,
      plan_id: "test-multi-0",
      plan_name: "multi-source carry none",
      stages: [
        makeStage("A", "Stage A", 50, 100),
        makeStage("B", "Stage B", 30, 50),
        makeStage("C", "Stage C", 20, 75), // carries from neither
      ],
    };

    const planOne: Plan = {
      schema_version: 1,
      plan_id: "test-multi-1",
      plan_name: "multi-source carry one",
      stages: [
        makeStage("A", "Stage A", 50, 100),
        makeStage("B", "Stage B", 30, 50),
        makeStage("C", "Stage C", 20, 75, ["A"]), // carries from A only
      ],
    };

    const planBoth: Plan = {
      schema_version: 1,
      plan_id: "test-multi-2",
      plan_name: "multi-source carry both",
      stages: [
        makeStage("A", "Stage A", 50, 100),
        makeStage("B", "Stage B", 30, 50),
        makeStage("C", "Stage C", 20, 75, ["A", "B"]), // carries from both
      ],
    };

    const resNone = estimatePlan(planNone);
    const resOne = estimatePlan(planOne);
    const resBoth = estimatePlan(planBoth);

    const costNone = resNone.per_stage.find((s) => s.stage_id === "C")!.input_cost_usd;
    const costOne = resOne.per_stage.find((s) => s.stage_id === "C")!.input_cost_usd;
    const costBoth = resBoth.per_stage.find((s) => s.stage_id === "C")!.input_cost_usd;

    // Cost increases as more context is carried
    expect(costOne).toBeGreaterThan(costNone);
    expect(costBoth).toBeGreaterThan(costOne);
  });

  it("Test 5: carry_context_from with depends_on (both edges) detected as DAG", () => {
    // A → B (depends_on), A → B (carry_context_from) — same edge declared twice
    // Should be a valid DAG (not a cycle)
    const plan: Plan = {
      schema_version: 1,
      plan_id: "test-overlap-edges",
      plan_name: "overlapped edges",
      stages: [
        makeStage("A", "Stage A", 100, 200),
        makeStage("B", "Stage B", 50, 100, ["A"], ["A"]), // both edges point to A
      ],
    };

    // Should not throw — this is a DAG with redundant edge declarations
    const result = estimatePlan(plan);
    expect(result).toBeDefined();
    expect(result.per_stage.length).toBe(2);
  });

  it("Test 6: carry_context_from with unknown stage_id throws CC-SCHEMA-002", () => {
    const plan: Plan = {
      schema_version: 1,
      plan_id: "test-unknown-carry",
      plan_name: "unknown carry source",
      stages: [
        makeStage("A", "Stage A", 100, 200),
        makeStage("B", "Stage B", 50, 100, ["UNKNOWN"]), // carries from non-existent stage
      ],
    };

    expect(() => estimatePlan(plan)).toThrow("CC-SCHEMA-002");
    expect(() => estimatePlan(plan)).toThrow("unknown stage_id");
  });
});
