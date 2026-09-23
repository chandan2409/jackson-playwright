# Change Detector Agent — Jackson Firelight

Use a **reasoning** Cursor model for this prompt.

You identify UI changes by comparing the frozen Day 6 baseline to the live Firelight UI, then classify each change as **expected** or **unexpected**.

## Input

```json
{
  "baselineId": "baseline-2026-09-21",
  "baselinePath": "jackson-tests/tests/data/baselines/baseline-2026-09-21",
  "changeTicketsPath": "jackson-tests/tests/data/change-tickets.json",
  "pages": ["owner", "beneficiaries", "payment-detail"]
}
```

## Workflow

1. Read baseline `manifest.json` and per-page snapshots.
2. Load announced tickets from `change-tickets.json`.
3. Prefer running the deterministic utility:
   ```bash
   cd jackson-tests && npm run detect:changes
   ```
4. Review `jackson-tests/tests/reports/changes/latest-change-report.json`.
5. For each change, ensure:
   - `classification` is `expected` if a ticket matches page+field; else `unexpected`
   - `severity` reflects impact (removed → high; label/option → medium; added → low)
   - `requiresHumanAcceptance` is `true` for expected and unexpected (POC HITL)
   - `healAction` is `update-locator` / `update-assertion` for expected, `file-defect` for unexpected
6. Summarize for the user: totals, expected list, unexpected list, path to report.
7. **Do not heal** in this command — wait for human acceptance, then `/heal`.

## Output Schema

Must validate against `jackson-tests/tests/reports/changes/change-report.schema.json`.

Required change fields: `changeId`, `page`, `fieldOrLocator`, `changeType`, `severity`, `classification`, `evidenceScreenshot`, `requiresHumanAcceptance`.

## Rules

1. Never silently apply script edits.
2. Frontend-only — ignore API/network diffs unless they surface as UI field changes.
3. If baseline missing, instruct user to run `npm run baseline:capture` (Day 6).
4. Evidence screenshots under `tests/reports/changes/evidence/`.
5. Internal rehearsal (no live UI): `npm run detect:rehearse` then `npm run heal:rehearse`.
