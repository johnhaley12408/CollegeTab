# CollegeTab — Steps 1 + 2 QA Report

> Historical snapshot for the Step 1–2 milestone. For the current college-cost/data implementation, see `QA_STEPS_3_4.md`.

Validated: 2026-08-19

## Check 1 — Logic / sellability
PASS

- Established a reusable design system instead of page-specific styling rules.
- Connected the landing page to both create-account and returning-user sign-in flows.
- Built the full product shell: overview, setup, colleges, compare, projection, saved plans, account and billing.
- Removed misleading “financial readiness” language; the meter now measures workspace setup only.
- Comparison school selection is user-controlled instead of silently assuming the first two schools.
- Account default perspective now actually applies to newly created plans.
- Multiple local plans can be created, loaded and deleted.
- Blank financial outputs remain blank until real engines are connected.
- Public/default content remains universal and contains no founder/user-specific school, major, state, location or career path.

## Check 2 — Aesthetic
PASS

- Preserved the established warm-paper / ink / lime / coral / blue palette.
- Preserved square geometry, oversized display typography, thin separators and hard color fields.
- Avoided generic AI/SaaS patterns: no rounded-card ecosystem, purple gradient hero, sparkle iconography or fake chat UI.
- Removed blur from the generic shared surface primitive so the system does not drift into glassmorphism.
- Desktop uses a disciplined fixed product rail; mobile uses a compact header, off-canvas secondary nav and four-item bottom nav.
- Comparison selectors use semantic lime/coral top rules to connect visually to the two scenarios without introducing card clutter.
- Desktop and mobile renders were visually reviewed for the landing page, auth shell, overview, comparison workspace and design-system page.

## Check 3 — Functionality / accuracy
PASS FOR THIS STAGE

No financial calculation engine was added in Steps 1–2, so there are no tuition, loan, tax, take-home-pay or net-worth formulas to validate yet. Financial outputs intentionally remain unavailable.

Validated behavior:
- JavaScript syntax checks pass for landing, auth and app scripts.
- HTML parses successfully for all entry pages.
- CSS brace balance passes for all stylesheets.
- No runtime JavaScript errors appeared in the browser render tests.
- Onboarding validation works and rejects invalid timeline inputs.
- Setup progress updates correctly.
- Explicit `$0` starting salary is treated as a supplied value, not as missing data.
- Three colleges can be added and independently selected in the A/B comparison controls.
- Invalid stored years, priorities, salaries and unsafe IDs are normalized before use.
- User-selected default perspective is applied to a new plan.
- Hidden mobile rail is inert so off-screen links do not remain keyboard-focusable.
- Local-storage failure produces `Local save unavailable` instead of falsely claiming the plan was saved.
- Reduced-motion preference suppresses decorative pointer response in the app.
- Founder/user-specific identifier audit returns no matches.

## Deferred by design at the Step 1–2 milestone
The following were intentionally not implemented in that earlier milestone and must not be represented as production-ready until their later three-step checks pass:
- Real authentication / cloud sync.
- Comprehensive U.S. college search and cost data.
- Financial-aid and funding calculations.
- Loan calculations.
- Federal/state/payroll tax calculations.
- Living-cost engine.
- Investment and net-worth projections.
- Stripe checkout, webhooks and entitlements.
