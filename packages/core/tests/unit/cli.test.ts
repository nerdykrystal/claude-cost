import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, "../..");
const CLI = resolve(PKG_ROOT, "dist/cli/index.js");
const FIX = resolve(PKG_ROOT, "tests/fixtures");

function run(...args: string[]): string {
  return execFileSync("node", [CLI, ...args], { encoding: "utf-8", cwd: PKG_ROOT });
}

describe("CLI wrapper (FR-10)", () => {
  beforeAll(() => {
    if (!existsSync(CLI)) {
      throw new Error(`CLI not built at ${CLI}. Run \`npm run build\` first.`);
    }
  });

  it("estimate emits JSON matching the engine", () => {
    const out = run("estimate", resolve(FIX, "simple-plan.yaml"));
    const parsed = JSON.parse(out);
    expect(parsed.plan_id).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.total_expected_usd).toBeGreaterThan(0);
    expect(parsed.per_stage.length).toBe(1);
  });

  it("models lists bundled models", () => {
    const out = run("models");
    expect(out).toContain("claude-opus-4-7");
    expect(out).toContain("claude-haiku-4-5");
  });

  it("analyze produces a variance report", () => {
    const out = run(
      "analyze",
      resolve(FIX, "simple-plan.yaml"),
      resolve(FIX, "execution-log.json"),
    );
    const parsed = JSON.parse(out);
    expect(parsed.plan_id).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.absolute_percentage_error).toBeGreaterThanOrEqual(0);
  });

  it("compare N plans", () => {
    const out = run(
      "compare",
      resolve(FIX, "simple-plan.yaml"),
      resolve(FIX, "d2r-plan.yaml"),
    );
    const parsed = JSON.parse(out);
    expect(parsed.plan_ids.length).toBe(2);
    expect(parsed.deltas.length).toBe(1);
  });

  it("pricing command shows version metadata", () => {
    const out = run("pricing");
    const parsed = JSON.parse(out);
    expect(parsed.version).toBeTruthy();
    expect(parsed.models).toBeGreaterThan(0);
  });
});
