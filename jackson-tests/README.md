# jackson-tests

Runnable Playwright suite for the Jackson Firelight POC.

## Scripts

| npm script | Purpose |
|------------|---------|
| `npm run auth:setup` | Login once → `.auth/firelight-state.json` |
| `npm run test:script1` | Happy-path wizard |
| `npm run test:script2` | Variant-path wizard |
| `npm run baseline:capture` | Day 6 baseline freeze |
| `npm run detect:changes` | Day 8 change report |

## Layout

```
tests/
  pages/firelight/   # POMs + locator sidecars
  specs/             # script-1 + script-2
  data/
    fixtures/        # case data
    baselines/       # frozen DOM snapshots
    change-tickets.json
  reports/changes/   # Day 8 reports + schema
  utils/             # env, locators, baseline, detector, wizard flow
```

Copy `.env.example` → `.env` and fill Day 0 credentials before live runs.
