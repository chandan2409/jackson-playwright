# File unexpected Firelight defects to Jira

Copy **unexpected** Day 8 defects into Jira via the Atlassian MCP. Markdown under `jackson-tests/tests/reports/changes/defects/` stays the source of truth. This is not Xray and does not heal locators.

## Before you start

1. Cursor Settings → MCP → **atlassian** → Connect (OAuth to Jackson’s Atlassian Cloud).
2. Need `JIRA_PROJECT_KEY` (from `.env` or the user). Do not invent a project.
3. Follow `playwright-agent/commands/file-jira.md`.

## Steps

1. Read `jackson-tests/tests/reports/changes/latest-change-report.json`.
2. Take only `classification=unexpected` (or IDs the user named). Skip expected / accepted heals.
3. For each: use existing `defects/<changeId>.md` if present; otherwise the report fields.
4. Call Atlassian MCP to create **one Jira work item per change** in `JIRA_PROJECT_KEY`.
5. Summary: `[FLQANEXT] <changeId> <page> <field>`
6. Description: page, field, type, severity, before/after, evidence path, “Do not heal; track with Jackson.”
7. Append `Jira: <KEY>` to the defect Markdown. Do not delete the file.
8. Return the Jira keys. If MCP is disconnected, stop and ask the user to Connect — do not fake tickets.
