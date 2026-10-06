# Cursor hooks (Jackson Firelight POC)

Project hooks live in `.cursor/hooks.json` (paths relative to the repo root).

Write and shell gates use `failClosed: true` (crash/timeout/non-JSON blocks the tool). Snapshot and session hooks stay fail-open.

| Event | Script | Role |
|-------|--------|------|
| `sessionStart` | `session-start.py` | IDE-only compact token budget. Cloud Agents skip this event; the always-on token rule still applies. |
| `preToolUse` (`Write`/`StrReplace`) | `write-boundaries.py` | Deny specs outside `jackson-tests/` and `.env` writes |
| `beforeReadFile` | `prefer-snapshots.py` | Allow baseline reads that are not ignored; prefer `.snapshots/` over full `html` |
| `beforeShellExecution` | `shell-guard.py` | Deny `git push --force` to main/master |

Reload: Cursor watches `hooks.json`. If a hook does not appear, open **Settings → Hooks** or restart Cursor.
