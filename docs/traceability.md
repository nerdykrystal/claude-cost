# Requirements Traceability

Maps each Functional Requirement from `CC_TRD_2026-04-17_v01_I.md` §2.1 to the
code path that implements it and the test(s) that exercise it.

| FR    | Statement summary                            | Implementation                                               | Test(s) |
|-------|----------------------------------------------|--------------------------------------------------------------|---------|
| FR-01 | Parse YAML/Markdown D2R plans via Zod         | `packages/core/src/parser/index.ts`                          | `parser` describe block in `engine.test.ts` |
| FR-02 | Per-stage cost estimate                       | `engine.estimateStage`                                       | "single stage estimate (FR-02)" |
| FR-03 | Rolled-up total with caching/batch/thinking/correction | `engine.estimatePlan`                                | "plan rollup (FR-03)" |
| FR-04 | Opus 4.7 tokenizer correction + mixed-gen flag | `estimateStage` applies `tokenizer_correction`; `estimatePlan` detects mixed generations | "applies Opus 4.7 tokenizer correction (FR-04)" + property test |
| FR-05 | Best/expected/worst retry envelope            | `estimateStage` envelope fields                              | "retry envelope (FR-05)" + property test |
| FR-06 | Compare 2–20 plans + heatmap                  | `engine.comparePlans`                                        | "comparison (FR-06)" |
| FR-07 | Post-run variance analysis                    | `engine.analyzeVariance` + `logs.parseLog`                   | "variance (FR-07)" + CLI analyze test |
| FR-08 | Export CSV/JSON/Markdown                      | `export/index.ts`                                            | "exports (FR-08)" |
| FR-09 | 30-day staleness warning                      | `pricing.isStale`, `pricingAgeDays`                          | "surfaces stale-pricing flag" |
| FR-10 | CLI for programmatic use                      | `cli/index.ts` binary                                        | `cli.test.ts` (5 tests) |

## Property-based invariants (TQCD §2.1, category 16)

Implemented via `fast-check` in `tests/unit/engine.test.ts`:

- `cost` is never negative for any valid stage (200 runs)
- `cost(batch)` ≤ `cost(no-batch)` for equivalent inputs (100 runs)
- `cost(retry) ≥ cost(no-retry)` for the same plan (100 runs)
- `cost(opus-4.7) ≥ cost(opus-4.6)` for equivalent pipelines, validating the
  tokenizer-correction factor (100 runs)

## User-journey coverage (PRD §4 → TQCD §2.1 E2E)

| Journey | Surface | Coverage |
|---|---|---|
| J1 — estimate a single plan | Web UI + CLI | CLI test `estimate`; UI smoke via local Vite build |
| J2 — compare multiple plans | Web UI + CLI | CLI test `compare`; UI renders heatmap + deltas |
| J3 — post-run variance | Web UI + CLI | CLI test `analyze`; UI `#variance-results` |
| J4 — export for research | Web UI + CLI | CSV/JSON/Markdown exports tested via `toCSV` / `toJSON` / `toMarkdown` |
| J5 — malformed plan rejected | Both | parser test "rejects malformed plan" |
| J6 — stale pricing warning | Both | engine test "surfaces stale-pricing flag" |
| J7 — mixed Opus generations callout | Web UI + engine | `mixed_opus_generations` flag + UI callout element |

## Out-of-scope for this MVP build

Per TRD §9 and TQCD §2.1: Lighthouse CI, axe-core Playwright integration,
snapshot visual regression, mutation testing, screen-reader manual testing log,
Tauri desktop shell, npm SDK standalone package, Jupyter/Quarto export. All are
additive to the existing engine without architectural change.
