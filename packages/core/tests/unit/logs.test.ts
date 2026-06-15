import { describe, it, expect } from "vitest";
import { parseLog } from "../../src/logs/index.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(HERE, "../fixtures");

function loadFixture(name: string) {
  return readFileSync(resolve(FIX, name), "utf-8");
}

describe("logs (parseLog)", () => {
  it("parses a fixture execution log", () => {
    const r = parseLog(loadFixture("execution-log.json"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.plan_id).toBeTruthy();
      expect(r.value.stages.length).toBeGreaterThan(0);
    }
  });

  it("rejects malformed log JSON", () => {
    const r = parseLog("{not valid json");
    expect(r.ok).toBe(false);
  });

  it("rejects log missing required fields", () => {
    const r = parseLog(JSON.stringify({ plan_id: "x" }));
    expect(r.ok).toBe(false);
  });
});
