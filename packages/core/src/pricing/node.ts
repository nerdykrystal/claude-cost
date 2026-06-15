import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PricingDatabaseSchema, type PricingDatabase } from "../schemas/pricing.js";
import { setDefaultPricing } from "./index.js";

let cached: PricingDatabase | null = null;

export function loadBundledPricing(): PricingDatabase {
  if (cached) return cached;
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = resolve(here, "../../data/pricing.json");
  const raw = readFileSync(candidate, "utf-8");
  const parsed = PricingDatabaseSchema.parse(JSON.parse(raw));
  cached = parsed;
  setDefaultPricing(parsed);
  return parsed;
}

// Register bundled pricing as the default on import (Node contexts only).
loadBundledPricing();
