# Cursor configuration — demo notes

What Jackson evaluates in this repo: **committed Cursor project config**, not a one-off chat prompt.

Official Cursor docs this layout follows:

- [Rules + AGENTS.md](https://cursor.com/docs/rules)
- [Skills](https://cursor.com/docs/skills)
- [Hooks](https://cursor.com/docs/hooks)
- [Cloud Agent best practices](https://cursor.com/docs/cloud-agent/best-practices)
- [Ignore files](https://cursor.com/docs/reference/ignore-file)
- [MCP](https://cursor.com/docs/mcp)

## Demo talking point (30 seconds)

Cursor best practice is **the right layer for the job**:

| Layer | Job | Soft or hard |
|-------|-----|----------------|
| `AGENTS.md` | Short project map | Guidance |
| `.cursor/rules/*.mdc` | Always-on contract | Guidance |
| Skills + `/` commands | Playbooks on demand | Guidance |
| Hooks | Allow / deny | **Hard** |
| `.cursorignore` + MCP | Index less; use real tools | Hard / tools |

Do not put the whole runbook in always-on rules. Do not rely on rules to block `.env` writes — that is a hook.

## Coverage vs Cursor best practice

| Best practice (Cursor) | This repo | Where to show |
|------------------------|-----------|----------------|
| Root `AGENTS.md` as the simple always-on map | Yes | `AGENTS.md` |
| Nested `AGENTS.md` for a folder | Yes | `jackson-tests/AGENTS.md`, `playwright-agent/AGENTS.md` |
| Project rules as `.mdc` with frontmatter; keep them short; check into git | Yes | `.cursor/rules/jackson-poc.mdc`, `token-optimization.mdc` |
| Prefer pointing at files over pasting them | Yes | Templates + `.snapshots/` in the token rule |
| Slash commands as committed markdown | Yes | `.cursor/commands/` |
| Skills for on-demand workflows; progressive load | Yes | `.cursor/skills/` (same names as commands) |
| Auto skill only when the files match | Yes | `pom-from-snapshots` (`paths` on pages / templates / snapshots) |
| Hooks committed at `.cursor/hooks.json`; project-root script paths | Yes | `.cursor/hooks.json` + `.cursor/hooks/*.py` |
| Hooks for non-negotiable gates | Yes | Deny specs outside `jackson-tests/`, deny `.env` writes, deny force-push to main/master |
| `failClosed` on security-critical gates | Yes | Write + shell hooks |
| `sessionStart` inject compact context (IDE) | Yes | `session-start.py` — Cloud Agents skip this event; the token **rule** still applies |
| MCP for tools a human would use | Yes | `.cursor/mcp.json` Atlassian (no secrets in git) |
| `.cursorignore` so Agent does not index secrets / huge dumps | Yes | `.env`, dated `baselines/baseline-*/`, Playwright reports |
| Split prompts from generated tests | Yes | `playwright-agent/` vs `jackson-tests/` |
| Team/Enterprise dashboard rules | N/A (POC repo) | Org-level; not in git |

## What to click in Cursor (live)

1. **Customize → Rules** — two always-on project rules.
2. **Customize → Skills** (or type `/`) — iterate, detect, heal, automate, file-jira, pom-from-snapshots.
3. **Settings → Hooks** — four project hooks. If a new clone does not list them, reload this panel.
4. Open `.cursor/hooks/write-boundaries.py` — this is **deny**, not a comment in a rule.

## Token optimization (what we actually mean)

Not a max-token setting. We **keep context small**:

1. Always-on: root `AGENTS.md` + two short `.mdc` files (do not dump the repo).
2. Copy `playwright-agent/templates/` instead of inventing POMs/specs.
3. Reuse `jackson-tests/tests/data/.snapshots/<page>.json` for POM/heal.
4. Dated baseline JSON (serialized HTML) is `.cursorignore`d. Detect still runs live vs `CURRENT` via npm.
5. Fast model for mechanical POM extraction; reasoning for `/detect-changes` and `/heal`.

## Intentional leftovers (not gaps for this POC)

- Two always-on rules (product contract + token budget) — we want both in every chat.
- Commands **and** skills with the same names — Jackson evaluates `.cursor/commands/`; skills wrap those files so `/` still works as Cursor 2.4+ skills.
- No format-on-edit hook — the suite does not need it.
- Team dashboard rules / enforced org rules — plan feature, not this repo.

## Product contract the config enforces

Independent of Cursor primitives, the agent is steered to:

- Firelight FLQANEXT only (Elite Access II, Colorado, Boun)
- Success = **Wet Signature** checked + DATA ENTRY **100%** (no CONTINUE / submit)
- Live primary Proceeds `%` = **100%**; Open Page List if stuck
- Heal only after human acceptance; unexpected → Markdown defects; `/file-jira` is a copy only
