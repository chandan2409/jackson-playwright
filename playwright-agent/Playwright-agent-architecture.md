# Playwright Agent — Jackson Firelight Architecture

## Purpose

Cursor-driven agent that keeps Firelight UI Playwright scripts alive:

Excel → 2 scripts + baseline → detect changes → HITL accept → self-heal.

## Components

```
playwright-agent/     prompts + commands (/automate, /detect-changes, /heal)
jackson-tests/        Playwright execution target
.cursor/              rules, commands, mcp.json (client-evaluated)
```

## Agents

| Agent | Role |
|-------|------|
| test-generator | Specs from Excel steps |
| page-object-generator | POMs + locator sidecars |
| change-detector | Baseline diff + expected/unexpected |
| self-healer | Apply accepted repairs |

## Day 8 report contract

Schema: `jackson-tests/tests/reports/changes/change-report.schema.json`

Emitter: `jackson-tests/tests/utils/change-detector.ts` (`npm run detect:changes`)

## Auth

`jackson-tests/tests/auth.setup.ts` persists `storageState` to `.auth/firelight-state.json`. Specs depend on the `setup` project.
