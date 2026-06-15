import { z } from "zod";

export const ModelPricingSchema = z.object({
  model_id: z.string(),
  provider: z.string(),
  generation: z.string().optional(),
  input_per_mtok_usd: z.number().nonnegative(),
  output_per_mtok_usd: z.number().nonnegative(),
  thinking_per_mtok_usd: z.number().nonnegative().default(0),
  cache_read_per_mtok_usd: z.number().nonnegative().default(0),
  cache_write_per_mtok_usd: z.number().nonnegative().default(0),
  batch_discount: z.number().min(0).max(1).default(0.5),
  tokenizer_correction: z.number().positive().default(1.0),
  notes: z.string().optional(),
});

export const PricingDatabaseSchema = z.object({
  version: z.string(),
  updated: z.string(),
  models: z.array(ModelPricingSchema),
});

export type ModelPricing = z.infer<typeof ModelPricingSchema>;
export type PricingDatabase = z.infer<typeof PricingDatabaseSchema>;
