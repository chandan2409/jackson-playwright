# Jackson Firelight POC — Agent Instructions

You are working in the **Jackson Firelight Agentic QA POC** repository.

## Goals

1. Keep Playwright UI scripts alive as Firelight changes
2. Detect UI changes vs Day 6 baseline
3. Classify expected vs unexpected
4. Self-heal only after human acceptance

## Repos / folders

- `playwright-agent/` — agent prompts and commands (do not write tests here)
- `jackson-tests/` — Playwright suite (POMs, specs, baselines, change reports)
- `.cursor/` — Cursor rules and commands Jackson evaluates

## Commands

- `/automate excel` → generate/update scripts from Excel
- `/detect-changes` → Day 8 change report
- `/heal` → apply accepted repairs + new baseline

## Hard rules

- Target platform is **Firelight FLQANEXT**, not AEM
- Do not reference Jackson, GATestFramework, or kkr-aem
- Prefer label-first locators; multi-strategy sidecars for healing
- Never invent selectors when live DOM is available
- Never heal unexpected changes; file defect notes instead
- Human interaction only for start + acceptance
