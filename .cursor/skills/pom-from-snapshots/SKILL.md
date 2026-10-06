---
name: pom-from-snapshots
description: Builds Firelight page objects and locator sidecars from templates plus tests/data/.snapshots. Use when creating or healing POMs, *.locators.json, owner/beneficiaries pages, or when /automate or /heal needs locators.
paths:
  - "jackson-tests/tests/pages/**"
  - "jackson-tests/tests/data/.snapshots/**"
  - "playwright-agent/templates/**"
---

# POM from snapshots

1. Read `playwright-agent/templates/page-object.template.ts` and `locators.template.json`.
2. Read `jackson-tests/tests/data/.snapshots/<page>.json` (not dated `baselines/baseline-*/` HTML unless `htmlHash` is required).
3. Write `jackson-tests/tests/pages/firelight/<page>Page.ts` + `*.locators.json`.
4. Fast / low-cost model is enough for this mechanical step.
5. Detect still uses live Firelight vs `tests/data/baselines/CURRENT`.
