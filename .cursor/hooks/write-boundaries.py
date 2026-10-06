#!/usr/bin/env python3
"""Deny test/spec writes outside jackson-tests/."""
import json
import sys

raw = sys.stdin.read()
try:
    payload = json.loads(raw or "{}")
except json.JSONDecodeError:
    print(json.dumps({"permission": "allow"}))
    raise SystemExit(0)

tool_input = payload.get("tool_input") or payload.get("arguments") or payload
path = str(
    tool_input.get("path")
    or tool_input.get("file_path")
    or tool_input.get("filePath")
    or ""
)

blocked_env = path.endswith("/.env") or path.endswith("jackson-tests/.env")
outside_tests = path.endswith((".spec.ts", ".test.ts")) and "jackson-tests/" not in path.replace(
    "\\", "/"
)

if blocked_env:
    print(
        json.dumps(
            {
                "permission": "deny",
                "agent_message": "Do not write jackson-tests/.env (secrets). Use .env.example.",
            }
        )
    )
    raise SystemExit(0)

if outside_tests:
    print(
        json.dumps(
            {
                "permission": "deny",
                "agent_message": "Write Playwright specs only under jackson-tests/. Agent prompts stay in playwright-agent/.",
            }
        )
    )
    raise SystemExit(0)

print(json.dumps({"permission": "allow"}))
