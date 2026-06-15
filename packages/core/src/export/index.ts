import type { ComparisonReport, EstimateResult, VarianceReport } from "../schemas/result.js";

/** FR-08: Export results in JSON. */
export function toJSON(data: EstimateResult | VarianceReport | ComparisonReport): string {
  return JSON.stringify(data, null, 2);
}

/** FR-08: Export results in CSV. */
export function toCSV(data: EstimateResult | VarianceReport | ComparisonReport): string {
  if (isEstimate(data)) return estimateToCSV(data);
  if (isVariance(data)) return varianceToCSV(data);
  return comparisonToCSV(data);
}

/** FR-08: Export as human-readable Markdown report. */
export function toMarkdown(data: EstimateResult | VarianceReport | ComparisonReport): string {
  if (isEstimate(data)) return estimateToMarkdown(data);
  if (isVariance(data)) return varianceToMarkdown(data);
  return comparisonToMarkdown(data);
}

function isEstimate(d: unknown): d is EstimateResult {
  return typeof d === "object" && d !== null && "total_expected_usd" in d && "per_stage" in d;
}
function isVariance(d: unknown): d is VarianceReport {
  return typeof d === "object" && d !== null && "absolute_percentage_error" in d;
}

function csvEscape(v: string | number | boolean): string {
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function estimateToCSV(e: EstimateResult): string {
  const header = [
    "plan_id",
    "stage_id",
    "stage_name",
    "model",
    "input_cost_usd",
    "output_cost_usd",
    "thinking_cost_usd",
    "cache_read_cost_usd",
    "cache_write_cost_usd",
    "subtotal_usd",
    "best_case_usd",
    "expected_cost_usd",
    "worst_case_usd",
    "tokenizer_correction",
    "batch_discount",
  ];
  const rows = e.per_stage.map((s) => [
    e.plan_id,
    s.stage_id,
    s.stage_name,
    s.model,
    s.input_cost_usd.toFixed(6),
    s.output_cost_usd.toFixed(6),
    s.thinking_cost_usd.toFixed(6),
    s.cache_read_cost_usd.toFixed(6),
    s.cache_write_cost_usd.toFixed(6),
    s.subtotal_usd.toFixed(6),
    s.best_case_usd.toFixed(6),
    s.expected_cost_usd.toFixed(6),
    s.worst_case_usd.toFixed(6),
    s.tokenizer_correction_applied.toFixed(4),
    s.batch_discount_applied.toFixed(4),
  ]);
  return [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
}

function varianceToCSV(v: VarianceReport): string {
  const header = [
    "plan_id",
    "run_id",
    "stage_id",
    "estimated_usd",
    "actual_usd",
    "variance_usd",
    "variance_pct",
    "attribution",
  ];
  const rows = v.per_stage.map((s) => [
    v.plan_id,
    v.run_id,
    s.stage_id,
    s.estimated_usd.toFixed(6),
    s.actual_usd.toFixed(6),
    s.variance_usd.toFixed(6),
    s.variance_pct.toFixed(2),
    s.attribution.join("; "),
  ]);
  return [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
}

function comparisonToCSV(c: ComparisonReport): string {
  const header = ["plan_id", "total_expected_usd"];
  const rows = c.plan_ids.map((pid, i) => [pid, c.per_plan_total_usd[i].toFixed(6)]);
  return [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
}

function estimateToMarkdown(e: EstimateResult): string {
  const lines: string[] = [];
  lines.push(`# Cost Estimate — ${e.plan_name}`);
  lines.push("");
  lines.push(`- Plan ID: \`${e.plan_id}\``);
  lines.push(`- Pricing version: ${e.pricing_version} (updated ${e.pricing_updated})${e.pricing_stale ? " — **STALE**" : ""}`);
  lines.push(`- Generated: ${e.generated_at}`);
  lines.push("");
  if (e.mixed_opus_generations) {
    lines.push("> **Mixed Opus generations detected.** Opus 4.7 tokenizer correction applied. Cost comparisons across generations must account for tokenizer differences.");
    lines.push("");
  }
  lines.push("## Totals");
  lines.push("");
  lines.push(`| Scenario | USD |`);
  lines.push(`|---|---|`);
  lines.push(`| Best case | $${e.total_best_case_usd.toFixed(4)} |`);
  lines.push(`| Expected | $${e.total_expected_usd.toFixed(4)} |`);
  lines.push(`| Worst case | $${e.total_worst_case_usd.toFixed(4)} |`);
  lines.push("");
  lines.push("## Per-stage breakdown");
  lines.push("");
  lines.push("| Stage | Model | Subtotal USD | Expected USD |");
  lines.push("|---|---|---|---|");
  for (const s of e.per_stage) {
    lines.push(`| ${s.stage_id} — ${s.stage_name} | ${s.model} | $${s.subtotal_usd.toFixed(4)} | $${s.expected_cost_usd.toFixed(4)} |`);
  }
  if (e.assumptions.length > 0) {
    lines.push("");
    lines.push("## Assumptions");
    lines.push("");
    for (const a of e.assumptions) lines.push(`- ${a}`);
  }
  return lines.join("\n");
}

function varianceToMarkdown(v: VarianceReport): string {
  const lines: string[] = [];
  lines.push(`# Variance Report — ${v.plan_id} / run ${v.run_id}`);
  lines.push("");
  lines.push(`- Estimated: $${v.total_estimated_usd.toFixed(4)}`);
  lines.push(`- Actual: $${v.total_actual_usd.toFixed(4)}`);
  lines.push(`- Variance: $${v.total_variance_usd.toFixed(4)} (${v.total_variance_pct.toFixed(2)}%)`);
  lines.push(`- Absolute percentage error: ${v.absolute_percentage_error.toFixed(2)}%`);
  lines.push("");
  lines.push("## Per-stage variance");
  lines.push("");
  lines.push("| Stage | Estimated | Actual | Δ USD | Δ % | Attribution |");
  lines.push("|---|---|---|---|---|---|");
  for (const s of v.per_stage) {
    lines.push(
      `| ${s.stage_id} | $${s.estimated_usd.toFixed(4)} | $${s.actual_usd.toFixed(4)} | $${s.variance_usd.toFixed(4)} | ${s.variance_pct.toFixed(2)}% | ${s.attribution.join("; ") || "—"} |`,
    );
  }
  return lines.join("\n");
}

function comparisonToMarkdown(c: ComparisonReport): string {
  const lines: string[] = [];
  lines.push(`# Plan Comparison`);
  lines.push("");
  lines.push(`- Plans compared: ${c.plan_ids.length}`);
  lines.push(`- Cheapest: **${c.min_plan_id}**`);
  lines.push(`- Most expensive: **${c.max_plan_id}**`);
  lines.push(`- Range: $${c.range_usd.toFixed(4)}`);
  lines.push("");
  lines.push("## Per-plan totals");
  lines.push("");
  lines.push("| Plan | Total expected USD |");
  lines.push("|---|---|");
  for (let i = 0; i < c.plan_ids.length; i++) {
    lines.push(`| ${c.plan_ids[i]} | $${c.per_plan_total_usd[i].toFixed(4)} |`);
  }
  lines.push("");
  lines.push("## Cost-concentration heatmap (stage × plan, USD)");
  lines.push("");
  const header = ["Stage", ...c.heatmap.plan_ids].join(" | ");
  const sep = ["---", ...c.heatmap.plan_ids.map(() => "---")].join(" | ");
  lines.push(`| ${header} |`);
  lines.push(`| ${sep} |`);
  for (let i = 0; i < c.heatmap.stage_ids.length; i++) {
    const row = [
      c.heatmap.stage_ids[i],
      ...c.heatmap.matrix_usd[i].map((x) => (x === null ? "—" : `$${x.toFixed(4)}`)),
    ];
    lines.push(`| ${row.join(" | ")} |`);
  }
  lines.push("");
  lines.push("## Pairwise deltas");
  lines.push("");
  lines.push("| From | To | Δ USD | Δ % |");
  lines.push("|---|---|---|---|");
  for (const d of c.deltas) {
    lines.push(`| ${d.from_plan} | ${d.to_plan} | $${d.delta_usd.toFixed(4)} | ${d.delta_pct.toFixed(2)}% |`);
  }
  return lines.join("\n");
}
