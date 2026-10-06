#!/usr/bin/env python3
"""Allow baseline reads; remind agents to prefer .snapshots first."""
import json
import sys

raw = sys.stdin.read()
try:
    payload = json.loads(raw or "{}")
except json.JSONDecodeError:
    print(json.dumps({"permission": "allow"}))
    raise SystemExit(0)

path = str(
    payload.get("file_path")
    or payload.get("path")
    or (payload.get("tool_input") or {}).get("path")
    or ""
).replace("\\", "/")

if "/tests/data/baselines/" in path and path.endswith(".json"):
    print(
        json.dumps(
            {
                "permission": "allow",
                "agent_message": (
                    "This baseline JSON includes serialized html. Prefer "
                    "jackson-tests/tests/data/.snapshots/<page>.json or field inventory "
                    "instead of loading the full html unless you need htmlHash."
                ),
            }
        )
    )
    raise SystemExit(0)

print(json.dumps({"permission": "allow"}))
