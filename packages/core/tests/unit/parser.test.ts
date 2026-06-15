import { describe, it, expect } from "vitest";
import { parsePlan } from "../../src/parser/index.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(HERE, "../fixtures");

function loadFixture(name: string) {
  return readFileSync(resolve(FIX, name), "utf-8");
}

describe("parser", () => {
  it("parses a simple YAML plan", () => {
    const r = parsePlan(loadFixture("simple-plan.yaml"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.plan_id).toBe("simple-haiku-001");
      expect(r.value.stages.length).toBe(1);
    }
  });

  it("rejects malformed plan", () => {
    const r = parsePlan("not: valid: d2r: plan");
    expect(r.ok).toBe(false);
  });

  it("parses markdown with fenced yaml block", () => {
    const md = `# Plan\n\n\`\`\`yaml\nplan_id: md-plan\nplan_name: From Markdown\nstages:\n  - id: s01\n    name: step\n    model: claude-haiku-4-5\n    input_tokens: 100\n    output_tokens: 50\n\`\`\`\n`;
    const r = parsePlan(md, "markdown");
    expect(r.ok).toBe(true);
  });
});
