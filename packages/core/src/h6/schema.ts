import { z } from "zod";

/**
 * H6 JSONL Record Schemas
 *
 * Emitted to step-history.jsonl by onPreToolUse (cost_estimate) and onPostToolUse (cost_actual).
 * kind=h6_recovered emitted on in-process buffer flush success.
 */

const TokensShape = z.object({
  input: z.number().optional(),
  output: z.number().optional(),
  thinking: z.number().optional(),
  cache_read: z.number().optional(),
  cache_write: z.number().optional(),
}).strict();

export type Tokens = z.infer<typeof TokensShape>;

/**
 * H6CostEstimateRecord
 * Emitted by onPreToolUse before tool invocation.
 */
export const H6CostEstimateRecordSchema = z.object({
  ts_iso: z.string().datetime(),
  kind: z.literal("cost_estimate"),
  step_id: z.string(),
  attempt_index: z.number().int().min(0),
  plan_id: z.string(),
  stage_id: z.string().optional(),
  model: z.string().optional(),
  cost_usd: z.number().min(0).optional(),
  expected_tokens: TokensShape.optional(),
  budget_ms: z.number().min(0).optional(),
  cost_estimate_unavailable: z.boolean().optional(),
  reason: z.string().optional(),
}).strict();

export type H6CostEstimateRecord = z.infer<typeof H6CostEstimateRecordSchema>;

/**
 * H6CostActualRecord
 * Emitted by onPostToolUse after tool returns.
 */
export const H6CostActualRecordSchema = z.object({
  ts_iso: z.string().datetime(),
  kind: z.literal("cost_actual"),
  step_id: z.string(),
  attempt_index: z.number().int().min(0),
  plan_id: z.string(),
  stage_id: z.string().optional(),
  model: z.string().optional(),
  cost_usd: z.number().min(0).optional(),
  actual_tokens: TokensShape.optional(),
  latency_ms: z.number().min(0).optional(),
}).strict();

export type H6CostActualRecord = z.infer<typeof H6CostActualRecordSchema>;

/**
 * H6RecoveryRecord
 * Emitted when in-process buffer is flushed successfully.
 */
export const H6RecoveryRecordSchema = z.object({
  ts_iso: z.string().datetime(),
  kind: z.literal("h6_recovered"),
  flushed_count: z.number().int().min(0),
  prior_buffer_size: z.number().int().min(0),
}).strict();

export type H6RecoveryRecord = z.infer<typeof H6RecoveryRecordSchema>;

/**
 * Discriminated union of all H6 record types
 */
export const H6RecordSchema = z.discriminatedUnion("kind", [
  H6CostEstimateRecordSchema,
  H6CostActualRecordSchema,
  H6RecoveryRecordSchema,
]);

export type H6Record = z.infer<typeof H6RecordSchema>;
