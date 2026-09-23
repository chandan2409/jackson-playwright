# Jackson Firelight POC — Implementation Status

## Goal

Build a Jackson Firelight handover repo with Cursor config, two wizard scripts, baseline capture, and change detection / self-heal.

## Done

- [x] `jackson-tests/` Playwright package
- [x] Agent prompts rewritten for Firelight
- [x] `/automate`, `/detect-changes`, `/heal`
- [x] `.cursor/` rules + commands
- [x] Script 1 + Script 2 skeletons from Excel
- [x] Baseline capture + change-report schema

## Pending Day 0+

- [ ] Live Firelight credentials
- [ ] Harden login selectors
- [ ] Full wizard DOM locator capture
- [ ] Day 6 baseline commit
- [ ] Day 8 detect + heal demo
