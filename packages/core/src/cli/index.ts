#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parsePlan, parsePlans } from "../parser/index.js";
import { parseLog } from "../logs/index.js";
import { analyzeVariance, comparePlans, estimatePlan } from "../engine/index.js";
import "../pricing/node.js";
import { listModels, loadPricing, pricingAgeDays } from "../pricing/index.js";
import { toCSV, toJSON, toMarkdown } from "../export/index.js";

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[0] ?? "";
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        flags[a.slice(2)] = argv[++i];
      } else {
        flags[a.slice(2)] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { command, positional, flags };
}

function usage(): string {
  return `claude-cost — estimate and analyze D2R pipeline costs

Usage:
  claude-cost estimate <plan.yaml> [--output <file>] [--format json|csv|markdown]
  claude-cost compare <plan1> <plan2> [...<planN>] [--output <file>] [--format json|csv|markdown]
  claude-cost analyze <plan.yaml> <log.json> [--output <file>] [--format json|csv|markdown] [--provider anthropic|openai|google|generic]
  claude-cost models
  claude-cost pricing
  claude-cost --help

Options:
  --output, -o   Write output to file instead of stdout
  --format, -f   Output format (default: json)
  --provider     Execution log provider (default: generic)
`;
}

function writeOut(content: string, outputPath?: string | boolean) {
  if (typeof outputPath === "string") {
    writeFileSync(resolve(process.cwd(), outputPath), content, "utf-8");
    process.stderr.write(`Wrote ${outputPath}\n`);
  } else {
    process.stdout.write(content + "\n");
  }
}

function formatOutput<T extends object>(data: T, format: string): string {
  if (format === "csv") return toCSV(data as never);
  if (format === "markdown" || format === "md") return toMarkdown(data as never);
  return toJSON(data as never);
}

function loadPlanFile(path: string) {
  const raw = readFileSync(resolve(process.cwd(), path), "utf-8");
  const parsed = parsePlan(raw);
  if (!parsed.ok) {
    process.stderr.write(`Plan parse error in ${path}: ${parsed.error.message}\n`);
    if (parsed.error.details) {
      process.stderr.write(JSON.stringify(parsed.error.details, null, 2) + "\n");
    }
    process.exit(2);
  }
  return parsed.value;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "" || args.flags.help || args.command === "--help" || args.command === "-h") {
    process.stdout.write(usage());
    return;
  }

  const format = (args.flags.format as string) ?? (args.flags.f as string) ?? "json";
  const output = args.flags.output ?? args.flags.o;

  if (args.command === "estimate") {
    if (args.positional.length < 1) {
      process.stderr.write("estimate: expected <plan> argument\n");
      process.exit(1);
    }
    const plan = loadPlanFile(args.positional[0]);
    const estimate = estimatePlan(plan);
    writeOut(formatOutput(estimate, format), output);
    return;
  }

  if (args.command === "compare") {
    if (args.positional.length < 2) {
      process.stderr.write("compare: expected at least 2 plan arguments\n");
      process.exit(1);
    }
    // Support a single file containing multiple YAML docs or a JSON array
    if (args.positional.length === 1) {
      const raw = readFileSync(resolve(process.cwd(), args.positional[0]), "utf-8");
      const parsed = parsePlans(raw);
      if (parsed.successes.length === 0) {
        if (parsed.failures.length > 0) {
          process.stderr.write(`Parse error: ${parsed.failures[0].error.message}\n`);
        } else {
          process.stderr.write("Parse error: no valid plans found\n");
        }
        process.exit(2);
      }
      const report = comparePlans(parsed.successes);
      writeOut(formatOutput(report, format), output);
      return;
    }
    const plans = args.positional.map((p) => loadPlanFile(p));
    const report = comparePlans(plans);
    writeOut(formatOutput(report, format), output);
    return;
  }

  if (args.command === "analyze") {
    if (args.positional.length < 2) {
      process.stderr.write("analyze: expected <plan> <log> arguments\n");
      process.exit(1);
    }
    const plan = loadPlanFile(args.positional[0]);
    const rawLog = readFileSync(resolve(process.cwd(), args.positional[1]), "utf-8");
    const provider = (args.flags.provider as string) ?? "generic";
    const validProviders = ["anthropic", "openai", "google", "generic"] as const;
    type Provider = (typeof validProviders)[number];
    if (!(validProviders as readonly string[]).includes(provider)) {
      process.stderr.write(`Invalid provider: ${provider}\n`);
      process.exit(1);
    }
    const log = parseLog(rawLog, provider as Provider);
    if (!log.ok) {
      process.stderr.write(`Log parse error: ${log.error.message}\n`);
      process.exit(2);
    }
    const report = analyzeVariance(plan, log.value);
    writeOut(formatOutput(report, format), output);
    return;
  }

  if (args.command === "models") {
    const models = listModels();
    process.stdout.write(models.join("\n") + "\n");
    return;
  }

  if (args.command === "pricing") {
    const db = loadPricing();
    const age = pricingAgeDays(db).toFixed(1);
    process.stdout.write(
      JSON.stringify(
        { version: db.version, updated: db.updated, age_days: Number(age), models: db.models.length },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  process.stderr.write(`Unknown command: ${args.command}\n`);
  process.stderr.write(usage());
  process.exit(1);
}

main();
