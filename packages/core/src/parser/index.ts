import YAML from "yaml";
import { PlanSchema, type Plan } from "../schemas/plan.js";
import type { ParseError, Result } from "../schemas/result.js";

export type PlanFormat = "yaml" | "markdown" | "json" | "auto";

/**
 * Parse a D2R plan document.
 *
 * Supports:
 * - YAML (full document is a plan)
 * - JSON (object)
 * - Markdown (plan is in the first ```yaml or ```json fenced block)
 */
export function parsePlan(rawText: string, format: PlanFormat = "auto"): Result<Plan, ParseError> {
  const fmt = format === "auto" ? detectFormat(rawText) : format;
  try {
    let doc: unknown;
    if (fmt === "json") {
      doc = JSON.parse(rawText);
    } else if (fmt === "markdown") {
      const block = extractFencedBlock(rawText);
      if (!block) {
        return {
          ok: false,
          error: {
            kind: "parse_error",
            message: "No yaml or json fenced block found in markdown input.",
          },
        };
      }
      doc = block.lang === "json" ? JSON.parse(block.body) : YAML.parse(block.body);
    } else {
      doc = YAML.parse(rawText);
    }
    const validated = PlanSchema.safeParse(doc);
    if (!validated.success) {
      return {
        ok: false,
        error: {
          kind: "parse_error",
          message: "Plan does not match D2R schema.",
          details: validated.error.issues,
        },
      };
    }
    return { ok: true, value: validated.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: {
        kind: "parse_error",
        message: `Failed to parse plan (${fmt}): ${message}`,
      },
    };
  }
}

function detectFormat(text: string): PlanFormat {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{")) return "json";

  // Check for fenced blocks first (indicates markdown)
  if (/```(yaml|json)/i.test(trimmed)) return "markdown";

  // Skip leading YAML comment lines (# at start of line) to find actual content
  const lines = trimmed.split("\n");
  let contentStart = 0;
  while (contentStart < lines.length && lines[contentStart].trim().startsWith("#")) {
    contentStart++;
  }

  const firstContentLine = contentStart < lines.length ? lines[contentStart].trim() : "";

  // If after skipping comment lines, we have YAML syntax (key:), treat as YAML
  if (firstContentLine && /^\w+\s*:/.test(firstContentLine)) return "yaml";

  // If we have no content after skipping comments, assume YAML
  if (contentStart >= lines.length) return "yaml";

  // If the first non-comment line is a markdown heading (# followed by space),
  // and no fenced blocks, it's markdown
  if (/^#+\s/.test(firstContentLine)) return "markdown";

  // Default to YAML
  return "yaml";
}

function extractFencedBlock(md: string): { lang: "yaml" | "json"; body: string } | null {
  const match = md.match(/```(yaml|json)\s*\n([\s\S]*?)\n```/i);
  if (!match) return null;
  return { lang: match[1].toLowerCase() as "yaml" | "json", body: match[2] };
}

export interface ParsePlansResult {
  successes: Plan[];
  failures: Array<{ input: string | unknown; error: { code: string; message: string } }>;
}

/**
 * Parse multiple plans from a YAML multi-document stream or a JSON array.
 * Accumulates all successes and failures rather than throwing on first error.
 */
export function parsePlans(rawText: string): ParsePlansResult {
  const trimmed = rawText.trimStart();
  const result: ParsePlansResult = { successes: [], failures: [] };

  try {
    if (trimmed.startsWith("[")) {
      let arr: unknown;
      try {
        arr = JSON.parse(rawText);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.failures.push({
          input: rawText,
          error: { code: "parse_error", message: `JSON parse failed: ${message}` },
        });
        return result;
      }

      if (!Array.isArray(arr)) {
        result.failures.push({
          input: arr,
          error: { code: "parse_error", message: "Expected JSON array of plans." },
        });
        return result;
      }

      for (let i = 0; i < arr.length; i++) {
        const parsed = PlanSchema.safeParse(arr[i]);
        if (!parsed.success) {
          result.failures.push({
            input: arr[i],
            error: {
              code: "schema_validation_error",
              message: `Plan ${i} failed schema validation.`,
            },
          });
        } else {
          result.successes.push(parsed.data);
        }
      }
      return result;
    }

    let docs: ReturnType<typeof YAML.parseAllDocuments>;
    try {
      docs = YAML.parseAllDocuments(rawText);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.failures.push({
        input: rawText,
        error: { code: "parse_error", message: `YAML parse failed: ${message}` },
      });
      return result;
    }

    for (let i = 0; i < docs.length; i++) {
      const js = docs[i].toJS();
      if (js === null || js === undefined) continue;

      const parsed = PlanSchema.safeParse(js);
      if (!parsed.success) {
        result.failures.push({
          input: js,
          error: {
            code: "schema_validation_error",
            message: `Plan ${i} failed schema validation.`,
          },
        });
      } else {
        result.successes.push(parsed.data);
      }
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.failures.push({
      input: rawText,
      error: { code: "parse_error", message },
    });
    return result;
  }
}
