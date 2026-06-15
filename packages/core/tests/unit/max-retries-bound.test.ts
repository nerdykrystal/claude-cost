import { describe, it, expect } from "vitest";
import { z } from "zod";
import { StageSchema } from "../../src/schemas/plan.js";

describe("max_retries bounds (FR-11 / CC-9)", () => {
  it("should accept max_retries = 0", () => {
    const input = {
      id: "stage-1",
      name: "test",
      model: "claude-3-5-sonnet-20241022",
      input_tokens: 100,
      output_tokens: 100,
      max_retries: 0,
    };
    expect(() => StageSchema.parse(input)).not.toThrow();
  });

  it("should accept max_retries = 10 (upper bound)", () => {
    const input = {
      id: "stage-1",
      name: "test",
      model: "claude-3-5-sonnet-20241022",
      input_tokens: 100,
      output_tokens: 100,
      max_retries: 10,
    };
    expect(() => StageSchema.parse(input)).not.toThrow();
  });

  it("should accept max_retries = 5 (middle of range)", () => {
    const input = {
      id: "stage-1",
      name: "test",
      model: "claude-3-5-sonnet-20241022",
      input_tokens: 100,
      output_tokens: 100,
      max_retries: 5,
    };
    expect(() => StageSchema.parse(input)).not.toThrow();
  });

  it("should reject max_retries = 11 (exceeds upper bound)", () => {
    const input = {
      id: "stage-1",
      name: "test",
      model: "claude-3-5-sonnet-20241022",
      input_tokens: 100,
      output_tokens: 100,
      max_retries: 11,
    };
    expect(() => StageSchema.parse(input)).toThrow();
  });

  it("should reject max_retries = -1 (negative)", () => {
    const input = {
      id: "stage-1",
      name: "test",
      model: "claude-3-5-sonnet-20241022",
      input_tokens: 100,
      output_tokens: 100,
      max_retries: -1,
    };
    expect(() => StageSchema.parse(input)).toThrow();
  });

  it("should reject max_retries = 1.5 (non-integer)", () => {
    const input = {
      id: "stage-1",
      name: "test",
      model: "claude-3-5-sonnet-20241022",
      input_tokens: 100,
      output_tokens: 100,
      max_retries: 1.5,
    };
    expect(() => StageSchema.parse(input)).toThrow();
  });

  it("should reject max_retries = 100 (far exceeds bound)", () => {
    const input = {
      id: "stage-1",
      name: "test",
      model: "claude-3-5-sonnet-20241022",
      input_tokens: 100,
      output_tokens: 100,
      max_retries: 100,
    };
    expect(() => StageSchema.parse(input)).toThrow();
  });

  it("should default to 0 when not provided", () => {
    const input = {
      id: "stage-1",
      name: "test",
      model: "claude-3-5-sonnet-20241022",
      input_tokens: 100,
      output_tokens: 100,
    };
    const parsed = StageSchema.parse(input);
    expect(parsed.max_retries).toBe(0);
  });
});
