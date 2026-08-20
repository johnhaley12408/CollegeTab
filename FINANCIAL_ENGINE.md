# CollegeTab Financial Engine — Steps 6 + 7

Financial engine: `2026.08.20-v7`

Loan engine: `2026.08.19-loans-v3`

This document defines the standalone calculation engine and the core college-scenario comparison experience. Financial math lives in `financial-engine.js`; the interface in `app.js` only assembles inputs, calls the engine, and renders outputs.

## 1. Design rule: math is independent of UI

The engine is a pure JavaScript module with no DOM access, localStorage access, network calls, or UI state. Given the same canonical input object and the same engine version, it produces the same model fingerprint and outputs.

A completed model exposes:

- engine version
- reproducibility fingerprint
- canonical normalized input snapshot
- college financing model
- loan schedule
- first-work-year tax / take-home result
- annual timeline through the target age
- target-age net worth
- family-contribution opportunity cost

The UI never re-implements tax, loan, inflation, salary-growth, investment-growth, or net-worth formulas.

## 2. College-cost inflation

For a current annual cost `C0`, college-specific annual growth rate `g`, base year `B`, and attendance start year `S`:

`firstYearCost = C0 × (1 + g)^(S − B)`

Each later attendance year compounds from that first projected year:

`cost[y] = firstYearCost × (1 + g)^y`

The college-cost workflow supplies the source-backed annual cost and growth rate. The financial engine does not invent a college growth rate.

## 3. Annual funding and borrowing

For each academic year:

`grantsUsed = min(grantsAnnual, yearCost)`

`familyUsed = min(familyAnnual, yearCost − grantsUsed)`

`borrowedPrincipal = max(0, yearCost − grantsUsed − familyUsed)`

CollegeTab requires grants and family contribution to be explicitly supplied in the cost workflow; missing values are not silently treated as zero.

## 4. Loan-stack architecture

CollegeTab no longer accepts or calculates a blended education-loan APR. Borrowing is modeled as separate tranches with separate borrowers and terms:

- Direct Subsidized — student debt
- Direct Unsubsidized — student debt
- Parent PLUS — parent debt
- Private education loan — student debt in the current workflow

Each academic-year row stores its own gross principal and pricing. Direct and Parent PLUS APR/fee assumptions are annual because federal award-year terms can change. **Private APR and private origination fee are also stored per academic-year tranche**, because separate private originations can carry different pricing. Private repayment term, post-school grace/deferment period, in-school payment behavior, and capitalization behavior are currently shared contract-planning assumptions for the scenario and remain user-editable.

Origination fees—federal or private when the lender charges one—are modeled as a reduction in proceeds, not a reduction in principal owed:

`netProceeds = grossPrincipal × (1 − feeRate)`

The 2026–27 baseline currently uses:

- undergraduate Direct Subsidized / Direct Unsubsidized fixed rate: 6.52%
- Parent PLUS fixed rate: 9.07%
- Direct Subsidized / Unsubsidized origination fee input: 1.057%
- Parent PLUS origination fee input: 4.228%

Later award-year rates are unknown. Later fee schedules can also change. Future rows therefore carry the current values only as editable planning proxies rather than pretending future federal terms are known.

For any academic year with private principal above $0, CollegeTab requires that year's private APR and fee to be explicitly entered from the lender terms. A zero fee must be entered as `0`; missing is not treated as zero. Private APR is held constant for that tranche in the current projection. Variable-rate private contracts therefore require a deliberate planning-rate assumption until a future variable-index/margin model is implemented.

## 5. Federal borrowing limits and eligibility

CollegeTab applies current undergraduate annual and aggregate Direct Loan limits by grade level and dependency status.

Dependent undergraduate combined Direct limits:

- first year: $5,500 total / $3,500 maximum subsidized
- second year: $6,500 total / $4,500 maximum subsidized
- third year and beyond: $7,500 total / $5,500 maximum subsidized
- undergraduate aggregate: $31,000 total / $23,000 subsidized

Independent undergraduates—and qualifying dependent undergraduates whose parents are unable to obtain Parent PLUS—use the higher combined Direct limits:

- first year: $9,500 total / $3,500 maximum subsidized
- second year: $10,500 total / $4,500 maximum subsidized
- third year and beyond: $12,500 total / $5,500 maximum subsidized
- undergraduate aggregate: $57,500 total / $23,000 subsidized

For academic years beginning on or after July 1, 2026, the standard Parent PLUS cap used by the model is $20,000 per academic year and $65,000 aggregate per child across all parent borrowers. Transitional/grandfathered exceptions are not silently assumed.

The automatic financing suggestion is intentionally conservative: it never guesses that the student qualifies for subsidized principal. It first uses available Direct capacity as unsubsidized, and the user can reclassify eligible principal as subsidized only from an aid offer or explicit assumption. Parent PLUS is never auto-selected; private principal fills the remaining modeled gap until the user chooses a different financing mix.

