import { type PricingDatabase, type ModelPricing } from "../schemas/pricing.js";

let customDefault: PricingDatabase | null = null;

/**
 * Register a default pricing database (e.g., from a Node loader or a browser
 * import of data/pricing.json). Browser callers should set this at app init.
 */
export function setDefaultPricing(db: PricingDatabase): void {
  customDefault = db;
}

/**
 * Clear the registered default pricing database. Used in tests to reset
 * module state and isolate test runs from cross-test pollution.
 */
export function clearDefaultPricing(): void {
  customDefault = null;
}

export function loadPricing(custom?: PricingDatabase): PricingDatabase {
  if (custom) return custom;
  if (customDefault) return customDefault;
  throw new Error(
    "No pricing database registered. Call setDefaultPricing(...) in browser contexts, or use the Node loader at @martinez-methods/claude-cost/pricing/node.",
  );
}

export interface PricingError {
  code: string;
  model: string;
  message?: string;
}

export interface PricingResult {
  found: true;
  pricing: ModelPricing;
}

export interface PricingNotFound {
  found: false;
  error: PricingError;
}

/**
 * Get pricing for a model, returning a result object instead of throwing.
 * Use this when you want to accumulate errors across multiple lookups.
 */
export function tryGetPricing(modelId: string, db?: PricingDatabase): PricingResult | PricingNotFound {
  try {
    const pricing = loadPricing(db);
    const match = pricing.models.find((m) => m.model_id === modelId);
    if (!match) {
      return {
        found: false,
        error: {
          code: "CC-PRICING-001",
          model: modelId,
          message: `Unknown model: ${modelId}. Available: ${pricing.models.map((m) => m.model_id).join(", ")}`,
        },
      };
    }
    return {
      found: true,
      pricing: match,
    };
  } catch (err) {
    return {
      found: false,
      error: {
        code: "CC-PRICING-000",
        model: modelId,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

export function getPricing(modelId: string, db?: PricingDatabase): ModelPricing {
  const pricing = loadPricing(db);
  const match = pricing.models.find((m) => m.model_id === modelId);
  if (!match) {
    throw new Error(`Unknown model: ${modelId}. Available: ${pricing.models.map((m) => m.model_id).join(", ")}`);
  }
  return match;
}

export function listModels(db?: PricingDatabase): string[] {
  return loadPricing(db).models.map((m) => m.model_id);
}

export function isStale(db: PricingDatabase, asOf: Date = new Date(), maxDays = 30): boolean {
  const updated = new Date(db.updated);
  const ageDays = (asOf.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > maxDays;
}

export function pricingAgeDays(db: PricingDatabase, asOf: Date = new Date()): number {
  const updated = new Date(db.updated);
  return (asOf.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
}
