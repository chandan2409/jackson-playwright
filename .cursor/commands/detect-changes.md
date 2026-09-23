# Detect Firelight UI changes

Compare the frozen Day 6 baseline to the live Firelight UI and emit a Day 8 change report.

## Steps

1. Follow `playwright-agent/commands/detect-changes.md`
2. Run `cd jackson-tests && npm run detect:changes` when possible
3. Review `jackson-tests/tests/reports/changes/latest-change-report.json`
4. Summarize expected vs unexpected
5. Ask which change IDs to accept for `/heal`
6. Do not modify scripts

Internal confidence (no live Firelight):

```bash
cd jackson-tests && npm run detect:rehearse && npm run heal:rehearse
```

Simulates First Name → Given Name (expected + ticket) and SSN removed / email added (unexpected → defect). Heals only `tests/data/rehearsal/locators/`, not live POMs.
