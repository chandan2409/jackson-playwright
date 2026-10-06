# Jackson Firelight POC — Cursor Agent Instructions

This is a **Cursor** POC. Jackson evaluates `.cursor/` (rules, commands, skills, hooks, MCP).

You are working in the **Jackson Firelight Agentic QA POC** repository.

## Goals

1. Keep Playwright UI scripts alive as Firelight changes
2. Detect UI changes vs Day 6 baseline
3. Classify expected vs unexpected
4. Self-heal only after human acceptance

## Folders

- `.cursor/` — rules, `/` commands, skills, hooks, MCP (Jackson-evaluated)
- `playwright-agent/` — detailed runbooks, agent prompts, templates
- `jackson-tests/` — Playwright suite (POMs, specs, baselines, change reports)

Write tests only into `jackson-tests/`. Never write test files into `playwright-agent/`.

## Cursor commands and skills

Same workflows exist as `.cursor/commands/*.md` and `.cursor/skills/<name>/SKILL.md`.

- `/automate excel` → generate/update scripts from Excel
- `/detect-changes` → Day 8 change report
- `/heal` → apply accepted repairs + new baseline
- `/file-jira` → optional Jira copy of unexpected Markdown defects (Atlassian MCP)
- `/iterate-script1` → run script 1, fix from screenshot, repeat until green
- `/iterate-script2` → run script 2 (variant), fix from screenshot, repeat until green

## Agents (prompts)

Suggested Cursor models in the table are **guidance only** (the chat picker is not wired from these files). There is no `script-1-iterator` prompt; `/iterate-script1` is command + skill.

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
- Script success: Wet Signature checked and DATA ENTRY **100%**. Do not CONTINUE or submit.
- Primary beneficiary Proceeds must total **100%** on the live form (Firelight validation). Script 2 fixture may still store Excel 60/40; do not type 60 into a single primary field.
- Incomplete wizard: **Open Page List** → failed page (usually Beneficiaries) → fix → return to Signing.

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

## Token optimization

See `.cursor/rules/token-optimization.mdc` (always-on) and skill `pom-from-snapshots`. Session start hook repeats a one-line budget (IDE only; Cloud Agents rely on the rule).

## Hard rules

- Target platform is **Firelight FLQANEXT** only
- Stay on Firelight wizard UI
- Never invent selectors when live DOM is available
- Never heal unexpected changes; file defect notes instead
- Human interaction only for start + acceptance
- Frontend-only; Excel/Markdown defects are source of truth (no Xray)
- Optional Jira via Atlassian MCP (`/file-jira`) is a copy of unexpected defects only