## 6. In-school and post-school interest by loan type

### Direct Subsidized

For current eligible undergraduate Direct Subsidized borrowing:

`inSchoolInterest = 0`

`standardGraceInterest = 0`

The model therefore carries only the subsidized principal into repayment unless another explicit capitalization/accrual event is added later.

### Direct Unsubsidized

Interest begins at each modeled disbursement. Because the generic college workflow does not know exact school disbursement dates, CollegeTab models two equal disbursements per academic year: one near the beginning of fall and one about five months later near the beginning of spring.

For each half-disbursement:

`interest = principalHalf × APR × monthsOutstanding / 12`

The same simple-interest treatment continues through the six-month grace period. Unpaid Direct Unsubsidized interest is tracked separately from principal at the end of the ordinary school/grace transition; CollegeTab does not automatically capitalize it merely because the grace period ended.

### Parent PLUS

Parent PLUS is always modeled on the parent's balance sheet. When the user uses Parent PLUS, CollegeTab currently assumes the parent requests the available in-school deferment and the additional six-month post-enrollment deferment.

Interest accrues during both periods. At modeled repayment start, unpaid deferred Parent PLUS interest is capitalized:

`repaymentPrincipal = originalPrincipal + unpaidDeferredInterest`

This means subsequent repayment interest is calculated on the higher capitalized principal.

### Private education loans

Private-loan contracts vary, so CollegeTab requires user/lender terms instead of manufacturing a standard private-loan product.

Current in-school choices are:

- `deferred`: interest accrues while enrolled and remains unpaid
- `interest_only`: accrued in-school interest is treated as paid rather than added to graduation debt

Private grace/deferment interest accrues on principal. At repayment start, unpaid interest is capitalized only if the lender-term input says it capitalizes.

If the user selects private interest-only payments, CollegeTab reports that pre-graduation cash outflow separately. The current post-graduation net-worth model does **not** guess whether the student or family funded those payments, so it does not silently deduct them from one party's assets.

### Disbursement precision

Federal loans use daily simple interest in servicing. CollegeTab's generic projection cannot claim servicer-level day precision until exact disbursement dates are known. The two-disbursement month convention is therefore disclosed in the reproducibility audit. Once actual dates are supplied, the engine can be extended to day-level accrual without changing the UI architecture.

## 6A. Federal repayment baseline

For Direct Loans first disbursed on or after July 1, 2026, the default fixed-payment current-law baseline is the Tiered Standard Plan. CollegeTab no longer lets the user invent an arbitrary federal fixed term.

The model selects the repayment term from Direct outstanding principal:

- less than $25,000 → 10 years / 120 months
- $25,000 to less than $50,000 → 15 years / 180 months
- $50,000 to less than $100,000 → 20 years / 240 months
- $100,000 or more → 25 years / 300 months

Every federal tranche keeps its own APR, but all Direct loans belonging to the same borrower use the applicable Tiered Standard term. Parent PLUS is calculated separately because the parent is a different borrower.

CollegeTab does not currently model the Repayment Assistance Plan (RAP) in the scenario comparison and does not silently substitute RAP for Tiered Standard. It also does not assume the temporary Auto Pay rate reduction, since that benefit is optional and time-limited.

For a repayment tranche with repayment principal `P`, monthly rate `r`, and term `n` months, the fixed-payment solver finds the payment that amortizes principal plus any separately tracked unpaid interest over the required term. Payment application follows interest first, then principal. Optional extra student payments are allocated highest-APR first after minimum payments.

## 6B. Existing debt

The prior-federal-balance inputs are retained for federal aggregate-limit checks. They are **not** silently blended into the new projection.

If a prior Direct or Parent PLUS balance is above zero, CollegeTab stops the repayment/net-worth projection and requests detailed existing-loan terms. Without each prior loan's APR, borrower, principal, and status, an accurate repayment schedule cannot be reconstructed. Refusing to calculate is more accurate than assigning a made-up historical blended APR.

## 7. Salary growth

For starting salary `S0`, annual salary-growth assumption `g`, and year index `t`:

`salary[t] = S0 × (1 + g)^t`

The UI starts with an editable 3% planning assumption. It is not presented as a prediction.

## 8. Federal income tax

The exact base tax year is 2026.

Base-year federal tax uses:

- 2026 filing-status tax brackets
- 2026 standard deduction
- modeled employee pre-tax retirement deferrals

`federalAGI = grossWages − modeledPretaxEmployeeRetirement`

`taxableIncome = max(0, federalAGI − standardDeduction)`

Tax is then calculated progressively across the applicable brackets.

