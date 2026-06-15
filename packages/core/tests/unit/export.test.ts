import { describe, it, expect } from "vitest";
import { estimatePlan } from "../../src/engine/index.js";
import { parsePlan } from "../../src/parser/index.js";
import "../../src/pricing/node.js";
import { toCSV, toJSON, toMarkdown } from "../../src/export/index.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(HERE, "../fixtures");

function loadFixture(name: string) {
  return readFileSync(resolve(FIX, name), "utf-8");
}

describe("exports (FR-08)", () => {
  it("exports all three formats", () => {
    const p = parsePlan(loadFixture("simple-plan.yaml"));
    if (!p.ok) throw new Error("parse");
    const e = estimatePlan(p.value);
    expect(toJSON(e)).toContain("plan_id");
    expect(toCSV(e)).toContain("stage_id,stage_name");
    expect(toMarkdown(e)).toContain("# Cost Estimate");
  });
});
