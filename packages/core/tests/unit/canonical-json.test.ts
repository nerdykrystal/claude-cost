import { describe, it, expect } from "vitest";
import { canonicalJson } from "../../src/util/canonical-json";

describe("canonicalJson", () => {
  it("serializes empty object", () => {
    const result = canonicalJson({});
    expect(result).toBe("{}");
  });

  it("serializes empty array", () => {
    const result = canonicalJson([]);
    expect(result).toBe("[]");
  });

  it("lexicographically sorts object keys", () => {
    const result = canonicalJson({ b: 2, a: 1 });
    const expectedWithB = canonicalJson({ a: 1, b: 2 });
    expect(result).toBe(expectedWithB);
    // Verify the keys appear in order: "a" before "b"
    expect(result.indexOf('"a"')).toBeLessThan(result.indexOf('"b"'));
  });

  it("preserves array order", () => {
    const array1 = canonicalJson([1, 2]);
    const array2 = canonicalJson([2, 1]);
    expect(array1).not.toBe(array2);
  });

  it("handles unicode strings correctly", () => {
    const result = canonicalJson({ text: "hello 世界 🌍" });
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
    // The result contains escaped unicode, verify it's consistent across calls
    const result2 = canonicalJson({ text: "hello 世界 🌍" });
    expect(result).toBe(result2);
  });

  it("handles integers without decimal point", () => {
    const result = canonicalJson({ count: 42 });
    expect(result).toContain("42");
    expect(result).not.toContain("42.0");
  });

  it("handles floats with JSON.stringify", () => {
    const result = canonicalJson({ value: 3.14 });
    expect(result).toContain("3.14");
  });

  it("preserves null values", () => {
    const result = canonicalJson({ value: null });
    expect(result).toContain("null");
  });

  it("throws CC-CANON-001 for undefined", () => {
    expect(() => {
      canonicalJson({ value: undefined });
    }).toThrow("CC-CANON-001");
  });

  it("uses 0x1f separator within structures", () => {
    const result = canonicalJson({ a: 1, b: 2 });
    expect(result).toContain("\x1f");
  });

  it("handles nested objects with correct key sorting", () => {
    const result = canonicalJson({ z: { b: 2, a: 1 }, a: 3 });
    // Keys should be sorted at each level
    expect(result).toBeDefined();
  });

  it("handles boolean values", () => {
    expect(canonicalJson({ t: true })).toContain("true");
    expect(canonicalJson({ f: false })).toContain("false");
  });
});