For years after 2026, CollegeTab holds 2026 current-law structure constant in real terms by indexing bracket thresholds and the standard deduction with `policyIndexRate` (the UI currently uses the general inflation assumption). This is a planning convention, not a prediction of future legislation.

Not currently modeled in federal income tax:

- tax credits
- itemized deductions
- special deductions (including situation-specific provisions)
- non-wage income
- AMT
- spouse wages

For Married Filing Jointly, the UI explicitly warns that the modeled salary is treated as the household's only wage income.

## 9. State income tax

The state layer contains all 50 states plus the District of Columbia and uses a 2026 wage-income planning baseline assembled from the Tax Foundation's 2026 state bracket compilation, with explicit state-specific notes where the simplified model omits material features.

The model supports:

- single / married-filing-jointly baseline brackets
- standard deductions where applicable
- modeled personal exemptions / credits in the baseline table
- no-wage-income-tax states
- explicit local income-tax override
- state-specific retirement treatment flags (for example, Pennsylvania employee salary-deferral treatment)

Local taxes are never silently guessed. The user must enter a local wage-tax rate when applicable.

State credits, phaseouts, recapture rules, special deductions, local tax systems, and non-wage income can produce filing results different from this planning estimate. Future state thresholds are projected using the same policy index rate for cross-scenario consistency; this is not a forecast of future state legislation.

## 10. FICA

2026 employee FICA uses:

- Social Security: 6.2% up to the 2026 wage base
- Medicare: 1.45% of wages
- Additional Medicare: 0.9% above the statutory filing-status threshold

The 2026 Social Security wage base is $184,500.

For future years, the wage base is projected by `policyIndexRate` as a long-range planning proxy. CollegeTab does not claim this reproduces the future national-average-wage-index formula.

The Additional Medicare threshold is held at its statutory nominal amount because it is not inflation-indexed under current law.

## 11. Retirement contributions

The engine independently calculates employee and employer retirement contributions.

For 2026 it enforces:

- employee elective-deferral limit: $24,500
- defined-contribution annual-additions limit: $72,000
- qualified-plan compensation limit: $360,000

The employer input is deliberately named `employerContributionRate`, not “match,” because the UI models it as a simple flat percentage of eligible compensation rather than pretending to know a plan-specific matching formula.

The traditional 401(k) is a separate pre-tax decision. For each year, CollegeTab first solves the largest contribution that satisfies both constraints:

- it does not exceed the year-specific elective-deferral limit
- after the contribution and its income-tax effect, modeled wages still cover taxes, the monthly budget, and required student-loan payments

`affordable401Max = max(c) such that salary − c − taxes(c) − annualBudget − requiredLoanPayments ≥ 0`

The saved slider position is a percentage of that dynamic maximum, while the UI displays annual dollars:

`employee401 = affordable401Max × savedSliderRate`

The engine then recalculates federal and state income taxes with `employee401` as a traditional pre-tax deferral. FICA wages are not reduced. A future year's slider dollar amount can therefore change as salary, expenses, loan payments, tax rules, or legal limits change.

`eligibleEmployerCompensation = min(salary, compensationLimit)`

`requestedEmployer = eligibleEmployerCompensation × employerContributionRate`

`employer = min(requestedEmployer, annualAdditionLimit − employee)`

The audit surface warns when a modeled contribution is capped.

Future qualified-plan dollar limits are projected using `policyIndexRate`; this is a planning convention.

## 12. Take-home pay

Annual modeled take-home is:

`takeHome = grossWages − employeeRetirement − federalIncomeTax − stateAndLocalIncomeTax − FICA`

Monthly take-home shown in the scenario summary is:

`monthlyTakeHome = annualTakeHome / 12`

This is annualized after-tax cash flow, not a paycheck withholding estimator.

## 13. Monthly budgets and sectional inflation

The current scenario accepts base-year monthly amounts for housing, food, transportation, healthcare, entertainment, charity, and miscellaneous spending. Each category has its own annual inflation assumption:

`monthlyExpense[k,t] = monthlyExpense[k,0] × (1 + categoryRate[k])^t`

The UI starts with editable planning proxies from the U.S. Bureau of Labor Statistics July 2026 12-month CPI table:

- housing: 3.2% (shelter)
- food: 3.0%
- transportation: 2.9% (transportation services)
- healthcare: 2.7% (medical care services)
- entertainment: 2.6% (recreation)
- charity: 2.5% (all items less food and energy fallback)
- miscellaneous: 2.5% (all items less food and energy fallback)

These rates are a transparent starting snapshot, not forecasts or household-specific inflation estimates. Users can edit every rate. Legacy engine inputs without an `expenses.inflationRates` value use `economy.inflationRate` as a per-category fallback. The general rate also remains the UI's future tax-policy indexing assumption.

