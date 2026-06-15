import { describe, it, expect } from "vitest";
import "../../src/pricing/node.js";
import { getPricing, loadPricing } from "../../src/pricing/index.js";

describe("pricing", () => {
  it("loads bundled pricing database", () => {
    const db = loadPricing();
    expect(db.models.length).toBeGreaterThan(0);
    expect(db.version).toBeTruthy();
  });

  it("throws on unknown model", () => {
    expect(() => getPricing("nope-model")).toThrow(/Unknown model/);
  });

  it("Opus 4.7 has tokenizer correction != 1", () => {
    const p = getPricing("claude-opus-4-7");
    expect(p.tokenizer_correction).toBeGreaterThan(1);
  });

  it("Opus 4.6 has tokenizer correction = 1", () => {
    const p = getPricing("claude-opus-4-6");
    expect(p.tokenizer_correction).toBe(1);
  });
});
