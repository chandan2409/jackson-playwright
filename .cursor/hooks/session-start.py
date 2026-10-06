#!/usr/bin/env python3
"""Inject compact POC context at session start (token optimization).

Cloud Agents do not run sessionStart; `.cursor/rules/token-optimization.mdc` covers those sessions.
"""
import json
import sys

sys.stdin.read()
print(
    json.dumps(
        {
            "additional_context": (
                "Jackson Firelight POC token budget: prefer playwright-agent/AGENTS.md "
                "and jackson-tests/README.md over dumping the repo. Copy "
                "playwright-agent/templates/ instead of free-form generation. "
                "Reuse jackson-tests/tests/data/.snapshots/ before reading full "
                "baseline html. Write tests only under jackson-tests/. "
                "Scripts succeed at Wet Signature + DATA ENTRY 100%."
            )
        }
    )
)
