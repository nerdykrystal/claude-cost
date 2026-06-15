export interface StageCost {
  stage_id: string;
  stage_name: string;
  model: string;
  input_cost_usd: number;
  output_cost_usd: number;
  thinking_cost_usd: number;
  cache_read_cost_usd: number;
  cache_write_cost_usd: number;
  subtotal_usd: number;
  expected_cost_usd: number;
  best_case_usd: number;
  worst_case_usd: number;
  tokenizer_correction_applied: number;
  batch_discount_applied: number;
  assumptions: string[];
}

import { z } from "zod";

export const StageCostSchema = z.object({
  stage_id: z.string(),
  stage_name: z.string(),
  model: z.string(),
  input_cost_usd: z.number(),
  output_cost_usd: z.number(),
  thinking_cost_usd: z.number(),
  cache_read_cost_usd: z.number(),
  cache_write_cost_usd: z.number(),
  subtotal_usd: z.number(),
  expected_cost_usd: z.number(),
  best_case_usd: z.number(),
  worst_case_usd: z.number(),
  tokenizer_correction_applied: z.number(),
  batch_discount_applied: z.number(),
  assumptions: z.array(z.string()),
});

export const ErrorEntrySchema = z.object({
  stage_id: z.string(),
  model: z.string(),
  code: z.string(),
  message: z.string(),
});

export const EstimateResultSchema = z.object({
  plan_id: z.string().regex(/^[0-9a-f]{64}$/),
  plan_name: z.string(),
  pricing_version: z.string(),
  pricing_updated: z.string(),
  pricing_stale: z.boolean(),
  per_stage: z.array(StageCostSchema),
  total_expected_usd: z.number(),
  total_best_case_usd: z.number(),
  total_worst_case_usd: z.number(),
  mixed_opus_generations: z.boolean(),
  assumptions: z.array(z.string()),
  generated_at: z.string(),
  partial_results: z.boolean().optional(),
  errors: z.array(ErrorEntrySchema).optional(),
});

export interface StageCost {
  stage_id: string;
  stage_name: string;
  model: string;
  input_cost_usd: number;
  output_cost_usd: number;
  thinking_cost_usd: number;
  cache_read_cost_usd: number;
  cache_write_cost_usd: number;
  subtotal_usd: number;
  expected_cost_usd: number;
  best_case_usd: number;
  worst_case_usd: number;
  tokenizer_correction_applied: number;
  batch_discount_applied: number;
  assumptions: string[];
}

export interface ErrorEntry {
  stage_id: string;
  model: string;
  code: string;
  message: string;
}

export interface EstimateResult {
  plan_id: string;
  plan_name: string;
  pricing_version: string;
  pricing_updated: string;
  pricing_stale: boolean;
  per_stage: StageCost[];
  total_expected_usd: number;
  total_best_case_usd: number;
  total_worst_case_usd: number;
  mixed_opus_generations: boolean;
  assumptions: string[];
  generated_at: string;
  partial_results?: boolean;
  errors?: ErrorEntry[];
}

export interface VariancePerStage {
  stage_id: string;
  estimated_usd: number;
  actual_usd: number;
  variance_usd: number;
  variance_pct: number;
  attribution: string[];
  confidence?: "high" | "low";
}

export interface VarianceReport {
  plan_id: string;
  run_id: string;
  per_stage: VariancePerStage[];
  total_estimated_usd: number;
  total_actual_usd: number;
  total_variance_usd: number;
  total_variance_pct: number;
  absolute_percentage_error: number;
  generated_at: string;
  assumptions?: string[];
}

export interface ComparisonReport {
  plan_ids: string[];
  per_plan_total_usd: number[];
  min_plan_id: string;
  max_plan_id: string;
  range_usd: number;
  heatmap: {
    stage_ids: string[];
    plan_ids: string[];
    matrix_usd: (number | null)[][];
  };
  deltas: Array<{
    from_plan: string;
    to_plan: string;
    delta_usd: number;
    delta_pct: number;
  }>;
  generated_at: string;
}

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface ParseError {
  kind: "parse_error";
  message: string;
  location?: string;
  details?: unknown;
}
