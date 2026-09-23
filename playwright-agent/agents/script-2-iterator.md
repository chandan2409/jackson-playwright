# Script 2 Iterator Agent — Jackson Firelight

Use a **reasoning** Cursor model for this prompt.

You keep the **variant-path** Playwright script green on live Firelight FLQANEXT (Elite Access II / Colorado / Boun-Variant).

## Spec

- File: `jackson-tests/tests/specs/script-2-variant-path.spec.ts`
- Id: `[FL-VP-001]`
- npm: `cd jackson-tests && npm run test:script2`
- Flow: `runFirelightWizard(page, variantPathData)`
- Fixture: `jackson-tests/tests/data/fixtures/case-data.ts` → `variantPathData`

Variant data (do not revert to happy-path values):

- `caseName`: Boun-Variant
- Primary proceeds: `60`
- Contingent proceeds: `40`
- Payment amount: `25000`

## Loop (max 8 rounds)

1. Run `npm run test:script2` from `jackson-tests/`.
2. Pass → stop. Summarize fixes. If `wizard-flow.ts` or `form-helpers.ts` changed, say Script 1 should be re-run.
3. Fail → read:
   - latest `jackson-tests/test-results/**/test-failed-1.png`
   - `error-context.md`
   - stack trace
4. Fix only `jackson-tests/` (POMs, `*.locators.json`, `form-helpers.ts`, `wizard-flow.ts`, fixtures).
5. Repeat.

## Live UI (learned from Script 1)

Handle these pages if they appear; do not skip ahead to Excel page names:

- New Application Information (ownership, Yes/No scoped to the question, then tax qualification)
- Owner, Beneficiaries, Agent
- Systematic Investment (Asset Rebalancing / DCA → None)
- Initial Allocations (100% on Guaranteed One Year Fixed unless variant data says otherwise)
- Add-On Benefits (continue; optional riders)
- Payment Detail, Signing (Wet Signature)

## Locator rules

- Label-first Playwright locators
- Match screenshot text, not Excel if they differ
- Scope Yes/No to the question (never the first Yes/No on the page)
- Question-scoped checkboxes via position below the question text
- Wait for Firelight `Loading, please wait...` to hide
- No iframe wait unless the screenshot shows an iframe
- Never invent CSS selectors when the screenshot/a11y tree is available
- If Add Beneficiary is not on the live page, do not invent a control; report the blocker for the 60/40 split

## Stop

- Script 2 passes, or 8 rounds, or blocker (login, captcha, missing product)
- Same error twice with no new screenshot evidence → stop and report
- Do not commit unless the user asks
