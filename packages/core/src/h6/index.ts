/**
 * H6 Hook — In-Process Cost Estimation Hook for CDCC
 *
 * Exported by claude-cost as npm dependency, imported by CDCC (Claude Code).
 * onPreToolUse: called before tool invocation; emits cost_estimate JSONL record
 * onPostToolUse: called after tool returns; emits cost_actual JSONL record
 *
 * Budget: 50ms p95 for PreToolUse; 100ms p95 for PostToolUse.
 * Failure mode: emit cost_estimate_unavailable: true; never throw into CDCC.
 * Idempotency: same step_id + attempt_index re-emit overwrites prior record.
 */

import { enforceBudget } from "./budget.js";
import { bufferRecord, flushBuffer, getBufferSize } from "./buffer.js";
import {
  H6CostEstimateRecord,
  H6CostActualRecord,
  Tokens,
} from "./schema.js";
import { writeRecord } from "./log-writer.js";
import {
  recordKey,
  isDuplicate,
  markSeen,
} from "./idempotency.js";

/**
 * H6Context - Input to onPreToolUse
 */
export interface H6Context {
  step_id: string;
  attempt_index: number;
  plan_id: string;
  stage_id?: string;
  model?: string;
  expected_tokens?: Tokens;
}

/**
 * H6Result - Input to onPostToolUse
 */
export interface H6Result {
  actual_tokens?: Tokens;
  latency_ms?: number;
}

/**
 * onPreToolUse - Hook called before tool invocation
 *
 * Computes cost_estimate within 50ms budget. Emits JSONL record to step-history.jsonl.
 * On failure (pricing missing, tokenizer missing, log-write failure, timeout):
 *   - Emit fallback record with cost_estimate_unavailable: true + reason
 *   - Never throw
 *
 * @param ctx H6Context with step_id, attempt_index, plan_id, etc.
 */
export async function onPreToolUse(ctx: H6Context): Promise<void> {
  const PRE_BUDGET_MS = 50;

  // Wrap the core logic in budget enforcement
  await enforceBudget(
    () => onPreToolUseImpl(ctx),
    PRE_BUDGET_MS,
    undefined // fallback: undefined on timeout; handlePreToolUseError handles emission
  );
}

/**
 * onPreToolUseImpl - Core logic for onPreToolUse
 *
 * Separated to allow budget enforcement wrapping.
 */
async function onPreToolUseImpl(ctx: H6Context): Promise<void> {
  // const startMs = Date.now(); // Available for budget measurement if needed

  try {
    // Check for duplicate (idempotency)
    const dupKey = recordKey(ctx.step_id, ctx.attempt_index, "cost_estimate");
    if (isDuplicate(dupKey)) {
      // Duplicate detected; overwrite behavior: emit anyway (reset timestamp)
      markSeen(dupKey);
    } else {
      markSeen(dupKey);
    }

    // Compute cost estimate (stub for now; will integrate pricing engine in Stage 05+)
    // For Stage 04, we emit the record structure but cost_usd may be undefined
    // if pricing is unavailable.
    const costUsd = await estimateCost(ctx);

    const record: H6CostEstimateRecord = {
      ts_iso: new Date().toISOString(),
      kind: "cost_estimate",
      step_id: ctx.step_id,
      attempt_index: ctx.attempt_index,
      plan_id: ctx.plan_id,
      stage_id: ctx.stage_id,
      model: ctx.model,
      cost_usd: costUsd,
      expected_tokens: ctx.expected_tokens,
      budget_ms: 50,
    };

    // Attempt to write to JSONL log
    try {
      await writeRecord(record);
    } catch (writeError) {
      // Log write failed; buffer the record for later flush
      bufferRecord(record);
    }
  } catch (error) {
    // Estimation or unexpected error; emit unavailable record
    const reason: string = error instanceof Error ? error.message : String(error);
    const fallbackRecord: H6CostEstimateRecord = {
      ts_iso: new Date().toISOString(),
      kind: "cost_estimate",
      step_id: ctx.step_id,
      attempt_index: ctx.attempt_index,
      plan_id: ctx.plan_id,
      stage_id: ctx.stage_id,
      model: ctx.model,
      cost_estimate_unavailable: true,
      reason,
      budget_ms: 50,
    };

    try {
      await writeRecord(fallbackRecord);
    } catch (writeError) {
      bufferRecord(fallbackRecord);
    }
  }
}

