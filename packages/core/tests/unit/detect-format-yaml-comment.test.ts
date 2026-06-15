import { describe, it, expect } from "vitest";
import { parsePlan } from "../../src/parser/index.js";

describe("detectFormat with YAML comments", () => {
  it("detects YAML file starting with # comment line followed by key:value", () => {
    const input = `# This is a configuration file
plan_id: simple-test-001
plan_name: Test Plan
stages:
  - id: s01
    name: Test Stage
    model: claude-haiku-4-5
    input_tokens: 100
    output_tokens: 50`;
    const result = parsePlan(input, "auto");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.plan_id).toBe("simple-test-001");
    }
  });

  it("distinguishes YAML with comment from markdown heading", () => {
    // Markdown: # Heading followed by body text and fenced block
    const markdownInput = `# Heading

This is body text.

\`\`\`yaml
plan_id: md-plan-001
plan_name: From Markdown
stages:
  - id: s01
    name: step
    model: claude-haiku-4-5
    input_tokens: 100
    output_tokens: 50
\`\`\``;
    const result = parsePlan(markdownInput, "auto");
    expect(result.ok).toBe(true);
  });

  it("detects JSON format starting with {", () => {
    const jsonInput = `{
  "plan_id": "json-plan-001",
  "plan_name": "Test Plan",
  "stages": [
    {
      "id": "s01",
      "name": "Test Stage",
      "model": "claude-haiku-4-5",
      "input_tokens": 100,
      "output_tokens": 50
    }
  ]
}`;
    const result = parsePlan(jsonInput, "auto");
    expect(result.ok).toBe(true);
  });

  it("handles YAML with multiple comment lines before content", () => {
    const input = `# Comment line 1
# Comment line 2
# Comment line 3
plan_id: yaml-multi-comment-001
plan_name: Test Plan
stages:
  - id: s01
    name: Test Stage
    model: claude-haiku-4-5
    input_tokens: 100
    output_tokens: 50`;
    const result = parsePlan(input, "auto");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.plan_name).toBe("Test Plan");
    }
  });
});