Source: [BLS CPI Table 1, July 2026](https://www.bls.gov/news.release/cpi.t01.htm).

Housing remains an expense. Home equity, mortgage principal, property-tax modeling, insurance, and appreciation are not yet part of this step and are explicitly excluded from the displayed net-worth model.

## 14. Emergency savings

The emergency target is repriced annually from essential monthly obligations:

`essentialMonthly[t] = housing[t] + food[t] + transportation[t] + healthcare[t] + misc[t] + requiredLoanPayment[t]`

`emergencyTarget[t] = essentialMonthly[t] × emergencyMonths`

Entertainment and charity still compound by their saved category rates and remain in total monthly spending, but they are intentionally excluded from the emergency target.

Each year's available surplus follows this order:

1. select the employee traditional 401(k) contribution from its tax-aware dynamic maximum
2. recalculate income taxes and cover required student-loan payments plus the monthly budget
3. eliminate any existing modeled cash deficit
4. fill the emergency-savings target
5. apply HSA, Roth IRA, and taxable-brokerage sliders sequentially to the remaining post-tax dollars
6. retain every unassigned dollar as cash/HYSA

The HSA, Roth IRA, and brokerage controls also display annual dollars. Each saved position is a percentage of that destination's year-specific maximum:

`hsaMax = min(remainingPostTax, annualHsaLimit)`

`rothMax = min(remainingAfterHsa, incomeAdjustedRothLimit)`

`brokerageMax = remainingAfterRoth`

HSA eligibility and legal limits are enforced, but HSA payroll tax benefits are not credited in the current cash-flow model. Treating it as post-tax cash flow is conservative and is disclosed in the UI/audit.

If annual cash flow is negative:

1. cash is drawn down
2. taxable brokerage investments are drawn down
3. emergency savings are drawn down
4. remaining shortfall becomes a modeled cash deficit

Emergency savings grow by the selected cash/HYSA rate and are capped at the current year's target. Growth above that target returns to the year's savings pool.

## 15. Investment growth

The user supplies a nominal annual investment-return assumption.

Existing retirement and taxable investment balances compound annually. New retirement contributions and new taxable investment contributions are treated as midpoint-of-year contributions using a half-year geometric growth factor:

`midyearGrowthFactor = sqrt(1 + annualReturn)`

Tax drag on taxable investments is not modeled in this step and is disclosed in the audit.

## 16. Net worth

At each modeled year end:

`netWorth = retirement + taxableInvestments + emergencySavings − cashDeficit − remainingStudentLoanBalance`

The engine supports additional assets/liabilities at the pure-function level, but the current core scenario UI does not ask the user for them yet.

## 17. Opportunity cost

The standalone engine exposes a generic `opportunityCost()` function for dated cash flows.

The core scenario currently uses it to show the future value of modeled family college contributions if those cash flows had instead compounded at the selected investment return through the target age:

`FV = Σ contribution × (1 + return)^(yearsUntilTarget)`

This is labeled **family contribution future value**, not an extra cost or guaranteed investment outcome.

For school-vs-school comparison, CollegeTab shows the modeled target-age net-worth gap. That metric is intentionally not mislabeled as “opportunity cost.”

## 18. Reproducibility

A ready scenario includes a canonical input object with sorted keys and a versioned deterministic fingerprint:

`CT-2026.08.20-v5-XXXXXXXX`

The Calculation Audit exposes the exact canonical input snapshot used for the model. A change in any input produces a different fingerprint.

The fingerprint is an audit identifier, not a cryptographic security hash.

## 19. Sources used for the base-year model

Primary federal sources:

- IRS — 2026 inflation adjustments / Revenue Procedure 2025-32 / IR-2025-103
- IRS — Notice 2025-67 / IR-2025-111 for 2026 retirement-plan limits
- Social Security Administration — 2026 Contribution and Benefit Base
- Federal Student Aid — Direct Loan interest/grace behavior and daily-interest guidance

State planning baseline:

- Tax Foundation — State Individual Income Tax Rates and Brackets, 2026 (published February 17, 2026), derived from state statutes/forms/instructions
- state-specific official sources are used where a known tax-base treatment materially differs from the generic assumption (for example, Pennsylvania retirement deferrals)

## 20. Explicit non-goals for this step

This engine is a planning model, not tax-preparation software, a loan-servicer ledger, an investment guarantee, or a prediction of future law.

The following are intentionally outside Steps 6 + 7:

- production backend
- authentication/cloud sync
- Stripe/billing implementation
- FAFSA/aid optimization
- income-driven repayment / forgiveness qualification
- home-equity and mortgage amortization model
- brokerage tax-lot / capital-gains model
- Social Security benefit projection
- employer-specific retirement-plan matching formulas

Those should be separate features later rather than hidden assumptions inside this engine.
