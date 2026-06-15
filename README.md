# Claude Cost — MVP v1.0

Estimate and analyze the cost of D2R multi-model AI pipelines. Pure client-side
TypeScript; no backend, no API keys, no telemetry.

## What it does

- **Estimate** the cost of a D2R plan (YAML, JSON, or Markdown with a fenced YAML
  block) before you run it — per-stage breakdown plus a best-case / expected /
  worst-case envelope that accounts for ASAE retry gates.
- **Compare** 2–20 plans side-by-side with pairwise deltas and a stage × plan
  cost-concentration heatmap.
- **Analyze variance** between an estimate and a real execution log to calibrate
  future estimates.
- **Export** results as JSON, CSV, or a Markdown report.
- **Bundled pricing** for Anthropic Claude (Opus 4.7 with 1.35x tokenizer
  correction, Opus 4.6, Sonnet 4.6, Haiku 4.5). Flagged as stale after 30 days.
- **Three surfaces** — Node CLI, browser web app, and the core engine as a
  reusable library.

## Repo layout

```
workspace/
├── packages/
│   ├── core/          TypeScript library + Node CLI
│   │   ├── src/
│   │   │   ├── engine/     Cost calculation (FR-02, 03, 04, 05, 06, 07)
│   │   │   ├── parser/     YAML/JSON/Markdown plan parser (FR-01)
│   │   │   ├── pricing/    Bundled pricing DB (FR-09)
│   │   │   ├── logs/       Execution-log normalizer (FR-07)
│   │   │   ├── export/     CSV/JSON/Markdown export (FR-08)
│   │   │   ├── schemas/    Zod schemas + result types
│   │   │   └── cli/        Node CLI wrapper (FR-10)
│   │   ├── tests/
│   │   │   ├── fixtures/   Sample plans + execution logs
│   │   │   └── unit/       Vitest + fast-check property tests
│   │   └── data/pricing.json
│   └── web/           Vite + vanilla-TS web UI (all 4 PRD journeys)
└── .github/workflows/ CI (typecheck, test, build)
```

## Install & build

```
cd workspace
npm install
npm run build        # builds the core library
npm run test         # runs unit + property + CLI tests
```

To build the web UI:

```
cd packages/web
npx vite build
npx vite preview     # serve the static build
# or
npx vite             # dev server at http://localhost:5173
```

## CLI usage

```
node packages/core/dist/cli/index.js estimate plan.yaml
node packages/core/dist/cli/index.js estimate plan.yaml --format markdown
node packages/core/dist/cli/index.js compare p1.yaml p2.yaml p3.yaml
node packages/core/dist/cli/index.js analyze plan.yaml execution-log.json
node packages/core/dist/cli/index.js models
node packages/core/dist/cli/index.js pricing
```

After `npm install -g` the linked binary is `claude-cost`.

## D2R plan format

See `packages/core/tests/fixtures/d2r-plan.yaml` for a complete example with
ASAE retry gates. Minimal:

```yaml
plan_id: my-plan
plan_name: Demo
stages:
  - id: stage-01
    name: Implementation
    model: claude-haiku-4-5
    input_tokens: 10000
    output_tokens: 5000
```

Optional per-stage fields: `thinking_tokens`, `cache_read_tokens`,
`cache_write_tokens`, `batch` (bool), `asae_gate` (bool), `retry_probability`
(0–1), `max_retries` (int), `depends_on`, `carry_context_from`.

## Accessibility

The web UI meets WCAG 2.1 AA at the component layer: semantic HTML throughout,
keyboard operable, 44×44 px touch targets, visible focus indicators, data
tables instead of chart-only views, `prefers-reduced-motion` and
`prefers-color-scheme` respected, skip link to main content, explicit
`lang="en"`, ARIA `role=alert` / `role=status` / `aria-live` on dynamic regions.

## Status vs. TRD

| FR | Scope | Status |
|---|---|---|
| FR-01 | Parse D2R plan (YAML/Markdown/JSON) | ✅ `src/parser` |
| FR-02 | Per-stage cost estimate | ✅ `src/engine/estimateStage` |
| FR-03 | Total plan cost rollup | ✅ `src/engine/estimatePlan` |
| FR-04 | Opus 4.7 tokenizer correction + mixed-gen callout | ✅ 1.35x factor + assumption + UI callout |
| FR-05 | Retry envelope (best/expected/worst) | ✅ envelope per stage and plan |
| FR-06 | Compare 2–20 plans + heatmap | ✅ `src/engine/comparePlans` |
| FR-07 | Post-run variance analysis | ✅ `src/engine/analyzeVariance` |
| FR-08 | Export CSV/JSON/Markdown | ✅ `src/export` |
| FR-09 | Pricing freshness warning (30d) | ✅ `isStale`, UI badge |
| FR-10 | CLI for programmatic use | ✅ `dist/cli/index.js` |

See `docs/traceability.md` for the test→FR map.

## Deferred to v0.2 / v1

Per TRD Section 9 and PRD Section 9: plan authoring UI, Jupyter / Quarto export
via Pyodide, XLSX export, Tauri desktop shell, npm SDK package form,
Claude Code plugin form, retry combinatorial modeling beyond envelope bounds,
pricing change history tracking. The core engine is structured so each of
these is additive rather than a rewrite.

## License

MIT (pending final legal review per PRD Section 6.1).
