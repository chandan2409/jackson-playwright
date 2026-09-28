# /heal — Self-Heal After Human Acceptance

Apply accepted expected changes to Firelight scripts and refresh the baseline.

## Usage

```
/heal --accept CHG-001,CHG-003 [--reject CHG-002]
```

## Steps

1. Load `jackson-tests/tests/reports/changes/latest-change-report.json`
2. Require explicit accepted IDs (HITL). If none provided, stop and ask.
3. Invoke `self-healer` agent with accepted/rejected IDs
4. Update locators, POMs, fixtures, assertions as needed. Copy strategy shape from `playwright-agent/templates/locators.template.json`. Prefer `jackson-tests/tests/data/.snapshots/<page>.json` from the last detect/baseline walk.
5. Write defect notes for unexpected/rejected changes
6. Do not create Jira issues here; point to `/file-jira` if the user wants a backlog copy
7. Run `npm run baseline:capture` to write the new self-healed baseline
8. Optionally re-run `npm run test:script1` and `npm run test:script2`
9. Summarize files changed and recommend commit message

## Critical Rules

- Never heal unexpected changes into green tests
- Never skip human acceptance
- Keep diffs minimal and tied to changeIds
