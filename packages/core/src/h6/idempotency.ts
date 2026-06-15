/**
 * Idempotency deduplication for H6 records
 *
 * Tracks recently-seen step_id + attempt_index + kind combinations.
 * LRU cap: 1000 keys. Oldest entries evicted on overflow.
 *
 * Behavior on duplicate: return true from isDuplicate().
 * Caller decides whether to skip emit (no-op) or overwrite.
 * For v1.1.0 Stage 04, behavior is: overwrite (re-emit same record).
 */

interface SeenEntry {
  key: string;
  timestamp: number;
}

const seenMap = new Map<string, SeenEntry>();
const LRU_CAP = 1000;

/**
 * recordKey - Generate a canonical key for dedup
 *
 * @param step_id Unique step identifier
 * @param attempt_index Attempt number (0-indexed)
 * @param kind Record kind (cost_estimate, cost_actual, h6_recovered)
 * @returns Canonical dedup key
 */
export function recordKey(
  step_id: string,
  attempt_index: number,
  kind: string
): string {
  return `${step_id}#${attempt_index}#${kind}`;
}

/**
 * isDuplicate - Check if a record key has been seen recently
 *
 * @param key From recordKey()
 * @returns true if seen within recent history
 */
export function isDuplicate(key: string): boolean {
  return seenMap.has(key);
}

/**
 * markSeen - Mark a key as recently seen
 *
 * If LRU cap exceeded, evicts oldest entry.
 *
 * @param key From recordKey()
 */
export function markSeen(key: string): void {
  // If already present, update timestamp (refresh in LRU)
  if (seenMap.has(key)) {
    const entry = seenMap.get(key)!;
    entry.timestamp = Date.now();
    return;
  }

  // New key; check cap
  if (seenMap.size >= LRU_CAP) {
    // Find and evict oldest
    let oldest: [string, SeenEntry] | null = null;
    for (const [k, v] of seenMap.entries()) {
      if (!oldest || v.timestamp < oldest[1].timestamp) {
        oldest = [k, v];
      }
    }
    if (oldest) {
      seenMap.delete(oldest[0]);
    }
  }

  seenMap.set(key, { key, timestamp: Date.now() });
}

/**
 * clearSeen - Reset dedup map (for testing)
 */
export function clearSeen(): void {
  seenMap.clear();
}

/**
 * getSeenSize - Return current size of dedup map (for testing)
 */
export function getSeenSize(): number {
  return seenMap.size;
}
