# CollegeTab — Steps 3 + 4 QA Report

Validated: 2026-08-19

## Check 1 — Logic / sellability: PASS

- College search resolves records to IPEDS UNITID instead of using institution names as database keys.
- Full-universe architecture is separated from cost enrichment: IPEDS directory records establish institution coverage; Scorecard/IPEDS and verified school publications enrich costs.
- The workflow exposes all requested categories while refusing to fabricate federal component splits that do not exist.
- Every plan-level cost field is overridable without altering the canonical source record.
- Blank aid/family funding does not silently become zero before calculating a borrowing requirement.
- In-state/out-of-state prices are shown separately, but CollegeTab does not claim that a student qualifies for a residency category.
- District-specific pricing is explicitly left to verified school/state data or user override.
- Borrowing requirement is clearly defined as a pre-interest funding gap; later loan mechanics were not added.
- Later roadmap features (taxes, investing, Stripe, production auth/backend) were not implemented in this pass.

## Check 2 — Aesthetic: PASS

- College search, shortlist, cost editor, funding band, growth controls, outputs and source ledger use the existing CollegeTab design tokens.
- Search uses the same hard-edged, border-light neo-brutalist language rather than introducing conventional rounded SaaS cards.
- Lime/coral/blue semantic color blocks are reserved for important financial states and outputs.
- Dense source/provenance details live inside a collapsible ledger so the main workflow remains visually direct.
- Responsive rules collapse the source/result grids deliberately rather than shrinking desktop layouts indiscriminately.
- No personal school, state, major or career information appears as product-default content.

Note: the container's Chromium binary does not complete headless rendering in this environment because of its platform/DBus startup behavior, so this pass used code-level responsive/style inspection rather than falsely claiming a successful browser screenshot run.

## Check 3 — Functionality / accuracy: PASS FOR STEPS 3–4

Automated validation covers:

- JavaScript syntax for app, data adapter, auth and cost-math modules.
- Canonical Scorecard normalization and UNITID creation.
- Exact 2025-26 source-year preference with an explicit “latest available” fallback when needed.
- Missing federal values remain null and never coerce to `$0`.
- Verified school-published merge requires matching UNITID, academic year and source URL.
- School-published data is retained separately and does not overwrite federal facts.
- IPEDS directory CSV ingestion preserves quoted commas, stable UNITIDs, ownership and record-level provenance.
- CAGR math.
- Multi-year compounding and summation.
- Explicit aid/family funding totals.
- Borrowing requirement floors at zero.
- Duplicate HTML ID audit.
- Local file-reference audit.
- Required college workflow controls audit.
- Generic-content/default-data audit.

### Bugs caught and fixed during the three-pass review

1. A test incorrectly assumed IPEDS output preserved input order even though the builder intentionally sorts deterministically by institution name. The test now resolves records by UNITID.
2. JavaScript numeric coercion would have allowed a null source value to become numeric zero through `Number(null)`. All relevant source/history paths now reject null/blank before numeric conversion.
3. Search-result markup and CSS class names diverged, and the results container was not being switched to its visible state. Markup/style names and visibility logic are now aligned.
4. The original projection draft mixed a latest-cost alias with an arbitrary historical base year. CollegeTab now prefers the latest complete aligned historical observation and treats user overrides as current-year values.
5. Blank grants/family contribution originally acted like zero. Borrowing now stays unavailable until both are explicitly supplied.

## Scope intentionally not claimed

- The repository does not bundle a current official nationwide IPEDS HD snapshot; it includes the tested builder that creates the full canonical universe from the official downloaded IPEDS directory file.
- The browser prototype uses College Scorecard for live cost enrichment. A production deployment should supply a production API key/server-side data service and run dated refresh jobs.
- School-published COA ingestion is structurally supported but no crawler/scraper was added in Steps 3–4.
- No loan-interest or repayment calculations were added.
