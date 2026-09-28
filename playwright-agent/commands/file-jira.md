# /file-jira — Optional Jira copy of unexpected defects

Jackson POC defects are **Markdown** (`jackson-tests/tests/reports/changes/defects/`). Jira is an optional backlog copy via **Atlassian Rovo MCP** (`https://mcp.atlassian.com/v2/mcp`).

Not in scope: Xray test execution, Jira as the only record, creating issues for expected/accepted heals.

## Setup (once per machine)

1. `.cursor/mcp.json` already points Cursor at `https://mcp.atlassian.com/v2/mcp`.
2. In Cursor: Settings → MCP → **atlassian** → Connect and finish OAuth (or API token if the site requires it).
3. Set in `jackson-tests/.env` (never commit secrets):

```
JIRA_PROJECT_KEY=JFS
JIRA_CLOUD_SITE=https://bounteous.jira.com
JIRA_EMAIL=
JIRA_API_TOKEN=
```

Cursor `/file-jira` uses MCP OAuth. Change review **File defects without a Jira key** uses `JIRA_EMAIL` + `JIRA_API_TOKEN` ([create a token](https://id.atlassian.com/manage-account/security/api-tokens)).

Official client notes: [Atlassian Rovo MCP — IDEs](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/setting-up-ides/). Prefer v2 (`/v2/mcp`), not the legacy `/v1/sse` endpoint.

## Usage

```
/file-jira
/file-jira CHG-002,CHG-003
```

Or `npm run ui` → Defects → Jira.

If no IDs: unexpected rows in `latest-change-report.json` (Cursor command) or defect Markdown without a `Jira:` key (UI).

## Agent steps

1. Confirm MCP tools are available (`GetDynamicTools` / Atlassian namespace). If `needsAuth`, tell the user to Connect; stop.
2. Confirm `JIRA_PROJECT_KEY`. If missing, ask.
3. Create one issue per change; do not batch unrelated CHGs into one ticket.
4. Write the issue key back onto `defects/<changeId>.md` as `Jira: KEY`.
5. Do not call `/heal` from this command.

## Demo line

Unexpected UI deltas stay defects; Jira is how they land in Jackson’s process after HITL reject.
