# CollegeTab — College Cost Workflow + U.S. College Data Layer

Status: Steps 3 and 4 only  
Validated: 2026-08-19

## 1. College-cost workflow

The Colleges workspace now follows this sequence:

1. Search an institution by name.
2. Resolve the institution to a canonical IPEDS UNITID.
3. Load federal cost fields from College Scorecard/IPEDS where available.
4. Load annual historical cost observations.
5. Choose expected tuition residency and living arrangement.
6. Set expected years of attendance.
7. Review sourced annual cost components.
8. Override any value that is known more accurately.
9. Enter annual grants/scholarships and annual family contribution explicitly.
10. Review historical cost growth, optionally override the projection growth rate, then calculate projected future cost and the remaining borrowing requirement.
11. Expand the source ledger to see the source variable, academic year/vintage, release date and retrieval context behind federal values.

### Cost fields modeled in this step

- tuition + required fees (federal combined source)
- tuition override
- mandatory-fee override
- room and board
- books and supplies
- transportation override
- personal-expense override
- in-state/resident vs out-of-state prices
- expected attendance years
- historical annual cost growth
- projected multi-year cost
- annual grants/scholarships
- annual family contribution
- borrowing requirement before loan interest

### Integrity rules

**No fabricated component splits.** College Scorecard/IPEDS commonly exposes tuition plus required fees as a combined figure. It also exposes broader “other expenses” values that can include transportation and personal/miscellaneous costs. CollegeTab keeps those combined figures intact unless both split components are supplied by a verified school publication or a user override.

**Missing is not zero.** Null/blank federal data stays missing. A missing source is never coerced to `$0`.

**Aid is not guessed.** Blank grants/scholarships and family contribution do not silently become zero for the borrowing calculation. The user must enter both amounts explicitly, including `$0` when none is expected.

**Residency eligibility is not inferred from geography.** The federal feed can supply resident/out-of-state price categories, but it does not prove that a specific student qualifies. District-specific pricing also requires a school/state source or user override.

**User overrides never mutate the canonical record.** They live inside the saved plan. This preserves both the source fact and the user's scenario value.

## 2. Historical growth and future-cost logic

Historical cost growth is based only on annual observations for which the selected cost context is complete. CollegeTab uses up to the six most recent usable annual observations, which represents up to a five-year CAGR window.

When the most recent complete federal observation supplies all required components for one academic year, that year becomes the projection baseline. If the user changes a cost component, the override is treated as a current-year value rather than pretending it belongs to an older federal reporting year.

Projected cost is the sum of each expected attendance year's modeled cost:

`year_n_cost = baseline_annual_cost × (1 + annual_growth_rate)^(start_year - baseline_year + n)`

The borrowing requirement in Step 3 is deliberately narrow:

`borrowing requirement = max(0, projected attendance cost - grants/scholarships - family contribution)`

Loan interest, origination fees, repayment plans and post-graduation debt service are not part of Steps 3–4 and are not included.

## 3. Canonical U.S. college record

CollegeTab uses:

`canonicalId = ipeds:<UNITID>`

IPEDS UNITID is the primary key. OPE6/OPE8 identifiers are stored as crosswalk values only.

Each canonical record can contain:

- IPEDS UNITID
- OPE identifiers
- institution name, city, state and ownership
- school URL and net-price-calculator URL
- federal cost values
- historical annual cost observations
- optional verified school-published cost components
- optional verified residency-policy metadata
- provenance/source metadata

The formal shape is documented in `data/college-record.schema.json`.

## 4. Coverage architecture

CollegeTab separates **institution coverage** from **cost coverage**.

### Canonical institution universe

`scripts/build-ipeds-directory.mjs` ingests an official IPEDS Directory/HD CSV and produces one canonical record per UNITID. This is the path for representing the full IPEDS institution universe instead of claiming that a College Scorecard search result list equals every U.S. institution.

### Cost enrichment

`college-data.js` can enrich institutions from the College Scorecard API and caches normalized records in IndexedDB. Historical annual cost observations are fetched separately by UNITID.

A production build can expose the generated IPEDS index to the browser with:

```html
<script>
  window.COLLEGETAB_DIRECTORY_URL = 'data/ipeds-directory.json';
</script>
```

When configured, CollegeTab searches that canonical IPEDS directory first and falls back to College Scorecard search. A selected directory institution can then be enriched by UNITID.

### School-published cost layer

`mergeVerifiedSchoolPublished()` accepts a school-published cost record only when:

- its UNITID matches the canonical institution;
- an academic year is supplied;
- a valid source URL is supplied.

Published values are stored alongside the federal values instead of destructively replacing them. This lets later refresh jobs reconcile conflicts and retain provenance.

## 5. Source precedence

For base facts:

1. verified, dated school-published cost of attendance
2. direct IPEDS cost/institution data
3. College Scorecard-distributed IPEDS fields

For an individual saved plan, a user override can supersede the displayed calculation while leaving all source facts intact.

## 6. Files added for Steps 3–4

- `college-data.js` — canonical data adapter, Scorecard integration, IndexedDB cache, historical fetch, school-published merge
- `college-cost-math.js` — pure tested cost math
- `scripts/build-ipeds-directory.mjs` — official IPEDS Directory CSV normalizer
- `data/college-record.schema.json` — canonical record schema
- `data/README.md` — data refresh/build instructions
- `tests/` — deterministic fixtures and validation scripts
