# CollegeTab U.S. college data layer

CollegeTab uses **IPEDS UNITID** as its canonical institution key. Institution names are display fields, not join keys. OPE identifiers are retained as crosswalk identifiers because OPEID and UNITID do not have a guaranteed one-to-one relationship.

## Two-layer coverage strategy

1. **Canonical universe — IPEDS directory (HD):** build a record for every institution in the downloaded IPEDS directory file with `scripts/build-ipeds-directory.mjs`.
2. **Cost enrichment — College Scorecard/IPEDS:** the browser adapter in `college-data.js` resolves search results and cost variables, then stores the normalized record in IndexedDB. Historical cost observations are loaded separately so CollegeTab can derive a CAGR only from real annual values.

The browser prototype intentionally does not bundle a stale nationwide snapshot. Production should generate the IPEDS universe as part of a dated data-refresh job and serve a search index/server endpoint. The current browser adapter uses the public College Scorecard API path and can be configured with `window.COLLEGETAB_SCORECARD_API_KEY`.

## Canonical identity

`canonicalId = "ipeds:" + UNITID`

Every record carries:
- IPEDS UNITID
- OPE crosswalk identifiers when available
- name/location/ownership
- source metadata and retrieval date
- federal cost fields with variable name, academic year, release date and retrieval date
- annual historical observations
- optional verified school-published cost components
- optional verified residency policy metadata

## No fabricated splits

IPEDS/College Scorecard may expose tuition + required fees as one number and transportation/personal costs inside a broader “other expenses” value. CollegeTab preserves the combined amount. Separate components appear only when a verified school-published source or explicit user override provides them.

## Build the full IPEDS institution universe

```bash
node scripts/build-ipeds-directory.mjs \
  --input /path/to/HD2025.csv \
  --survey-year 2025 \
  --source-url https://nces.ed.gov/ipeds/datacenter/ \
  --out data/ipeds-directory.json
```

This builder does not guess missing costs. Cost enrichment is a separate layer so identity coverage and cost coverage are not conflated.
