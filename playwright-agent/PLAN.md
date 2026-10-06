# Jackson Firelight POC — Implementation Status

## Goal

Jackson Firelight handover: Cursor config, two wizard scripts, **DOM** baseline capture, change detection, HITL self-heal.

## Done

- [x] `jackson-tests/` Playwright package (Elite Access II / Colorado / Boun)
- [x] Agent prompts for Firelight FLQANEXT
- [x] `/automate`, `/detect-changes`, `/heal`, `/file-jira`, `/iterate-script1`, `/iterate-script2`
- [x] `.cursor/` rules + commands + skills + hooks
- [x] Script 1 + Script 2 against live Firelight (Wet Signature + DATA ENTRY 100%; primary Proceeds 100%)
- [x] Baseline capture stores serialized page DOM (`html` / `htmlHash`) plus interactive inventory
- [x] Change detector walks all wizard pages
- [x] Self-heal reads `*.locators.json` on every wizard POM
- [x] Change review UI
- [x] Day 6 freeze `jackson-tests/tests/data/baselines/baseline-2026-09-28` (CURRENT)

## Recapture

CURRENT already points at `baseline-2026-09-28` (serialized DOM + inventory). Older folders (`baseline-2026-09-23`, `baseline-2026-09-25`) are historical. Re-run `npm run baseline:capture` only after an accepted `/heal` or when Jackson wants a new freeze.
