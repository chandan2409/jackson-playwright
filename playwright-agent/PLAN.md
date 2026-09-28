# Jackson Firelight POC — Implementation Status

## Goal

Jackson Firelight handover: Cursor config, two wizard scripts, **DOM** baseline capture, change detection, HITL self-heal.

## Done

- [x] `jackson-tests/` Playwright package (Elite Access II / Colorado / Boun)
- [x] Agent prompts for Firelight FLQANEXT
- [x] `/automate`, `/detect-changes`, `/heal`, `/file-jira`
- [x] `.cursor/` rules + commands
- [x] Script 1 + Script 2 against live Firelight
- [x] Baseline capture stores serialized page DOM (`html` / `htmlHash`) plus interactive inventory
- [x] Change detector walks all wizard pages
- [x] Self-heal reads `*.locators.json` on every wizard POM
- [x] Change review UI

## Recapture

Existing Day 6 JSON under `tests/data/baselines/baseline-2026-09-23/` is interactive-only. Re-run `npm run baseline:capture` to freeze full DOM HTML on each page.
