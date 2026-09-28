# /detect-changes — Day 8 UI Change Detection

Compare the frozen Firelight baseline to the current UI and emit a change report.

## Usage

```
/detect-changes
```

## Steps

1. Confirm baseline exists: `jackson-tests/tests/data/baselines/CURRENT`
2. Ensure `change-tickets.json` has announced (expected) changes from Jackson Day 7 tickets
3. Run:
   ```bash
   cd jackson-tests && npm run detect:changes
   ```
4. Invoke `change-detector` agent to review and refine classifications in `latest-change-report.json`
5. Present summary:
   - Total / expected / unexpected
   - Table of changeId, page, field, severity, classification, healAction
6. Ask user which expected changes to **accept** for `/heal`
7. Do not modify scripts in this command

## Output

- `jackson-tests/tests/reports/changes/latest-change-report.json`
- Evidence PNGs under `tests/reports/changes/evidence/`
