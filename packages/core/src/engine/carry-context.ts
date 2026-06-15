import type { Plan, Stage } from "../schemas/plan.js";
import { validatePlanGraph } from "./cycle-detect.js";

/**
 * Computes the effective input tokens for a stage by summing its base input_tokens
 * with the output_tokens from all upstream stages referenced in carry_context_from.
 *
 * Per spec (TRD-FR-02):
 * effective_input_tokens(X) = base_input_tokens(X) + Σ(output_tokens(Y) for Y ∈ carry_context_from(X))
 *
 * @param stage - The stage to compute effective input tokens for
 * @param plan - The plan containing all stages and their output_tokens
 * @returns The effective input token count
 * @throws Error with code CC-SCHEMA-002 if carry_context_from references an unknown stage_id
 */
export function effectiveInputTokens(stage: Stage, plan: Plan): number {
  // Build a map of stage_id -> output_tokens for O(1) lookup
  const outputTokensMap = new Map<string, number>();
  for (const s of plan.stages) {
    outputTokensMap.set(s.id, s.output_tokens);
  }

  let total = stage.input_tokens;

  for (const contextStageId of stage.carry_context_from) {
    const contextOutputTokens = outputTokensMap.get(contextStageId);
    if (contextOutputTokens === undefined) {
      throw new Error(
        `CC-SCHEMA-002: carry_context_from references unknown stage_id '${contextStageId}' in stage '${stage.id}'`
      );
    }
    total += contextOutputTokens;
  }

  return total;
}

/**
 * Validates the entire plan graph.
 * - Checks for cycles in the dependency graph (both depends_on and carry_context_from)
 * - Checks that all referenced stage_ids exist (CC-SCHEMA-002)
 *
 * Throws on validation errors.
 *
 * @param plan - The plan to validate
 * @throws Error with code CC-SCHEMA-001 if a cycle is detected
 * @throws Error with code CC-SCHEMA-002 if a stage_id reference is unknown
 */
export function validatePlanSchema(plan: Plan): void {
  // Build set of valid stage IDs
  const validStageIds = new Set<string>();
  for (const stage of plan.stages) {
    validStageIds.add(stage.id);
  }

  // Check that all referenced stage_ids exist
  for (const stage of plan.stages) {
    for (const depId of stage.depends_on) {
      if (!validStageIds.has(depId)) {
        throw new Error(
          `CC-SCHEMA-002: depends_on references unknown stage_id '${depId}' in stage '${stage.id}'`
        );
      }
    }
    for (const contextId of stage.carry_context_from) {
      if (!validStageIds.has(contextId)) {
        throw new Error(
          `CC-SCHEMA-002: carry_context_from references unknown stage_id '${contextId}' in stage '${stage.id}'`
        );
      }
    }
  }

  // Check for cycles
  validatePlanGraph(plan);
}
