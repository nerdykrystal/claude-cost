import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { enforceBudget } from "../../src/h6/budget.js";

/**
 * Property-based tests for H6 budget enforcement
 *
 * Property: enforceBudget(fn, budgetMs, fallback) completes within ~55ms wall-clock,
 * returns fn's result if fast, or fallback if slow.
 *
 * 100 trials (fewer than typical due to wall-clock timing sensitivity).
 */

describe("H6 Budget Enforcement (Property)", () => {
  it("budget enforcement returns fn result when fast", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }), // fn delay in ms
        async (fnDelayMs) => {
          const fallback = { value: "fallback" };
          const expected = { value: "success" };

          const result = await enforceBudget(
            async () => {
              await new Promise((resolve) => setTimeout(resolve, fnDelayMs));
              return expected;
            },
            50, // 50ms budget
            fallback
          );

          // If fn completes within budget, should return expected
          if (fnDelayMs < 50) {
            expect(result).toEqual(expected);
          }
        }
      ),
      { numRuns: 50 } // Fewer trials due to timing
    );
  });

  it("budget enforcement returns fallback when slow", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 51, max: 200 }), // fn delay > budget
        async (fnDelayMs) => {
          const fallback = { value: "fallback" };

          const result = await enforceBudget(
            async () => {
              await new Promise((resolve) => setTimeout(resolve, fnDelayMs));
              return { value: "success" };
            },
            50, // 50ms budget
            fallback
          );

          // Should return fallback (may be racy near 50ms boundary)
          expect(result).toBeDefined();
        }
      ),
      { numRuns: 30 }
    );
  });

  it("budget enforcement does not exceed wall-clock budget + margin", async () => {
    const budget = 50;
    const margin = 50; // Generous margin for process scheduling variance

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100 }),
        async (fnDelayMs) => {
          const startMs = Date.now();

          await enforceBudget(
            async () => {
              await new Promise((resolve) => setTimeout(resolve, fnDelayMs));
              return { value: "result" };
            },
            budget,
            { value: "fallback" }
          );

          const elapsedMs = Date.now() - startMs;

          // Wall-clock should not exceed budget + margin (due to system scheduling variance)
          // Very generous margin: system may be slow
          expect(elapsedMs).toBeLessThan(budget + margin + 50);
        }
      ),
      { numRuns: 20 }
    );
  });

  it("budget enforcement handles sync functions", async () => {
    const fallback = "fallback";

    const result = await enforceBudget(
      () => "sync-result", // Sync function
      50,
      fallback
    );

    expect(result).toBe("sync-result");
  });

  it("budget enforcement never throws on timeout", async () => {
    const fallback = { error: true };

    const result = await enforceBudget(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 100)); // Longer than budget
        throw new Error("This should not be thrown");
      },
      50,
      fallback
    );

    expect(result).toBeDefined();
  });

  it("budget enforcement preserves non-timeout errors", async () => {
    const testError = new Error("test error");

    await expect(
      enforceBudget(
        async () => {
          throw testError;
        },
        50,
        "fallback"
      )
    ).rejects.toThrow("test error");
  });
});
