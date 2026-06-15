/**
 * Retry envelope computation for Bernoulli IID retry model.
 *
 * Probability model: Geometric / Independent Bernoulli trials.
 * Closed-form expected extra attempts: (p − p^(N+1)) / (1 − p) for p<1; N for p=1; 0 for p=0 or N=0.
 * See TQCD §5.3 and Stage 00 Research Summary T04.
 *
 * Per PRD-AR-NV-03, probability model cited in code comments.
 */

/**
 * Type discriminator for envelope options.
 * In v1.1.0, only Bernoulli IID is supported.
 * Future versions may add SAB (simultaneous-activation-bound), non-IID, etc.
 */
export interface EnvelopeOptions {
  model: "bernoulli-iid";
}

/**
 * Compute expected number of extra attempts (beyond the first) under Bernoulli IID model.
 *
 * @param p - Failure probability per attempt, must be in [0, 1]
 * @param N - Maximum number of retries allowed, must be non-negative integer
 * @returns Expected extra attempts: (p − p^(N+1)) / (1 − p) for p<1; N for p=1; 0 for p=0 or N=0
 * @throws Error if p out of range or N negative
 */
export function bernoulliExpectedAttempts(p: number, N: number): number {
  if (p < 0 || p > 1) {
    throw new Error("CC-ENVELOPE-001: p out of range [0,1]");
  }
  if (N < 0 || !Number.isInteger(N)) {
    throw new Error("CC-ENVELOPE-002: N must be non-negative integer");
  }

  if (N === 0) return 0;
  if (p === 0) return 0;
  if (p === 1) return N;

  // Closed form: (p - p^(N+1)) / (1 - p) for 0 < p < 1
  // For p very close to 1, use direct sum to avoid catastrophic cancellation
  if (p > 0.999999) {
    let sum = 0;
    for (let k = 1; k <= N; k++) {
      sum += Math.pow(p, k);
    }
    return sum;
  }

  const numerator = p - Math.pow(p, N + 1);
  const denominator = 1 - p;
  return numerator / denominator;
}

/**
 * Compute retry cost envelope: best-case, expected, worst-case.
 *
 * @param subtotal_usd - Base cost of one execution
 * @param p - Failure probability per retry attempt, [0, 1]
 * @param N - Maximum retries allowed, ≥ 0
 * @param options - Currently unused; for future model discriminators
 * @returns Object with best_case_usd, expected_cost_usd, worst_case_usd
 *
 * Invariants:
 * - best_case_usd = subtotal_usd (no retries fire)
 * - expected_cost_usd = subtotal_usd + subtotal_usd * bernoulliExpectedAttempts(p, N)
 * - worst_case_usd = subtotal_usd × (N + 1) (all N retries fire)
 * - best ≤ expected ≤ worst always
 */
export function computeEnvelope(
  subtotal_usd: number,
  p: number,
  N: number,
  _options?: EnvelopeOptions,
): {
  best_case_usd: number;
  expected_cost_usd: number;
  worst_case_usd: number;
} {
  const expected_extra_attempts = bernoulliExpectedAttempts(p, N);
  const expected_extra_cost = subtotal_usd * expected_extra_attempts;

  return {
    best_case_usd: subtotal_usd,
    expected_cost_usd: subtotal_usd + expected_extra_cost,
    worst_case_usd: subtotal_usd * (N + 1),
  };
}
