import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { onPreToolUse, onPostToolUse } from "../../src/h6/index.js";
import { H6RecordSchema } from "../../src/h6/schema.js";

/**
 * Integration test for H6 hook
 *
 * Tests full PreToolUse/PostToolUse cycle with temp log file.
 */

let tempLogFile: string;

beforeEach(async () => {
  // Create a temp file for this test
  tempLogFile = path.join(tmpdir(), `h6-test-${Date.now()}.jsonl`);
  process.env.CC_H6_LOG_PATH = tempLogFile;
});

afterEach(async () => {
  // Clean up temp file
  delete process.env.CC_H6_LOG_PATH;
  try {
    await fs.unlink(tempLogFile);
  } catch {
    // File may not exist if test failed early
  }
});

describe("H6 Hook Integration", () => {
  it("onPreToolUse emits cost_estimate record", async () => {
    const ctx = {
      step_id: "step-123",
      attempt_index: 0,
      plan_id: "plan-abc",
      stage_id: "stage-1",
      model: "claude-opus",
      expected_tokens: { input: 100, output: 50 },
    };

    await onPreToolUse(ctx);

    // Read and parse the log file
    const content = await fs.readFile(tempLogFile, "utf-8");
    const lines = content.trim().split("\n").filter((l) => l.length > 0);

    expect(lines.length).toBeGreaterThanOrEqual(1);

    // Parse first line as JSON
    const record = JSON.parse(lines[0]);

    // Validate against schema
    const parsed = H6RecordSchema.parse(record);

    expect(parsed.kind).toBe("cost_estimate");
    expect(parsed.step_id).toBe("step-123");
    expect(parsed.attempt_index).toBe(0);
    expect(parsed.plan_id).toBe("plan-abc");
    expect(parsed.stage_id).toBe("stage-1");
    expect(parsed.model).toBe("claude-opus");
    expect(parsed.ts_iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("onPostToolUse emits cost_actual record", async () => {
    const ctx = {
      step_id: "step-456",
      attempt_index: 0,
      plan_id: "plan-def",
      model: "claude-sonnet",
    };

    const result = {
      actual_tokens: { input: 95, output: 48 },
      latency_ms: 235,
    };

    await onPostToolUse(ctx, result);

    const content = await fs.readFile(tempLogFile, "utf-8");
    const lines = content.trim().split("\n").filter((l) => l.length > 0);

    expect(lines.length).toBeGreaterThanOrEqual(1);

    const record = JSON.parse(lines[0]);
    const parsed = H6RecordSchema.parse(record);

    expect(parsed.kind).toBe("cost_actual");
    expect(parsed.step_id).toBe("step-456");
    expect(parsed.attempt_index).toBe(0);
    expect(parsed.actual_tokens).toEqual({ input: 95, output: 48 });
    expect(parsed.latency_ms).toBe(235);
  });

  it("onPreToolUse then onPostToolUse emits both records", async () => {
    const ctx = {
      step_id: "step-789",
      attempt_index: 0,
      plan_id: "plan-ghi",
      model: "claude-haiku",
    };

    await onPreToolUse(ctx);
    await onPostToolUse(ctx, { actual_tokens: { input: 10, output: 5 } });

    const content = await fs.readFile(tempLogFile, "utf-8");
    const lines = content.trim().split("\n").filter((l) => l.length > 0);

    expect(lines.length).toBeGreaterThanOrEqual(2);

    const record1 = JSON.parse(lines[0]);
    const record2 = JSON.parse(lines[1]);

    expect(record1.kind).toBe("cost_estimate");
    expect(record2.kind).toBe("cost_actual");
    expect(record1.step_id).toBe("step-789");
    expect(record2.step_id).toBe("step-789");
  });

  it("onPreToolUse never throws on failure", async () => {
    // Set invalid log path (should trigger write error)
    process.env.CC_H6_LOG_PATH = "/dev/null/invalid-path-that-does-not-exist.jsonl";

    const ctx = {
      step_id: "step-999",
      attempt_index: 0,
      plan_id: "plan-jkl",
    };

    // Should not throw even though write fails
    await expect(onPreToolUse(ctx)).resolves.toBeUndefined();
  });

  it("onPostToolUse never throws on failure", async () => {
    process.env.CC_H6_LOG_PATH = "/dev/null/invalid-path-that-does-not-exist.jsonl";

    const ctx = {
      step_id: "step-888",
      attempt_index: 0,
      plan_id: "plan-mno",
    };

    await expect(
      onPostToolUse(ctx, { actual_tokens: { input: 5 } })
    ).resolves.toBeUndefined();
  });

  it("both hooks emit ts_iso and budget_ms fields", async () => {
    const ctx = {
      step_id: "step-ts",
      attempt_index: 0,
      plan_id: "plan-ts",
    };

    await onPreToolUse(ctx);

    const content = await fs.readFile(tempLogFile, "utf-8");
    const record = JSON.parse(content.trim());

    expect(record.ts_iso).toBeDefined();
    expect(typeof record.ts_iso).toBe("string");
    expect(record.budget_ms).toBe(50);
  });
});
