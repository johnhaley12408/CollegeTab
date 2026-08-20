# Sectional inflation review

Date: 2026-08-20

Introduced in engine: `2026.08.20-v6`

Reverified with current engine: `2026.08.20-v7`

## 1. Logic and sellability

Status: PASS

- Every monthly budget category now has a separately saved annual inflation rate.
- Category rates live beside the budget they affect, rather than being hidden in the global assumptions panel.
- The general inflation input is relabeled as the tax-policy index and legacy/general fallback, preventing the impression that it overrides saved category rates.
- Defaults are transparent, editable July 2026 BLS category-CPI planning proxies. They are described as a current snapshot, not a forecast.
- Transportation uses transportation services and healthcare uses medical care services. Charity and miscellaneous use the 2.5% core CPI fallback because there is no direct charity CPI category.
- Existing saved plans migrate safely: normalized plans receive the visible preset, while direct legacy engine inputs continue to use `economy.inflationRate` if category rates are absent.
- Any saved category-rate change becomes part of the canonical reproduction input and therefore changes the model fingerprint.

Source: [U.S. Bureau of Labor Statistics, CPI Table 1 — July 2026](https://www.bls.gov/news.release/cpi.t01.htm).

## 2. Aesthetic fit

Status: PASS

- The new controls use CollegeTab's existing editorial typography, hard-edged rule grid, lime/blue/ink palette, and form components.
- The detailed rates are grouped in one open, scannable disclosure below the monthly allowances, preserving the Step 04 hierarchy.
- Labels state the source proxy directly (shelter, services, recreation, or core fallback).
- The four-column desktop grid collapses to two columns on tablets and one column on small screens.
- Preset restoration has its own action, separate from restoring state-level monthly dollar amounts.

## 3. Functionality and math accuracy

Status: PASS

- Formula: `amount[k,t] = amount[k,0] × (1 + rate[k])^t`.
- Year zero remains the exact entered monthly amount.
- Each of the seven rates accepts 0% through 20% and is validated independently.
- Housing, food, transportation, healthcare, miscellaneous, and required loan payments feed the annually repriced emergency target.
- Entertainment and charity inflate in total spending but are excluded from the emergency target.
- Resolved category rates appear in the engine assumptions audit.
- Automated coverage verifies distinct compounding, legacy fallback, invalid-rate rejection, fingerprint changes, reserve inclusion/exclusion, BLS preset metadata, and all seven UI controls.

Validation command:

```bash
bash tests/run-all.sh
```
