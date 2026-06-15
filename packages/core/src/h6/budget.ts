/**
 * Budget enforcement for H6 hooks
 *
 * Ensures onPreToolUse (50ms p95) and onPostToolUse (100ms p95) stay within
 * wall-clock time budget. On timeout, returns fallback value without throwing.
 */

/**
 * enforceBudget
 *
 * Race a function against a timeout. Returns the result of fn() if it completes
 * within budgetMs, otherwise returns fallback. Never throws.
 *
 * @param fn Function to execute (sync or async)
 * @param budgetMs Wall-clock budget in milliseconds
 * @param fallback Value to return on timeout
 * @returns Promise<T> resolving to fn's result (if fast) or fallback (if slow)
 */
export async function enforceBudget<T>(
  fn: () => Promise<T> | T,
  budgetMs: number,
  fallback: T
): Promise<T> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), budgetMs);

  try {
    const result = await Promise.race([
      Promise.resolve(fn()),
      new Promise<T>((_resolve, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error("budget_exceeded"));
        });
      }),
    ]);
    clearTimeout(timeoutHandle);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle);
    if (error instanceof Error && error.message === "budget_exceeded") {
      return fallback;
    }
    // Re-throw non-timeout errors (should not happen; fn should not throw)
    throw error;
  }
}
