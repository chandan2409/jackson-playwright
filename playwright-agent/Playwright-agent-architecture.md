# Playwright Agent — Jackson Firelight Architecture

## Purpose

Cursor-driven agent that keeps Firelight UI Playwright scripts alive:

Excel → 2 scripts + baseline → detect changes → HITL accept → self-heal.

## Components

```
.cursor/              Cursor rules, commands, mcp.json (what Jackson evaluates)
playwright-agent/     Cursor agent runbooks + templates
jackson-tests/        Playwright execution target
```

## Agents

| Agent | Role |
|-------|------|
| test-generator | Specs from Excel steps (`templates/spec-file.template.ts`) |
| page-object-generator | POMs + locator sidecars (`templates/page-object.template.ts`, `templates/locators.template.json`) |
| script-2-iterator | Run variant script, fix from screenshot, repeat |
| change-detector | Baseline diff + expected/unexpected |
| self-healer | Apply accepted repairs |

Live page captures also write `jackson-tests/tests/data/.snapshots/<page>.json` for POM/heal reuse. Detect still walks Firelight vs CURRENT baseline; the cache is not a substitute for that walk.

## Day 8 report contract

Schema: `jackson-tests/tests/reports/changes/change-report.schema.json`

Emitter: `jackson-tests/tests/utils/change-detector.ts` (`npm run detect:changes`)

## Auth

`jackson-tests/tests/auth.setup.ts` persists `storageState` to `.auth/firelight-state.json`. Specs depend on the `setup` project.
