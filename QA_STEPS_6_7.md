# CollegeTab QA — Financial Engine + Scenario Experience

Current financial engine: `2026.08.20-v7`

Current loan engine: `2026.08.19-loans-v4`

Review order is mandatory: **logic / sellability → aesthetic → functionality / accuracy**.

## Check 1 — Logic / sellability

**PASS**

### Loan model is no longer blended

- The blended education-loan APR input has been removed from the scenario workflow.
- Direct Subsidized, Direct Unsubsidized, private education loans, and Parent PLUS are separate tranches.
- Each tranche preserves borrower, principal, APR, interest behavior, repayment timing, and capitalization behavior.
- Parent PLUS is never counted as student debt or subtracted from the student's personal net worth.
- Private-loan terms are supplied from the lender/user; CollegeTab does not invent a market-average private APR.
- Private APR and origination fee are stored **per academic-year tranche**, so a Year 1 private loan can have different pricing from a Year 3 private loan.
- If a private tranche exists, APR and fee must both be explicit; a true no-fee loan requires the user to enter `0%` rather than relying on a missing-value default.

### Federal-loan logic

- Direct Subsidized accrues no modeled interest while the student is enrolled at least half-time or during the ordinary six-month grace period.
- Direct Unsubsidized begins accruing from each modeled disbursement and continues through school and grace.
- Parent PLUS accrues during the assumed in-school + six-month requested deferment and unpaid deferred interest capitalizes at repayment start.
- Current undergraduate annual and aggregate Direct limits are enforced.
- The higher Direct limits for qualifying dependent students whose parents cannot obtain Parent PLUS are represented as their own dependency status.
- Current 2026+ Parent PLUS annual/aggregate limits are enforced for the standard new-borrower path.
- Subsidized eligibility is never auto-assumed. The conservative suggested plan starts Direct capacity as unsubsidized until the user supplies an aid-offer/eligibility assumption.

### Federal repayment logic

- Arbitrary user-entered federal repayment terms were removed.
- New modeled 2026+ Direct Loans use the current-law **Tiered Standard** fixed-payment baseline.
- Term is selected automatically from modeled Direct principal: 10 / 15 / 20 / 25 years at the current thresholds.
- Parent PLUS is modeled as a separate parent borrower with its own Tiered Standard balance/term.
- RAP is not silently assumed; it remains an explicit future modeling enhancement.

### Product honesty

- Federal origination fees reduce net school proceeds while gross principal remains owed.
- Future federal rates and fee schedules are labeled editable planning proxies rather than known future terms.
- Exact federal daily-interest servicing is not claimed without exact disbursement dates; the generic workflow discloses its two-disbursement planning convention.
- Prior federal balances are allowed for aggregate-limit checks, but the scenario refuses to amortize them without detailed prior-loan terms. No historical blended APR is fabricated.
- Private interest-only payments are reported as pre-graduation cash outflow; CollegeTab does not guess whether the student or family funded them.
- Temporary Auto Pay reductions, transition/grandfather exceptions, forgiveness, and RAP are excluded rather than hidden inside assumptions.

## Check 2 — Aesthetic

**PASS by design-system/code audit**

The expanded loan stack stays inside the established CollegeTab visual system:

- oversized editorial section headings
- warm paper / ink / lime / coral / blue system
- hard-edged surfaces rather than rounded SaaS cards
- mono labels for rates, fees, limits, and debt classes
- Direct Subsidized, Direct Unsubsidized, Parent PLUS, and private columns visually separated without becoming a conventional spreadsheet theme
- a compact current-law Tiered Standard information surface instead of two arbitrary term inputs
- annual federal and private pricing controls remain tucked behind an intentional disclosure surface
- dense loan tables horizontally scroll on narrow screens rather than collapsing into unreadable cards
- no glassmorphism, AI sparkle language, chat UI, or purple-gradient SaaS treatment

**Environment note:** Chromium headless rendering has been unreliable in this container. This QA does not falsely claim a successful automated screenshot pass; aesthetic review is based on the live HTML/CSS structure and the locked CollegeTab design-system rules.

## Check 3 — Functionality / accuracy

**PASS**

### Automated deterministic coverage

The validation suite covers:

- federal 2026 Direct and Parent PLUS baseline rates
- federal Direct and PLUS origination-fee proceeds
- annual and aggregate Direct limits
- subsidized aggregate limit
- Parent PLUS annual and aggregate limits
- PLUS-denied dependent undergraduate higher Direct limits
- no in-school interest on Direct Subsidized
- in-school interest on Direct Unsubsidized
- in-school interest on deferred private loans
- private interest-only behavior
- Parent PLUS in-school/deferment interest
- Parent PLUS capitalization at repayment start
- private lender-controlled capitalization
- different APRs and origination fees across separate annual private tranches
- rejection of private tranches with missing APR or missing fee
- two-disbursement annual planning convention
- Tiered Standard 10 / 15 / 20 / 25-year term thresholds
- separation of student federal, student private, and parent debt
- federal/private origination-fee effects on net funding
- future federal rate/fee warning behavior
- refusal to project prior federal balances without detailed existing-loan terms
- highest-APR allocation of extra student payments
- deterministic model fingerprints
- college cost / tax / salary / investment / net-worth calculations from the prior engine suite
- static UI audit ensuring obsolete blended/fixed-term loan controls do not return

### Independent cross-check

`tests/test-loan-crosscheck.py` independently recomputes, outside the JavaScript engine:

- Direct net proceeds after federal fee
- Direct Unsubsidized in-school simple interest
- deferred private in-school interest
- subsidized zero-interest behavior
- federal student debt at graduation
- private debt at graduation
- Parent PLUS school interest
- Parent PLUS six-month deferred interest through repayment start
- Tiered Standard Parent PLUS term for the tested balance

This prevents the JavaScript engine from merely being tested against its own formulas.

### Problems caught and corrected during this loan-depth review

1. **Blended APR design flaw** — removed entirely from the scenario path.
2. **Subsidized/unsubsidized behavior loss** — separate tranches now preserve the federal subsidy distinction.
3. **Parent debt attribution** — Parent PLUS is isolated from student debt/net worth.
4. **Parent PLUS capitalization** — deferred PLUS interest now capitalizes when modeled repayment begins.
5. **Arbitrary federal repayment term** — removed; current 2026+ Tiered Standard term selection is automatic.
6. **Existing-debt false precision** — prior balances no longer receive an invented historical APR; detailed terms are required before repayment projection.
7. **Private interest-only free-money risk** — pre-graduation interest payments are reported separately and the audit states that payer attribution is not yet modeled.
8. **Future fee false certainty** — federal fees are annual editable assumptions, with future schedules disclosed as uncertain.
9. **Aggregate-limit edge case** — prior subsidized principal is tracked separately from total prior Direct principal.
10. **PLUS-denial edge case** — qualifying dependent students can use the higher Direct limits without being mislabeled independent.
11. **Obsolete UI mismatch** — legacy blended/fixed-term controls were removed from HTML and locked out with static tests.
12. **Repayment-start balance precision** — the engine now separately exposes debt at graduation and debt at repayment start after grace/deferment accrual/capitalization.
13. **Single private APR over multiple years** — removed. Each academic-year private origination now carries its own APR and fee.
14. **Missing private fee treated as zero** — removed. A private tranche requires an explicit fee, including an entered 0% when the lender charges none.

### Validation command

```bash
bash tests/run-all.sh
```

Expected final line:

`ALL COLLEGETAB ENGINE + SCENARIO TESTS PASS`
