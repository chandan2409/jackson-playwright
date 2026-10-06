# jackson-tests

Runnable Playwright suite for the Jackson Firelight POC.

Folder agent notes: `AGENTS.md` in this directory.

## Scripts

| npm script | Purpose |
|------------|---------|
| `npm run auth:setup` | Login once → `.auth/firelight-state.json` |
| `npm run test:script1` | Happy-path: headed Firelight through Wet Signature + DATA ENTRY 100% |
| `npm run test:script2` | Variant-path: Boun-Variant / $25,000; same signing success; live primary proceeds 100% |
| `npm run baseline:capture` | Day 6 baseline freeze |
| `npm run detect:changes` | Day 8 change report (live wizard vs CURRENT baseline) |
| `npm run detect:rehearse` | Internal detect dry-run (no Firelight) |
| `npm run heal:rehearse` | Internal heal dry-run after detect:rehearse |
| `npm run ui` | Change review at http://127.0.0.1:5173 (coverage, HTML report, File to Jira) |
| `npm run report` | Playwright HTML report for the **last** run |
| `npm run report:all` | Merge retained blob reports → `playwright-report-all` |
| `npm run report:history` | Open the merged all-runs HTML report |
| `npm run artifacts:prune` | Delete `test-results/runs/` and `blob-report/runs/` older than `ARTIFACT_RETENTION_DAYS` (default 14) |

## Layout

```
tests/
  pages/firelight/   # POMs + locator sidecars
  specs/             # script-1 + script-2
  data/
    fixtures/        # case data
    coverage-matrix.json  # Excel step → FL-HP-001 / FL-VP-001 (Change review last-run)
    baselines/       # frozen DOM (html + interactive inventory)
    .snapshots/      # last live page capture (gitignored; POM/heal cache)
    change-tickets.json
  reports/changes/   # latest-change-report.json is committed; timestamped copies are gitignored
  utils/             # env, locators, baseline, detector, wizard flow
```

Copy `.env.example` → `.env` and fill Day 0 credentials before live runs.

Optional Jira: `/file-jira` in Cursor (MCP) or **File unexpected to Jira** on Change review (needs `JIRA_API_TOKEN`). Live Detect PNGs under `tests/reports/changes/evidence/` are attached to the ticket.
