import { z } from "zod";
import { PlanSchema, StageSchema, type Plan } from "../plan.js";

/**
 * Relaxed schema for migration input: accepts both v1 (schema_version: 1)
 * and v2 (schema_version: 2) plans, as well as plans with no version field.
 *
 * This allows the migration function to accept any plan and normalize it to v2.
 */
const PlanSchemaMigrationInput = z.object({
  schema_version: z.union([z.literal(1), z.literal(2)]).optional().default(1),
  plan_id: z.string().min(1),
  plan_name: z.string().min(1),
  description: z.string().optional().default(""),
  stages: z.array(StageSchema).min(1),
});

/**
 * Migrate a v1 plan to v2.
 *
 * For CC v1.0 → v1.1, the migration is minimal:
 * - schema_version: 1 → 2 (always sets to 2, even if input is already v2)
 * - Ensure all stages have carry_context_from and depends_on defaults ([])
 * - All other fields carry over verbatim
 *
 * Accepts both v1 (schema_version: 1) and v2 (schema_version: 2) input plans,
 * and normalizes all to v2.
 *
 * @param planInput - A v1 or v2 plan (may be raw JSON or typed object)
 * @returns A valid v2 Plan
 * @throws Error("CC-MIGRATE-001: ...") if migration is not possible
 */
export function migrateV1ToV2(planInput: unknown): Plan {
  try {
    // Parse with relaxed migration input schema to accept both v1 and v2
    const parsed = PlanSchemaMigrationInput.parse(planInput);

    // Migrate stages: ensure defaults are set
    const migratedStages = parsed.stages.map((stage) => ({
      ...stage,
      carry_context_from: stage.carry_context_from ?? [],
      depends_on: stage.depends_on ?? [],
    }));

    // Build v2 plan with schema_version: 2
    const v2Plan = {
      schema_version: 2,
      plan_id: parsed.plan_id,
      plan_name: parsed.plan_name,
      description: parsed.description,
      stages: migratedStages,
    };

    // Validate against v2 schema
    const validated = PlanSchema.parse(v2Plan);
    return validated;
  } catch (err) {
    if (err instanceof z.ZodError) {
      const details = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      throw new Error(`CC-MIGRATE-001: cannot migrate; plan is malformed: ${details}`);
    }
    if (err instanceof Error) {
      throw new Error(`CC-MIGRATE-001: cannot migrate; plan is malformed: ${err.message}`);
    }
    throw new Error("CC-MIGRATE-001: cannot migrate; plan is malformed: unknown error");
  }
}
