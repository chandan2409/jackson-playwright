# Detect Firelight UI changes

Compare the frozen Day 6 baseline to the live Firelight UI and emit a Day 8 change report.

## Steps

1. Follow `playwright-agent/commands/detect-changes.md`
2. Run `cd jackson-tests && npm run detect:changes` when possible
3. Review `jackson-tests/tests/reports/changes/latest-change-report.json`
4. Summarize expected vs unexpected
5. Ask which change IDs to accept for `/heal`
6. If there are unexpected rows, mention optional `/file-jira` (Markdown stays; Jira is a copy)
7. Do not modify scripts

Internal confidence (no live Firelight):

```bash
cd jackson-tests && npm run detect:rehearse && npm run heal:rehearse
```

Simulates Owner DOM + First Name → Given Name (expected + ticket), SSN removed, email/DOB/Preferred Name added. Heals only `tests/data/rehearsal/locators/` (accept CHG-002), not live POMs.
