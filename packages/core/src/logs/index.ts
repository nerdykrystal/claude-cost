import { ExecutionLogSchema, type ExecutionLog } from "../schemas/log.js";
import type { ParseError, Result } from "../schemas/result.js";

export type LogProvider = "anthropic" | "openai" | "google" | "generic";

/**
 * Parse a raw execution log into the normalized ExecutionLog shape.
 *
 * For MVP, the `generic` (our native) format is authoritative; Anthropic/OpenAI/Google
 * adapters normalize common response-metadata fields (usage.input_tokens, etc.)
 * into the same shape.
 */
export function parseLog(rawText: string, provider: LogProvider = "generic"): Result<ExecutionLog, ParseError> {
  try {
    const raw = JSON.parse(rawText);
    const normalized = provider === "generic" ? raw : normalize(raw, provider);
    const validated = ExecutionLogSchema.safeParse(normalized);
    if (!validated.success) {
      return {
        ok: false,
        error: {
          kind: "parse_error",
          message: "Execution log does not match schema.",
          details: validated.error.issues,
        },
      };
    }
    return { ok: true, value: validated.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: { kind: "parse_error", message: `Log parse failed: ${message}` } };
  }
}

interface RawAdapter {
  plan_id: string;
  run_id: string;
  started_at?: string;
  finished_at?: string;
  stages: Array<Record<string, unknown>>;
}

function normalize(raw: unknown, provider: LogProvider): unknown {
  const r = raw as RawAdapter;
  if (!r.stages || !Array.isArray(r.stages)) return raw;
  return {
    plan_id: r.plan_id,
    provider,
    run_id: r.run_id,
    started_at: r.started_at,
    finished_at: r.finished_at,
    stages: r.stages.map((s) => normalizeStage(s, provider)),
  };
}

function normalizeStage(s: Record<string, unknown>, provider: LogProvider) {
  // Each provider format maps different usage-object shapes to our canonical fields.
  const usage = (s.usage as Record<string, unknown> | undefined) ?? {};
  const pick = (...keys: string[]): number => {
    for (const k of keys) {
      const v = s[k] ?? usage[k];
      if (typeof v === "number") return v;
    }
    return 0;
  };
  if (provider === "anthropic") {
    return {
      stage_id: s.stage_id,
      model: s.model,
      input_tokens: pick("input_tokens"),
      output_tokens: pick("output_tokens"),
      thinking_tokens: pick("thinking_tokens"),
      cache_read_tokens: pick("cache_read_input_tokens", "cache_read_tokens"),
      cache_write_tokens: pick("cache_creation_input_tokens", "cache_write_tokens"),
      batch: Boolean(s.batch),
      retries: pick("retries"),
    };
  }
  if (provider === "openai") {
    return {
      stage_id: s.stage_id,
      model: s.model,
      input_tokens: pick("prompt_tokens", "input_tokens"),
      output_tokens: pick("completion_tokens", "output_tokens"),
      thinking_tokens: pick("reasoning_tokens", "thinking_tokens"),
      cache_read_tokens: pick("cached_tokens", "cache_read_tokens"),
      cache_write_tokens: pick("cache_write_tokens"),
      batch: Boolean(s.batch),
      retries: pick("retries"),
    };
  }
  if (provider === "google") {
    return {
      stage_id: s.stage_id,
      model: s.model,
      input_tokens: pick("promptTokenCount", "input_tokens"),
      output_tokens: pick("candidatesTokenCount", "output_tokens"),
      thinking_tokens: pick("thoughtsTokenCount", "thinking_tokens"),
      cache_read_tokens: pick("cachedContentTokenCount", "cache_read_tokens"),
      cache_write_tokens: pick("cache_write_tokens"),
      batch: Boolean(s.batch),
      retries: pick("retries"),
    };
  }
  return s;
}
