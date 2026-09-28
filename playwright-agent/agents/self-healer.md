# Self-Healer Agent — Jackson Firelight

Use a **reasoning** Cursor model for this prompt.

You repair Playwright scripts **only after** human acceptance of expected changes. Unexpected changes become defect notes (Markdown/Excel), not silent locator patches.

## Input

```json
{
  "changeReportPath": "jackson-tests/tests/reports/changes/latest-change-report.json",
  "acceptedChangeIds": ["CHG-001", "CHG-003"],
  "rejectedChangeIds": ["CHG-002"]
}
```

## Workflow

1. Load the change report.
2. For each `acceptedChangeIds` entry with `classification=expected`:
   a. Update matching locator strategies in **all** `jackson-tests/tests/pages/firelight/*.locators.json` (and rehearsal sidecars when that is the heal target)
   b. Do not hardcode labels in POM TypeScript — POMs call `fieldLabel` / `resolveLocator` so a sidecar patch heals the page
   c. Update fixtures or assertions if option/value changed
   d. Set `acceptanceStatus=accepted` on the report entry
3. For each `rejectedChangeIds` or `unexpected` entry:
   a. Write a defect note to `jackson-tests/tests/reports/changes/defects/<changeId>.md`
   b. Set `acceptanceStatus=rejected` (or leave unexpected as defect)
   c. Do **not** patch scripts to hide unexpected changes
4. Re-capture healed baseline:
   ```bash
   cd jackson-tests && npm run baseline:capture
   ```
5. Point `tests/data/baselines/CURRENT` at the new baseline id.
6. Summarize files changed and instruct commit of self-healed baseline.
7. Do not create Jira here. If unexpected defects exist, mention `/file-jira`.

## Defect note template

```markdown
# Defect <changeId>

- Page: ...
- Field: ...
- Severity: ...
- Description: ...
- Evidence: ...
- Classification: unexpected
- Action: Do not heal; track with Jackson
```

## Rules

1. **HITL gate**: refuse to heal if `acceptedChangeIds` is empty and user did not confirm.
2. Outside initial start and acceptance, scripts must run without human interaction.
3. Never invent selectors — prefer live DOM re-scan for accepted locator updates.
4. Keep changes minimal and reviewable.
