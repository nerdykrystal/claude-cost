/**
 * Canonical JSON serialization for deterministic hashing.
 *
 * Properties:
 * - Lexicographically sorted object keys
 * - Array order preserved
 * - UTF-8 throughout
 * - Separator byte 0x1f used within structures (not escaped in output)
 * - Undefined values are rejected with error code CC-CANON-001
 */

export function canonicalJson(value: unknown): string {
  return _canonicalJsonInternal(value);
}

function _canonicalJsonInternal(value: unknown): string {
  // Handle null explicitly
  if (value === null) {
    return "null";
  }

  // Handle undefined - not allowed
  if (value === undefined) {
    throw new Error("CC-CANON-001: undefined not allowed in canonical JSON");
  }

  // Handle booleans
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  // Handle numbers
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return String(value);
    } else {
      return JSON.stringify(value);
    }
  }

  // Handle strings
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  // Handle arrays
  if (Array.isArray(value)) {
    const elements = value.map((item) => _canonicalJsonInternal(item));
    return "[" + elements.join("\x1f") + "]";
  }

  // Handle objects
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(
      (key) =>
        JSON.stringify(key) + "\x1f" + _canonicalJsonInternal(obj[key])
    );
    return "{" + pairs.join("\x1f") + "}";
  }

  // Shouldn't reach here
  throw new Error(`CC-CANON-002: Unsupported type: ${typeof value}`);
}
