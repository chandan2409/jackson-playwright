# Jackson Firelight POC — Agentic QA Handover

Jackson Firelight Agentic QA POC — Cursor-driven Playwright scripts with UI change detection and HITL self-healing for Elite Access II (Colorado).

Cloneable repository for the Jackson / Bounteous POC: **AI-driven change detection and self-healing Playwright scripts** for Firelight FLQANEXT, driven by Cursor.

## What this proves

An AI agent (Cursor-configured) can:

1. Automate a Firelight wizard test case as **2 working scripts**
2. **Detect** UI changes vs a frozen baseline
3. Classify **expected vs unexpected** changes
4. **Self-heal** scripts after human-in-the-loop acceptance

## Layout

```
├── playwright-agent/     # Agent prompts, commands, templates
├── jackson-tests/        # Runnable Playwright suite + baselines + change reports
├── .cursor/              # Rules, commands, skills, hooks, MCP (evaluated by Jackson)
├── Boun_POCtestcase.xlsx # Source manual test case
└── POCwriteup.docx       # POC requirements
```

## Prerequisites

- Node.js 20+
- Cursor IDE
- Day 0 Firelight FLQANEXT tester credentials from Jackson

## Quick start

```bash
cd jackson-tests
cp .env.example .env          # fill FIRELIGHT_* credentials
npm install
npx playwright install chromium
npm run auth:setup            # login once → .auth/firelight-state.json
npm run test:script1          # happy path
npm run test:script2          # variant path
```

## POC timeline (business days)

| Day | Action |
|-----|--------|
| 0 | Credentials; confirm wizard reachable |
| 1–6 | Build scripts, baseline, agents |
| 6 | **Baseline frozen** — `npm run baseline:capture` and commit |
| 7 | Jackson injects changes (+ some change tickets) |
| 8 | Run detection + healing; submit change report |

### Day 6 — freeze baseline

```bash
cd jackson-tests
npm run baseline:capture
git add tests/data/baselines tests/specs tests/pages tests/reports/changes/latest-change-report.json
git commit -m "Freeze Day 6 Firelight baseline"
```

### Day 8 — detect and heal (via Cursor)

1. Place announced change tickets in `jackson-tests/tests/data/change-tickets.json`
2. In Cursor: `/detect-changes` (or `npm run detect:changes`)
3. Review `jackson-tests/tests/reports/changes/latest-change-report.json`
4. Accept expected repairs; reject unexpected (defect notes)
5. In Cursor: `/heal` with accepted change IDs
6. Commit the self-healed baseline scripts

## Cursor commands

Same names exist as project skills under `.cursor/skills/` (type `/` in Agent).

Demo script for Jackson (Cursor best practices vs this repo): [playwright-agent/cursor-best-practices-demo.md](playwright-agent/cursor-best-practices-demo.md).

| Command | Purpose |
|---------|---------|
| `/automate excel` | Generate/update scripts from Excel test case |
| `/detect-changes` | Scan UI vs baseline; emit change report |
| `/heal` | Repair scripts after HITL acceptance |
| `/iterate-script1` | Run happy path until Wet Signature + 100% |
| `/iterate-script2` | Run variant path until Wet Signature + 100% |
| `/file-jira` | Optional: copy unexpected defects to Jira (Atlassian MCP) |

## Optional Jira (MCP + Change review)

1. Cursor Settings → MCP → **atlassian** → Connect (`https://mcp.atlassian.com/v2/mcp` is in `.cursor/mcp.json`).
2. Set `JIRA_PROJECT_KEY` and `JIRA_CLOUD_SITE` in `jackson-tests/.env`.
3. After detect/heal rejects: `/file-jira` **or** Change review → **Defects → Jira**.
4. The UI button uses Jira REST (`JIRA_EMAIL` + `JIRA_API_TOKEN` from [Atlassian API tokens](https://id.atlassian.com/manage-account/security/api-tokens)). MCP OAuth is not available inside `npm run ui`.

Markdown under `jackson-tests/tests/reports/changes/defects/` remains the POC record. This is not Xray.

## Deliverables checklist

- [ ] Cloneable repo with Day 6 baseline committed
- [ ] `.cursor/` configuration (rules, commands, skills, hooks, MCP)
- [ ] Day 8 change report (`tests/reports/changes/`)
- [ ] Self-healed baseline scripts after acceptance

## Out of scope (per POC)

Backend/API changes, Xray test-management sync, accuracy/coverage SLAs. Optional Jira MCP is a defect copy only.
