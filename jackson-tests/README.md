# jackson-tests

Runnable Playwright suite for the Jackson Firelight POC.

## Scripts

| npm script | Purpose |
|------------|---------|
| `npm run auth:setup` | Login once → `.auth/firelight-state.json` |
| `npm run test:script1` | Happy-path wizard |
| `npm run test:script2` | Variant-path wizard |
| `npm run baseline:capture` | Day 6 baseline freeze |
| `npm run detect:changes` | Day 8 change report (live wizard vs CURRENT baseline) |
| `npm run detect:rehearse` | Internal detect dry-run (no Firelight) |
| `npm run heal:rehearse` | Internal heal dry-run after detect:rehearse |
| `npm run ui` | Change review at http://127.0.0.1:5173 (coverage, HTML report, File to Jira) |
| `npm run report` | Playwright HTML report (screenshots / video / traces) |

## Layout

```
tests/
  pages/firelight/   # POMs + locator sidecars
  specs/             # script-1 + script-2
  data/
    fixtures/        # case data
    coverage-matrix.json  # Excel step → FL-HP-001 / FL-VP-001 (Change review last-run)
    baselines/       # frozen DOM (html + interactive inventory)
    change-tickets.json
  reports/changes/   # latest-change-report.json is committed; timestamped copies are gitignored
  utils/             # env, locators, baseline, detector, wizard flow
```

Copy `.env.example` → `.env` and fill Day 0 credentials before live runs.

Optional Jira: `/file-jira` in Cursor (MCP) or **File defects without a Jira key** on Change review (needs `JIRA_API_TOKEN`).
