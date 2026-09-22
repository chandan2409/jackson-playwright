# Automate Firelight scripts from Excel

Generate or refresh the Jackson Firelight Playwright scripts from the POC Excel test case.

## Steps

1. Read `Boun_POCtestcase.xlsx` (or path the user provides)
2. Follow `playwright-agent/commands/automate.md`
3. Use agents in `playwright-agent/agents/test-generator.md` and `page-object-generator.md`
4. Write only into `jackson-tests/`
5. Ensure both scripts exist:
   - `jackson-tests/tests/specs/script-1-happy-path.spec.ts`
   - `jackson-tests/tests/specs/script-2-variant-path.spec.ts`
6. Summarize files touched
