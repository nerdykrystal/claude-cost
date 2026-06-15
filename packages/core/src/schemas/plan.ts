import { z } from "zod";

export const StageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  model: z.string().min(1),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  thinking_tokens: z.number().int().nonnegative().default(0),
  cache_read_tokens: z.number().int().nonnegative().default(0),
  cache_write_tokens: z.number().int().nonnegative().default(0),
  batch: z.boolean().default(false),
  retry_probability: z.number().min(0).max(1).default(0),
  max_retries: z.number().int().min(0).max(10).default(0),
  asae_gate: z.boolean().default(false),
  depends_on: z.array(z.string()).default([]),
  carry_context_from: z.array(z.string()).default([]),
});

export const PlanSchema = z.object({
  schema_version: z.union([z.literal(1), z.literal(2)]).default(2),
  plan_id: z.string().min(1),
  plan_name: z.string().min(1),
  description: z.string().optional().default(""),
  stages: z.array(StageSchema).min(1),
});

export type Stage = z.infer<typeof StageSchema>;
export type Plan = z.infer<typeof PlanSchema>;
