# CollegeTab

Interactive CollegeTab front-end, college-cost/data foundation, standalone financial engine, and core school-scenario comparison experience.

## Run locally

Serve the folder rather than opening it only as a `file://` URL so browser data/API behavior is consistent:

```bash
cd collegetab
python -m http.server 8080
```

Then open `http://localhost:8080/`.

## Main files

- `index.html` — public landing page
- `app.html` / `app.js` / `app.css` — CollegeTab workspace, college-cost workflow, and scenario UI
- `college-data.js` — canonical college data adapter, College Scorecard/IPEDS enrichment, and provenance
- `college-cost-math.js` — pure tested college-cost calculations
- `state-tax-data-2026.js` — 50 states + DC 2026 wage-income planning baseline
- `financial-engine.js` — standalone deterministic financial engine with category-specific living-cost inflation; no DOM/UI calculations
- `FINANCIAL_ENGINE.md` — formulas, assumptions, sources, and limitations for Steps 6 + 7
- `COLLEGE_COST_DATA.md` — college-cost/data architecture and rules
- `data/college-record.schema.json` — canonical institution record schema
- `scripts/build-ipeds-directory.mjs` — official IPEDS Directory normalizer
- `QA_STEPS_3_4.md` — prior college workflow/data review
- `QA_STEPS_6_7.md` — required logic → aesthetic → functionality review for the financial engine and scenario experience
- `QA_SECTIONAL_INFLATION.md` — required logic → aesthetic → functionality review for category-specific inflation
- `QA_DYNAMIC_SAVINGS.md` — required logic → aesthetic → functionality review for tax-aware contribution sliders
- `tests/run-all.sh` — deterministic validation suite

## Nationwide IPEDS directory

The repository intentionally does not label a stale demo list as “all U.S. colleges.” Build the canonical institution universe from the official IPEDS Directory/HD CSV:

```bash
node scripts/build-ipeds-directory.mjs \
  --input /path/to/HD2025.csv \
  --survey-year 2025 \
  --out data/ipeds-directory.json
```

Then configure `window.COLLEGETAB_DIRECTORY_URL` before `college-data.js` is loaded in production.

## Financial-engine principle

`financial-engine.js` is independent of the UI. `app.js` maps sourced/user inputs into the engine and renders the engine output. It must not contain duplicate tax, loan, inflation, investment, or net-worth formulas.

Every ready scenario exposes a versioned model ID plus the exact canonical input snapshot needed to reproduce the calculation.
