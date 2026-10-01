# Iterate script 2 until green

Run the **variant-path** Playwright test (`FL-VP-001`), fix the failure from evidence, and repeat. Do this in this chat so the user does not rerun by hand.

Script 2 uses `runFirelightWizard` with `variantPathData` (Boun-Variant, payment **$25,000**). Shared POMs already work for Script 1; only change what the screenshot proves is wrong.

Success is the same as Script 1: Wet Signature + DATA ENTRY **100%**. Do not CONTINUE or submit.

Live Beneficiaries: type **100** in primary Proceeds `%` (validation). Do not type 60 into a single primary field. Fixture may still list Excel 60/40 for coverage; the live field is 100. Do not add a second Primary at 40%.

## Loop (max 8 rounds)

1. Run:
   ```bash
   cd jackson-tests && npm run test:script2
   ```
2. If pass: stop. Summarize what was fixed. If you changed `wizard-flow.ts` or `form-helpers.ts`, note that Script 1 should be re-run.
3. If fail:
   - Read the latest `test-results/**/test-failed-1.png`
   - Read `error-context.md` and the stack trace
   - Change only `jackson-tests/` (POM, locators, `form-helpers.ts`, `wizard-flow.ts`, `case-data.ts`)
   - Match **live** labels/radios from the screenshot, not Excel wording if they differ
   - Scope Yes/No to the question group (never click the first Yes/No on the page)
   - Do not wait for iframes unless the screenshot shows one
   - Variant-only data: case name **Boun-Variant**, payment **25000**. Live primary proceeds **100**. Fixture 60/40 is Excel-only.
   - If DATA ENTRY is not 100%, Open Page List → failed step (usually Beneficiaries) → enter 100
   - If live UI has no Add Beneficiary control, do not invent one
4. Same error twice with no new screenshot info → stop and report blocker.
5. Do not commit unless the user asks.

## Stop conditions

- Script 2 passes, or
- 8 rounds, or
- Blocker (login, captcha, missing product)
