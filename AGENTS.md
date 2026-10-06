# Cursor — Jackson Firelight POC

Jackson evaluates `.cursor/` (rules, commands, skills, hooks, MCP). Demo notes: `playwright-agent/cursor-best-practices-demo.md`.

## Folders

- `.cursor/` — rules, `/` commands, skills, hooks, `mcp.json`
- `playwright-agent/` — runbooks and templates only
- `jackson-tests/` — Playwright tests, POMs, baselines, reports

## Always-on contract

- Firelight FLQANEXT only (Elite Access II, Colorado, Boun Excel)
- Scripts succeed at **Wet Signature** checked and DATA ENTRY **100%**. Do not CONTINUE or submit.
- Live primary Proceeds `%` must total **100%**. Use **Open Page List** if the bar is stuck.
- Heal only after explicit human acceptance. Unexpected changes → Markdown defects, not silent locator patches.
- Write tests only under `jackson-tests/`. Prompts stay in `playwright-agent/`.

## Where to look (do not dump the repo)

1. This file, then `playwright-agent/AGENTS.md` or `jackson-tests/AGENTS.md` for the folder you are in
2. `/` commands in `.cursor/commands/` (same workflows as `.cursor/skills/`)
3. Templates in `playwright-agent/templates/`
4. Page cache in `jackson-tests/tests/data/.snapshots/` — not dated `baselines/baseline-*/` HTML unless you need `htmlHash`

## Commands / skills

`/automate` `/detect-changes` `/heal` `/iterate-script1` `/iterate-script2` `/file-jira`
