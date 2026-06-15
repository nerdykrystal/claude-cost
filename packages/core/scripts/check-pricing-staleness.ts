#!/usr/bin/env tsx
/**
 * check-pricing-staleness.ts
 * OQ-05 resolution: 14d warn / 90d fail stale-policy for pricing.json.
 *
 * Reads data/pricing.json and checks snapshot_date field.
 * - Absent: exit 0 with WARN
 * - >90 days old: exit 2 with FATAL
 * - >14 days old: exit 0 with WARN
 * - Otherwise: exit 0 silent
 */

import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pricingPath = resolve(__dirname, "../data/pricing.json");

if (!existsSync(pricingPath)) {
  console.warn("WARN: data/pricing.json not found — skipping staleness check.");
  process.exit(0);
}

let parsed: Record<string, unknown>;
try {
  parsed = JSON.parse(readFileSync(pricingPath, "utf-8")) as Record<string, unknown>;
} catch (err) {
  console.warn("WARN: data/pricing.json could not be parsed — skipping staleness check.");
  process.exit(0);
}

// Accept either snapshot_date or updated (existing field name in v1.0.0 pricing.json)
const dateField =
  (parsed["snapshot_date"] as string | undefined) ??
  (parsed["updated"] as string | undefined);

if (!dateField) {
  console.warn("WARN: pricing.json has no snapshot_date field — skipping staleness check.");
  process.exit(0);
}

const snapshotDate = new Date(dateField);
if (isNaN(snapshotDate.getTime())) {
  console.warn(`WARN: pricing.json snapshot_date is not a valid date: ${dateField}`);
  process.exit(0);
}

const nowMs = Date.now();
const ageMs = nowMs - snapshotDate.getTime();
const ageDays = ageMs / (1000 * 60 * 60 * 24);

if (ageDays > 90) {
  console.error(
    `FATAL: pricing.json is ${Math.floor(ageDays)} days old (snapshot_date: ${dateField}). ` +
      "Exceeds 90-day limit. Update pricing data before continuing."
  );
  process.exit(2);
}

if (ageDays > 14) {
  console.warn(
    `WARN: pricing.json is ${Math.floor(ageDays)} days old (snapshot_date: ${dateField}). ` +
      "Exceeds 14-day freshness recommendation."
  );
  process.exit(0);
}

// Fresh — silent exit
process.exit(0);
