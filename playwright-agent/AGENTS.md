# Jackson Firelight POC — Cursor Agent Instructions

This is a **Cursor** POC. Jackson evaluates `.cursor/` (rules, commands, MCP).

You are working in the **Jackson Firelight Agentic QA POC** repository.

## Goals

1. Keep Playwright UI scripts alive as Firelight changes
2. Detect UI changes vs Day 6 baseline
3. Classify expected vs unexpected
4. Self-heal only after human acceptance

## Folders

- `.cursor/` — Cursor rules and commands Jackson evaluates (source of truth for slash commands)
- `playwright-agent/` — detailed runbooks, agent prompts, templates
- `jackson-tests/` — Playwright suite (POMs, specs, baselines, change reports)

Write tests only into `jackson-tests/`. Never write test files into `playwright-agent/`.

## Cursor commands

- `/automate excel` → generate/update scripts from Excel
- `/detect-changes` → Day 8 change report
- `/heal` → apply accepted repairs + new baseline
- `/file-jira` → optional Jira copy of unexpected Markdown defects (Atlassian MCP)
- `/iterate-script1` → run script 1, fix from screenshot, repeat until green
- `/iterate-script2` → run script 2 (variant), fix from screenshot, repeat until green

## Agents (prompts)

| Agent | Purpose | Cursor model routing |
|-------|---------|----------------------|
| `test-generator` | Specs from Excel steps | reasoning model |
| `page-object-generator` | POMs + locator sidecars from live DOM | fast / low-cost model |
| `script-2-iterator` | Run Script 2, fix from screenshot, repeat | reasoning model |
| `change-detector` | Baseline vs current; expected vs unexpected | reasoning model |
| `self-healer` | Update locators/POMs after HITL | reasoning model |

## Conventions

- POM classes in `jackson-tests/tests/pages/firelight/` with `*.locators.json` sidecars
- Specs in `jackson-tests/tests/specs/` — two scripts: happy path + variant path
- Auth via `storageState` from `jackson-tests/tests/auth.setup.ts`
- Label-first locators for Firelight form fields
- Every test MUST contain at least one `expect()`

## Wizard pages (detect and heal cover all)

1. Select Application
2. New Application Information
3. Owner
4. Beneficiaries
5. Agent
6. Systematic Investment
7. Initial Allocations
8. Add-On Benefits
9. Payment Detail
10. Signing Process

Baselines store **serialized DOM** (`html` + `htmlHash`) plus an interactive field inventory. Self-heal patches `*.locators.json` sidecars for every page object under `tests/pages/firelight/`.

## Token optimization (implemented in this layout)

1. Fast model for mechanical POM extraction; reasoning model for detect/heal
2. Split agent prompts from generated tests so prompts do not scan the whole suite
3. Use templates under `playwright-agent/templates/` instead of free-form generation (`page-object-generator.md`, `test-generator.md`, `/automate`)
4. Cache DOM snapshots under `jackson-tests/tests/data/.snapshots/` (`captureCurrentPage` during baseline/detect; POM/heal reuse)
5. Prefer `playwright-agent/AGENTS.md` + `jackson-tests/README.md` over dumping the repo

## Hard rules

- Target platform is **Firelight FLQANEXT** only
- Stay on Firelight wizard UI
- Never invent selectors when live DOM is available
- Never heal unexpected changes; file defect notes instead
- Human interaction only for start + acceptance
- Frontend-only; Excel/Markdown defects are source of truth (no Xray)
- Optional Jira via Atlassian MCP (`/file-jira`) is a copy of unexpected defects only
