# /automate — Firelight Test Generation

Generate Playwright automation for Jackson Firelight from Excel test cases.

## Usage

```
/automate excel <xlsx-or-csv-path> [--dry-run]
```

POC default path: `Boun_POCtestcase.xlsx` (workspace root).

## Workflow

### Mode: `excel` (primary for this POC)

1. Read the Excel/CSV at `<path>`.
2. Parse header context:
   - Jurisdiction (e.g. Colorado)
   - Product (e.g. Elite Access II)
   - Case name (e.g. Boun)
3. Parse each Action row into structured steps with:
   - `page` (New Application Information, Owner, Beneficiaries, Agent, Initial Allocations, Payment Detail, Signing Process)
   - `action` (select | enter | click)
   - `field` / `value`
4. Ensure POMs exist under `jackson-tests/tests/pages/firelight/` for each wizard page.
   - Copy `playwright-agent/templates/page-object.template.ts` and `playwright-agent/templates/locators.template.json` (see `page-object-generator.md`). Never generate `fillByLabel`-only POMs.
   - If missing or stale: invoke `page-object-generator` using `jackson-tests/tests/data/.snapshots/<page>.json` when present, else live DOM, else Excel-derived field list.
5. Ensure shared flow helper `jackson-tests/tests/utils/wizard-flow.ts` covers all steps.
6. Produce / refresh **two** scripts from `playwright-agent/templates/spec-file.template.ts`:
   - `jackson-tests/tests/specs/script-1-happy-path.spec.ts` — Excel data as-is
   - `jackson-tests/tests/specs/script-2-variant-path.spec.ts` — alternate fixture (`variantPathData`) so scripts are distinct
7. Update fixtures in `jackson-tests/tests/data/fixtures/case-data.ts`.
8. If `--dry-run`, show planned files without writing.

### Out of scope for POC automate

- Jira mode
- Figma / visual design mode
- Accessibility suite generation (optional later)

## Output Summary

After generation, display:
- Files created/updated
- Wizard pages covered
- Confirmation that 2 scripts exist
- Warnings (missing credentials, unresolved labels)

## Critical Rules

1. **Never invent Firelight selectors** when live DOM is available — scan and write multi-strategy locators.
2. If Firelight is unreachable, generate label-based skeletons and note that Day 0 access is required to harden locators.
3. Write only into `jackson-tests/`. Never write agent files into the test repo.
4. Generated files must mention only Jackson / Firelight.
5. After generation (with credentials), run `npm run test:script1` and `npm run test:script2` from `jackson-tests/`.
