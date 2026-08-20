# CollegeTab Design System v1.1

## Product character
CollegeTab should feel decisive, intelligent, tactile, and unusually clear for a financial planning product. The visual language is borderless neo-brutalism: square geometry, oversized typography, hard color fields, restrained hard shadows, thin separators, and intentionally sparse decoration. It should not resemble a generic AI/SaaS dashboard.

## Non-negotiables
1. Public/default content stays universal. Never use a founder/user's school, major, state, residency, career, salary, family finances, or other personal context as generic product copy.
2. No fabricated financial precision. Empty or incomplete models display `—`, `Input needed`, `Not modeled yet`, or another explicit unavailable state.
3. One strong action per surface. Secondary actions are visually quieter and destructive actions are never visually dominant.
4. Square geometry by default. No pill-card ecosystem, excessive rounding, glassmorphism, purple gradients, sparkle icons, fake AI-chat motifs, or ornamental dashboards.
5. Motion supports state, hierarchy, or pointer presence. It never becomes the product and never carries meaning by itself.
6. Dense financial information is structured with whitespace and separators before containers. A bordered/card-heavy interface is a failure state.
7. Color has a job. Accent colors are semantic, not randomly rotated for decoration.
8. Every interactive control must do something meaningful in the current build or clearly disclose that the integration is not connected yet.

## Palette roles
- Paper `#F1EEE6`: primary background and low-density workspace canvas.
- Ink `#171717`: dense data surfaces, navigation, high-focus states.
- Lime `#C8FF5B`: readiness, completion, confirmed positive state.
- Coral `#FF715B`: consequential decisions, comparison attention, warnings that require a choice.
- Blue `#5A6CFF`: primary action, active navigation, forward movement.
- Cream `#FFFAF0`: text and elevated light content on ink.
- Wash `#E7E3DA`: low-emphasis controls, disabled/empty structures and neutral placeholders.
- Good `#237A45`: restrained status text for completed/saved states.
- Danger `#BD3D2D`: destructive actions and validation failures.

## Typography
- Archivo Black: display headlines only. Uppercase, very tight tracking, short lines. Never use it for dense data or body copy.
- Manrope: body copy, controls, navigation, explanations, form text.
- DM Mono: numbers, source labels, assumptions, statuses, timestamps, metadata, compact data labels.
- Numeric outputs should use tabular-feeling alignment and avoid false decimal precision unless the underlying engine genuinely supports it.

## Layout
- 4px spacing base with 24–96px composition gaps.
- Marketing pages can use asymmetry and rotation; the logged-in product uses disciplined grids and strong alignment.
- Desktop product navigation uses a fixed ink rail. Mobile uses a compact header, a slide-out rail for secondary pages, and a four-item bottom nav for core work.
- Data-heavy areas use thin separators rather than boxed cards.
- Hard shadows are emphasis devices, not a default container style.
- Primary workspace content should remain readable from 320px mobile widths through large desktop displays.

## Core component hierarchy
Shared primitives live in `design-system.css`:
- Brand mark + wordmark
- Primary, positive, decision, paper, quiet and destructive actions
- Icon buttons
- Labels, inputs, selects and text areas
- Status badges and inline notices
- Flat semantic surfaces
- Empty states
- Selection controls
- Focus behavior
- Motion/reduced-motion behavior

## Product data states
Every future financial module must visibly distinguish these states:
1. **Empty** — the user has not supplied enough information.
2. **Input needed** — a calculation cannot run without a required assumption.
3. **Data pending** — an external source/integration has not returned verified data.
4. **Calculated** — the engine has enough validated inputs to calculate an output.
5. **User override** — the user intentionally replaced a sourced/default value.
6. **Warning** — a value is valid but materially uncertain or consequential.
7. **Error** — a value or integration failed validation.

Do not use zero to represent missing data. A blank financial output and a calculated $0 are different states.

## Forms and onboarding
- Labels are always visible; no floating-label patterns.
- Optional fields say `Optional` where ambiguity would otherwise create pressure.
- Required fields are validated before a step is considered complete.
- User-selected defaults may prefill future plans; founder/user-specific defaults may never be embedded in public code.
- Onboarding should organize the model, not force guesses. Unknown values can remain unknown until the relevant calculation needs them.

## Motion
- Fast: 150ms for hover/input feedback.
- Base: 240ms for state transitions.
- Slow: 650ms for marketing reveals.
- Cursor/background response is subtle and never required to understand the interface.
- Primary actions may shift a few pixels; dense product surfaces stay stable.
- Honor both `prefers-reduced-motion` and the in-product reduced-motion preference.

## Accessibility
- Keyboard focus must remain visible with at least a 3px high-contrast outline.
- Hidden mobile navigation must not remain keyboard-focusable while off-canvas.
- Active navigation exposes `aria-current`.
- Selection controls expose native radio/checkbox semantics even when visually customized.
- Color is never the only indicator of status.
- Minimum product control height target: 44px.
- Decorative grain/cursor effects are pointer-inert and ignored by assistive technology.

## Accuracy UX
CollegeTab should expose source dates, assumptions, overrides, and calculation detail once engines are connected. Until then, the app shell deliberately uses blank values instead of demo calculations that could be mistaken for advice.

Any future estimate must answer four questions in the interface or expandable detail:
1. What inputs created this number?
2. What source or tax year does it use?
3. What assumptions were made?
4. Can the user override the assumption?

## Content voice
- Short, direct, concrete.
- Explain tradeoffs without pretending certainty.
- Avoid AI clichés, hype language, fake social proof, and vague claims such as “smart insights.”
- Prefer `Why the dashes?` over generic helper text like `Data unavailable`.
- Default examples stay generic unless the user explicitly requests a personalized demonstration.

## Three-step release check
Every website change must pass all three checks before it is considered complete:

### 1. Logic / sellability
- Does the feature solve a real user problem?
- Does the action have a consequence in the current build?
- Does it reduce confusion, increase trust, or improve the buying/use case?
- Is anything misleading, redundant, or prematurely complex?

### 2. Aesthetic
- Does it fit the borderless neo-brutalist visual system?
- Is color being used semantically?
- Is hierarchy clear without card clutter?
- Does it remain coherent on desktop and mobile?

### 3. Functionality / accuracy
- Does the interaction work with keyboard, mouse/touch, reloads, navigation and local persistence where relevant?
- Are inputs validated and normalized?
- Are missing data and zero values correctly distinguished?
- If a calculation exists, is the formula correct, defensible, and the best reasonable estimate available?
- Are uncertainty and source dates visible where they matter?
