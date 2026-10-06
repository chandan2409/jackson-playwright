#!/usr/bin/env python3
"""Block force-push to main/master; allow other shell commands."""
import json
import re
import sys

raw = sys.stdin.read()
try:
    payload = json.loads(raw or "{}")
except json.JSONDecodeError:
    print(json.dumps({"permission": "allow"}))
    raise SystemExit(0)

command = str(payload.get("command") or "")
force = re.search(r"git\s+push\s+[^\n]*--force", command) or re.search(
    r"git\s+push\s+[^\n]*-f\b", command
)
to_main = re.search(r"\b(main|master)\b", command)

if force and to_main:
    print(
        json.dumps(
            {
                "permission": "deny",
                "agent_message": "Force-push to main/master is blocked for this POC repo.",
                "user_message": "Hook blocked git push --force to main/master.",
            }
        )
    )
    raise SystemExit(0)

print(json.dumps({"permission": "allow"}))