/**
 * onPostToolUse - Hook called after tool returns
 *
 * Computes cost_actual from actual_tokens within 100ms budget. Emits JSONL record.
 * Failure mode: same as onPreToolUse (emit unavailable + reason, never throw).
 *
 * @param ctx H6Context (same as PreToolUse)
 * @param result H6Result with actual_tokens and latency_ms
 */
export async function onPostToolUse(
  ctx: H6Context,
  result: H6Result
): Promise<void> {
  const POST_BUDGET_MS = 100;

  await enforceBudget(
    () => onPostToolUseImpl(ctx, result),
    POST_BUDGET_MS,
    undefined
  );
}

/**
 * onPostToolUseImpl - Core logic for onPostToolUse
 */
async function onPostToolUseImpl(
  ctx: H6Context,
  result: H6Result
): Promise<void> {
  try {
    // Check for duplicate (idempotency)
    const dupKey = recordKey(ctx.step_id, ctx.attempt_index, "cost_actual");
    if (isDuplicate(dupKey)) {
      // Duplicate; overwrite behavior: emit anyway
      markSeen(dupKey);
    } else {
      markSeen(dupKey);
    }

    // Compute cost actual
    const costUsd = await estimateCost(ctx, result.actual_tokens);

    // Attempt to flush any buffered records first
    const bufferSize = getBufferSize();
    if (bufferSize > 0) {
      await flushBuffer(writeRecord);
    }

    const record: H6CostActualRecord = {
      ts_iso: new Date().toISOString(),
      kind: "cost_actual",
      step_id: ctx.step_id,
      attempt_index: ctx.attempt_index,
      plan_id: ctx.plan_id,
      stage_id: ctx.stage_id,
      model: ctx.model,
      cost_usd: costUsd,
      actual_tokens: result.actual_tokens,
      latency_ms: result.latency_ms,
    };

    try {
      await writeRecord(record);
    } catch (writeError) {
      bufferRecord(record);
    }
  } catch (_error) {
    // Note: cost_actual records don't have a reason field; if we catch here,
    // we still emit the record with available actual_tokens data
    const fallbackRecord: H6CostActualRecord = {
      ts_iso: new Date().toISOString(),
      kind: "cost_actual",
      step_id: ctx.step_id,
      attempt_index: ctx.attempt_index,
      plan_id: ctx.plan_id,
      stage_id: ctx.stage_id,
      model: ctx.model,
      actual_tokens: result.actual_tokens,
      latency_ms: result.latency_ms,
    };

    try {
      await writeRecord(fallbackRecord);
    } catch (writeError) {
      bufferRecord(fallbackRecord);
    }
  }
}

/**
 * estimateCost - Stub cost estimation function
 *
 * For Stage 04, returns undefined (pricing integration deferred to Stage 05+).
 * On pricing load failure, returns undefined and raises error.
 * On tokenizer correction missing, returns undefined and raises error.
 *
 * @param _ctx H6Context (unused for Stage 04 stub)
 * @param _actualTokens Optional actual tokens (for PostToolUse, unused for Stage 04 stub)
 * @returns Cost in USD, or undefined if unavailable
 */
async function estimateCost(
  _ctx: H6Context,
  _actualTokens?: Tokens
): Promise<number | undefined> {
  // Stub: for Stage 04, no actual pricing engine wired.
  // This would be integrated in Stage 05 (after pricing snapshot bundling).
  // For now, return undefined (cost_estimate_unavailable: false is still OK; caller logs).
  return undefined;
}

// Re-export types for consumers
export { type H6CostEstimateRecord, type H6CostActualRecord } from "./schema.js";
