# Iterate script 1 until green

Run the happy-path Playwright test, fix the failure from evidence, and repeat. Do this in this chat so the user does not rerun by hand.

Success: Signing Process, **Wet Signature** checked, DATA ENTRY **100%**. Do not CONTINUE, print, upload, or Submit for Review.

Primary Proceeds `%` must be **100** (live toast: PRIMARY allocation must total 100%). If the bar is stuck (~98%), click **Open Page List** and fix Beneficiaries.

## Loop (max 8 rounds)

1. Run:
   ```bash
   cd jackson-tests && npm run test:script1
   ```
2. If pass: stop. Summarize what was fixed.
3. If fail:
   - Read the latest `test-results/**/test-failed-1.png`
   - Read `error-context.md` and the stack trace
   - Change only `jackson-tests/` (POM, locators, `form-helpers.ts`, `wizard-flow.ts`)
   - Match **live** labels/radios from the screenshot, not Excel wording if they differ
   - Scope Yes/No to the question group (never click the first Yes/No on the page)
   - Do not wait for iframes unless the screenshot shows one
   - Use Open Page List to see which wizard step failed
4. Same error twice with no new screenshot info → stop and report blocker.
5. Do not commit unless the user asks.

## Stop conditions

- Script 1 passes, or
- 8 rounds, or
- Blocker (login, captcha, missing product)
