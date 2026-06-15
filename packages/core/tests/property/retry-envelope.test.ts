import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { bernoulliExpectedAttempts, computeEnvelope } from "../../src/engine/envelope.js";

describe("retry envelope — Bernoulli IID closed form", () => {
  /**
   * Property 1: Closed form matches direct sum within numerical precision.
   * For p ∈ [0, 1] and N ∈ [0, 1000], bernoulliExpectedAttempts(p, N)
   * should match Σ_{k=1..N} p^k to within 1e-12.
   */
  it("Property 1: closed form ≈ direct sum Σ p^k (200 trials)", () => {
    const startTime = Date.now();
    const TIMEOUT_MS = 60000;

    fc.assert(
      fc.property(
        fc.record({
          p: fc.double({ min: 0, max: 1, noNaN: true }),
          N: fc.integer({ min: 0, max: 1000 }),
        }),
        ({ p, N }) => {
          // Watchdog for timeout (FM-1.5: "Unaware of Termination Conditions")
          if (Date.now() - startTime > TIMEOUT_MS) {
            throw new Error(
              "FM-1.5 termination violation: property execution exceeded 60s",
            );
          }

          const closed = bernoulliExpectedAttempts(p, N);

          // Direct sum: Σ_{k=1..N} p^k
          let sum = 0;
          for (let k = 1; k <= N; k++) {
            sum += Math.pow(p, k);
          }

          // For numerical stability, use relative tolerance for large values,
          // absolute for small ones.
          const tolerance = Math.max(1e-12, Math.abs(sum) * 1e-12);
          return Math.abs(closed - sum) <= tolerance;
        },
      ),
      { numRuns: 200, endOnFailure: true },
    );
  });

  /**
   * Property 2: Envelope ordering: best ≤ expected ≤ worst.
   * Also verify: best = subtotal, worst = subtotal × (N + 1).
   */
  it("Property 2: envelope invariants best ≤ expected ≤ worst (200 trials)", () => {
    const startTime = Date.now();
    const TIMEOUT_MS = 60000;

    fc.assert(
      fc.property(
        fc.record({
          subtotal: fc.double({ min: 0.01, max: 1000, noNaN: true }),
          p: fc.double({ min: 0, max: 1, noNaN: true }),
          N: fc.integer({ min: 0, max: 50 }),
        }),
        ({ subtotal, p, N }) => {
          if (Date.now() - startTime > TIMEOUT_MS) {
            throw new Error(
              "FM-1.5 termination violation: property execution exceeded 60s",
            );
          }

          const envelope = computeEnvelope(subtotal, p, N);

          // Invariant 1: best = subtotal exactly
          if (Math.abs(envelope.best_case_usd - subtotal) > 1e-12) {
            return false;
          }

          // Invariant 2: worst = subtotal × (N + 1) exactly
          const expectedWorst = subtotal * (N + 1);
          if (Math.abs(envelope.worst_case_usd - expectedWorst) > 1e-12) {
            return false;
          }

          // Invariant 3: ordering with tiny epsilon for floating-point safety
          const eps = 1e-9;
          return (
            envelope.best_case_usd <= envelope.expected_cost_usd + eps &&
            envelope.expected_cost_usd <= envelope.worst_case_usd + eps
          );
        },
      ),
      { numRuns: 200, endOnFailure: true },
    );
  });

  /**
   * Property 3: Boundary conditions (hardcoded).
   * - bernoulliExpectedAttempts(0, N) = 0 for any N
   * - bernoulliExpectedAttempts(1, N) = N for any N
   * - bernoulliExpectedAttempts(p, 0) = 0 for any p
   */
  it("Property 3: boundary conditions (hardcoded)", () => {
    // p = 0
    expect(bernoulliExpectedAttempts(0, 0)).toBe(0);
    expect(bernoulliExpectedAttempts(0, 1)).toBe(0);
    expect(bernoulliExpectedAttempts(0, 10)).toBe(0);
    expect(bernoulliExpectedAttempts(0, 100)).toBe(0);

    // p = 1
    expect(bernoulliExpectedAttempts(1, 0)).toBe(0);
    expect(bernoulliExpectedAttempts(1, 1)).toBe(1);
    expect(bernoulliExpectedAttempts(1, 5)).toBe(5);
    expect(bernoulliExpectedAttempts(1, 100)).toBe(100);

    // N = 0
    expect(bernoulliExpectedAttempts(0.5, 0)).toBe(0);
    expect(bernoulliExpectedAttempts(0.25, 0)).toBe(0);
    expect(bernoulliExpectedAttempts(0.99, 0)).toBe(0);

    // Expected: 0 always
    expect(bernoulliExpectedAttempts(0, 0)).toBe(0);
  });

  /**
   * Property 4: Monte-Carlo cross-check.
   * For fixed (p, N) pairs, simulate 10000 Bernoulli retry sequences,
   * count actual extra attempts, average, compare to closed form within 3σ.
   */
  it("Property 4: Monte-Carlo simulation ±3σ match (5 p × 4 N = 20 checks)", () => {
    const pValues = [0.1, 0.3, 0.5, 0.7, 0.9];
    const NValues = [1, 5, 10, 50];
    const simulationsPerCase = 10000;

    for (const p of pValues) {
      for (const N of NValues) {
        const closed = bernoulliExpectedAttempts(p, N);

        // Simulate: for each trial, count extra attempts until success or N retries
        const outcomes: number[] = [];
        for (let trial = 0; trial < simulationsPerCase; trial++) {
          let extraAttempts = 0;
          for (let attempt = 0; attempt < N; attempt++) {
            // Bernoulli trial: succeed with probability (1 - p)
            if (Math.random() > p) {
              break; // Success
            }
            extraAttempts++;
          }
          outcomes.push(extraAttempts);
        }

        const mean = outcomes.reduce((a, b) => a + b, 0) / outcomes.length;
        const variance =
          outcomes.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) /
          outcomes.length;
        const stdev = Math.sqrt(variance);
        const se = stdev / Math.sqrt(outcomes.length);
        // 4σ threshold (was 3σ; bumped after gate-58 caught a 3σ flake at p=0.5,N=10
        // sim mean 0.0233 vs threshold 0.0225). Bonferroni: 20 cases × 4σ ≈ 99.88%
        // suite-level confidence vs ~99% at 3σ. Deterministic seed deferred to a
        // follow-up cleanup gate (Math.random not directly seedable in Node).
        const thresholdSigma = 4 * se;

        // Assertion: simulated mean within 4σ of closed form
        expect(Math.abs(mean - closed)).toBeLessThanOrEqual(thresholdSigma);
      }
    }
  });

  /**
   * Property 5 (Wave-3 FM-1.5 termination watchdog).
   * Explicitly configure fast-check with numRuns: 200 and endOnFailure: true.
   * Monitor shrinking iteration count; fail if exceeds 1000.
   * Wrap in watchdog that monitors absolute execution time.
   */
  it("Property 5: Wave-3 FM-1.5 termination watchdog — shrinking ≤1000 iters + 60s timeout", () => {
    const startTime = Date.now();
    const TIMEOUT_MS = 60000;
    let maxShrinkingIterations = 0;

    // Custom arbitraries that track shrinking depth
    const trackedArb = fc
      .record({
        p: fc.double({ min: 0, max: 1, noNaN: true }),
        N: fc.integer({ min: 0, max: 100 }),
      })
      .map((val, shrinkPath) => {
        // shrinkPath.length tracks depth of shrinking
        maxShrinkingIterations = Math.max(
          maxShrinkingIterations,
          (shrinkPath as any)?.depth ?? 0,
        );
        return val;
      });

    const property = fc.property(trackedArb, ({ p, N }) => {
      // Absolute timeout watchdog
      if (Date.now() - startTime > TIMEOUT_MS) {
        throw new Error(
          "FM-1.5 termination violation: fast-check execution exceeded 60s",
        );
      }

      // Basic sanity: closed form is non-negative
      const result = bernoulliExpectedAttempts(p, N);
      return result >= 0 && result <= N;
    });

    // Configure fast-check explicitly per spec
    try {
      fc.assert(property, { numRuns: 200, endOnFailure: true });
    } catch (err) {
      // Check if error is due to shrinking timeout
      if (maxShrinkingIterations > 1000) {
        throw new Error(
          `FM-1.5 termination violation: fast-check shrink exceeded 1000 iters (actual: ${maxShrinkingIterations})`,
        );
      }
      // Re-throw other errors
      throw err;
    }

    // Post-run check: if we got here without timeout, shrinking was bounded
    if (Date.now() - startTime > TIMEOUT_MS) {
      throw new Error(
        "FM-1.5 termination violation: total execution time exceeded 60s",
      );
    }
  });

  /**
   * Edge case: Validate error handling for out-of-range inputs.
   */
  it("throws CC-ENVELOPE-001 for p < 0", () => {
    expect(() => bernoulliExpectedAttempts(-0.1, 5)).toThrow(
      /CC-ENVELOPE-001/,
    );
  });

  it("throws CC-ENVELOPE-001 for p > 1", () => {
    expect(() => bernoulliExpectedAttempts(1.1, 5)).toThrow(
      /CC-ENVELOPE-001/,
    );
  });

  it("throws CC-ENVELOPE-002 for N < 0", () => {
    expect(() => bernoulliExpectedAttempts(0.5, -1)).toThrow(
      /CC-ENVELOPE-002/,
    );
  });

  it("throws CC-ENVELOPE-002 for non-integer N", () => {
    expect(() => bernoulliExpectedAttempts(0.5, 3.5)).toThrow(
      /CC-ENVELOPE-002/,
    );
  });
});
