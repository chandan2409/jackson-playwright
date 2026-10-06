# jackson-tests

Playwright suite only. Do not put agent prompts here.

- Specs: `tests/specs/` (`script-1-happy-path`, `script-2-variant-path`)
- POMs: `tests/pages/firelight/` + `*.locators.json`
- Run: `npm run test:script1` / `test:script2` (headed). Success = Wet Signature + DATA ENTRY 100%.
- POM/heal cache: `tests/data/.snapshots/<page>.json`
- Detect vs `tests/data/baselines/CURRENT`. Dated `baseline-*/` dumps are ignored by Cursor; use npm detect, not a full HTML read.
- Never write `.env` (copy `.env.example`).
