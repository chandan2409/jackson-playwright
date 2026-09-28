# Automate Firelight scripts from Excel

Generate or refresh the Jackson Firelight Playwright scripts from the POC Excel test case.

## Steps

1. Read `Boun_POCtestcase.xlsx` (or path the user provides)
2. Follow `playwright-agent/commands/automate.md`
3. Use agents in `playwright-agent/agents/test-generator.md` and `page-object-generator.md`
4. Copy from `playwright-agent/templates/` (`page-object.template.ts`, `locators.template.json`, `spec-file.template.ts`) — do not free-form POMs or specs
5. Prefer `jackson-tests/tests/data/.snapshots/<page>.json` (filled by baseline/detect) as the DOM source for locator strategies
6. Write only into `jackson-tests/`
7. Ensure both scripts exist:
   - `jackson-tests/tests/specs/script-1-happy-path.spec.ts`
   - `jackson-tests/tests/specs/script-2-variant-path.spec.ts`
8. Summarize files touched
