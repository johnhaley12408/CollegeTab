# Dynamic savings review

Date: 2026-08-20

Financial engine: `2026.08.20-v7`

Savings engine: `2026.08.20-v2`

## 1. Logic and sellability

Status: PASS

- The traditional 401(k) is no longer mixed into a post-tax percentage allocation.
- It is a separate annual-dollar slider that runs before federal and eligible state income-tax calculations.
- The 401(k) maximum is the lower of the applicable legal limit and the amount that still lets modeled wages cover taxes, the monthly budget, and required student-loan payments.
- The emergency reserve remains protected immediately after the 401(k), taxes, required spending, and any existing cash deficit.
- HSA, Roth IRA, and brokerage sliders use sequential annual-dollar maximums based on the dollars actually remaining and applicable account limits.
- Cash/HYSA automatically receives every unassigned post-tax dollar, so the model never drops surplus or forces it into an investment account.
- Saved slider positions represent a share of each future year's dynamic maximum. This preserves the user's intent while legal limits and affordability change over time.
- Legacy percentage-allocation plans remain readable and migrate into the new slider-rate structure.
- HSA payroll tax benefits are not silently invented. HSA is conservatively treated as a post-tax cash-flow contribution and the limitation is disclosed.

## 2. Aesthetic fit and readability

Status: PASS

- The flow is visually ordered as a lime pre-tax 401(k) stage followed by an ink post-tax stage.
- Controls are hard-edged native range sliders with CollegeTab's ink, lime, coral, and blue system; no rounded SaaS cards were introduced.
- Each slider displays selected annual dollars and its live maximum instead of requiring percentage arithmetic.
- The likely unreadable-text defect was traced to a savings block inheriting white text after its blue background was overridden to paper.
- Savings blocks now set foreground and background colors explicitly. The starting-balance block uses ink on paper, with a blue rule rather than white copy on a mismatched surface.
- Key combinations are high contrast: ink on paper is approximately 15.46:1, ink on lime 15.29:1, cream on ink 17.23:1, and ink on coral 6.63:1.
- The slider grid collapses from two columns to one on smaller screens.

## 3. Functionality and math accuracy

Status: PASS

- A binary search solves the tax-aware affordable 401(k) ceiling to the cent.
- Federal and eligible state income taxes are recomputed after the selected traditional 401(k); FICA is unchanged.
- Account limits are year-aware planning values, including Roth income phaseout and HSA coverage eligibility.
- The post-tax allocator preserves every available dollar across HSA, Roth IRA, brokerage, and cash/HYSA.
- Moving an earlier slider changes the later sliders' maximums.
- Changing any saved slider changes the canonical input and reproducible model fingerprint.
- Automated coverage verifies the affordability solver, 401(k) tax effect, FICA treatment, sequential maxima, account caps, dollar preservation, legacy migration, and the required range-slider UI.

Validation command:

```bash
bash tests/run-all.sh
```
