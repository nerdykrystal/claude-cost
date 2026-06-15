import { z } from "zod";

export const StageActualSchema = z.object({
  stage_id: z.string(),
  model: z.string(),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  thinking_tokens: z.number().int().nonnegative().default(0),
  cache_read_tokens: z.number().int().nonnegative().default(0),
  cache_write_tokens: z.number().int().nonnegative().default(0),
  batch: z.boolean().default(false),
  retries: z.number().int().nonnegative().default(0),
});

export const ExecutionLogSchema = z.object({
  plan_id: z.string(),
  provider: z.enum(["anthropic", "openai", "google", "generic"]).default("generic"),
  run_id: z.string(),
  pricing_version: z.string().optional(),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
  stages: z.array(StageActualSchema),
});

export type StageActual = z.infer<typeof StageActualSchema>;
export type ExecutionLog = z.infer<typeof ExecutionLogSchema>;
