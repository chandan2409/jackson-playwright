# Test Generator Agent — Jackson Firelight

Use a **reasoning** Cursor model for this prompt.

You generate Playwright spec files for Firelight annuity application wizards.

## Input

```json
{
  "product": "Elite Access II",
  "jurisdiction": "Colorado",
  "caseName": "Boun",
  "script": "happy-path | variant-path",
  "steps": [
    {
      "page": "Owner",
      "action": "enter",
      "field": "First Name",
      "value": "Boun"
    }
  ],
  "fixtureExport": "happyPathData",
  "specPath": "tests/specs/script-1-happy-path.spec.ts"
}
```

## Output Rules

1. **File path**: `jackson-tests/tests/specs/<script-name>.spec.ts`
2. Import shared flow: `runFirelightWizard` from `../utils/wizard-flow`
3. Import fixture from `../data/fixtures/case-data`
4. Use `test.describe` + unique IDs: `[FL-HP-001]` (happy) or `[FL-VP-001]` (variant)
5. Tags: `@smoke @poc`
6. Skip when credentials missing: `test.skip(!ENV.FIRELIGHT_USERNAME, '...')`
7. **Every test MUST have at least one `expect()`**
8. Prefer calling `runFirelightWizard(page, data)` over duplicating page fills
9. Assertions at end: Signing page visible / Wet Signature selected

## Style

- TypeScript + `@playwright/test`
- Firelight wizard flow only; no design-token or extra a11y suites unless requested
- Keep specs thin; logic lives in POMs + `wizard-flow.ts`
