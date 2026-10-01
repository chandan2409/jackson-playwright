# Playwright Agent — Jackson Firelight Architecture

## Purpose

Cursor-driven agent that keeps Firelight UI Playwright scripts alive:

Excel → 2 scripts + baseline → detect changes → HITL accept → self-heal.

## Components

```
.cursor/              Cursor rules, commands, mcp.json (what Jackson evaluates)
playwright-agent/     Cursor agent runbooks + templates
jackson-tests/        Playwright execution target + Change review UI
```

## Cursor commands

Jackson evaluates `.cursor/commands/` (runbooks under `playwright-agent/commands/` where mirrored).

| Command | Role |
|---------|------|
| `/automate excel` | Generate/update scripts from `Boun_POCtestcase.xlsx` |
| `/detect-changes` | Day 8 change report (live wizard vs CURRENT baseline) |
| `/heal` | Apply accepted repairs + recapture baseline |
| `/file-jira` | Optional Jira **copy** of unexpected Markdown defects (Atlassian MCP). Not Xray; Markdown remains source of truth |
| `/iterate-script1` | Run Script 1, fix from failure screenshot, repeat until green |
| `/iterate-script2` | Run Script 2 (variant), fix from screenshot, repeat until green |

`/iterate-script1` is command-only (`.cursor/commands/iterate-script1.md`). `/iterate-script2` also has a named agent prompt (`playwright-agent/agents/script-2-iterator.md`).

## Agents

Prompts under `playwright-agent/agents/` suggest **fast** for `page-object-generator` and **reasoning** for the others. Cursor does **not** auto-select a model from those files; whoever runs the command picks the model.

| Agent | Role |
|-------|------|
| test-generator | Specs from Excel steps (`templates/spec-file.template.ts`) |
| page-object-generator | POMs + locator sidecars (`templates/page-object.template.ts`, `templates/locators.template.json`) |
| script-2-iterator | Run variant script, fix from screenshot, repeat |
| change-detector | Baseline vs CURRENT; expected vs unexpected |
| self-healer | Apply accepted repairs (beyond label-only sidecar patch) |

There is no `script-1-iterator` prompt; `/iterate-script1` is the command file only.

Live page captures also write `jackson-tests/tests/data/.snapshots/<page>.json` for POM/heal reuse. Detect still walks Firelight vs CURRENT baseline; the cache is not a substitute for that walk.

## Live wizard contract (Scripts 1 and 2)

Both scripts share `runFirelightWizard` in `jackson-tests/tests/utils/wizard-flow.ts`. Success is **not** CONTINUE or Submit for Review.

| Check | Live Firelight |
|-------|----------------|
| End page | Signing Process |
| Signing method | **Wet Signature** selected (round checkbox `title="Wet Signature"`) |
| Progress | DATA ENTRY **100%** |
| Do not click | CONTINUE, print/upload, Submit for Review |

**Beneficiaries — primary allocation.** Firelight toast: `PRIMARY Beneficiary allocation percentage must total 100% but is N%`. Enter **100** in the primary Proceeds `%` textbox (accessible name `%`, label **Proceeds**). A 60% value leaves DATA ENTRY at ~98% and marks Beneficiaries failed.

If DATA ENTRY is not 100%, click **Open Page List** (top wizard bar), open the failed page (usually Beneficiaries), enter 100, then return to Signing Process.

**Script 2 fixture vs live field**

- `variantPathData` stays distinct: case **Boun-Variant**, payment **25000**, Excel proceeds **60** / **40** in the fixture object (coverage matrix).
- On the live form, primary Proceeds is still **100** (validation). Do not add a second Primary at 40% — that toast stays up. Script 1 may still add a **Contingent** at 100%.

Most wizard fields use `fillByEntry` / `selectByEntry` / `clickByEntry`. Extra live handlers (not sidecar-only):

- Beneficiaries: Proceeds `%` + Open Page List repair (`beneficiariesPage.ts`)
- Signing: Wet Signature checkbox (`signingProcessPage.ts`)
- New Application Information and Systematic Investment: `selectChoiceBelowQuestion` (unchanged)

## Wizard pages

Detect, baseline, and heal cover all keys in `jackson-tests/tests/utils/wizard-pages.ts` (`WIZARD_PAGES`):

1. Select Application (`select-application`)
2. New Application Information (`new-application-information`)
3. Owner (`owner`)
4. Beneficiaries (`beneficiaries`)
5. Agent (`agent`)
6. Systematic Investment (`systematic-investment`)
7. Initial Allocations (`initial-allocations`)
8. Add-On Benefits (`add-on-benefits`)
9. Payment Detail (`payment-detail`)
10. Signing Process (`signing-process`)

Baselines store serialized DOM (`html` + `htmlHash`) plus an interactive field inventory.

`/automate` and `page-object-generator` still start new fields from `*ByEntry`. Do not revert New Application Information or Systematic Investment to first-Yes/No on the page.

## Token optimization (this layout)

1. Split agent prompts from generated tests so prompts do not scan the whole suite
2. Copy templates instead of free-form generation
3. Cache last live DOM under `jackson-tests/tests/data/.snapshots/` (gitignored)
4. Prefer this file + `playwright-agent/AGENTS.md` + `jackson-tests/README.md` over dumping the repo

## Test execution (headed + Change review)

`jackson-tests` npm scripts are not a raw headless `playwright test` by default:

| Script | What it does |
|--------|----------------|
| `npm run test:script1` | `tsx ui/run-live.ts tests/specs/script-1-happy-path.spec.ts` |
| `npm run test:script2` | `tsx ui/run-live.ts tests/specs/script-2-variant-path.spec.ts` |

`ui/run-live.ts`:

- Starts Change review (`ui/serve.ts`) if port `5173` is closed, then opens the dashboard in the OS browser
- Runs Playwright **headed** against live Firelight
- Skips opening the UI and stays headless when `CI` or `SKIP_OPEN_UI` is set (UI spawn of Script 1/2 sets `SKIP_OPEN_UI=1` so a second dashboard is not opened)

Auth still uses `jackson-tests/tests/auth.setup.ts` → `.auth/firelight-state.json`. Specs depend on the Playwright `setup` project.

## Change review UI

`npm run ui` serves `jackson-tests/ui/` at `http://127.0.0.1:5173` (override with `UI_PORT`).

The dashboard is the operator surface for:

- **Coverage table** — Excel step → `[FL-HP-001]` / `[FL-VP-001]` from `tests/data/coverage-matrix.json`, joined to last-run results (`tests/reports/last-run.json`)
- **Jobs** — Script 1, Script 2, baseline capture, `detect:rehearse`, live `detect:changes`
- **Change report** — latest Day 8 JSON; **Heal accepted / reject rest** runs `apply-heal-acceptance.ts` (see Heal)
- **File to Jira** — copy unexpected defects (MCP `/file-jira` or UI when `JIRA_API_TOKEN` is set). UI REST attaches `tests/reports/changes/evidence/<page>.png` when Detect (live) produced it.

## Coverage and last-run

- `jackson-tests/tests/data/coverage-matrix.json` — traceability from `Boun_POCtestcase.xlsx` rows to Script 1 / Script 2
- Playwright JSON reporter writes `jackson-tests/tests/reports/last-run.json`
- Change review last-run list is paginated (default page size 10)

## Rehearsal detect / heal

Internal dry-run **without** Firelight or Chromium. Same `change-detector.ts` / `apply-heal-acceptance.ts` with env overrides:

| Script | Behavior |
|--------|----------|
| `npm run detect:rehearse` | Diff `tests/data/rehearsal/baseline` vs `tests/data/rehearsal/current` using `tests/data/rehearsal/change-tickets.json` |
| `npm run heal:rehearse` | Apply/reject rehearsal change IDs against `tests/data/rehearsal/locators` |

Live detect (`npm run detect:changes`) still walks the wizard vs `tests/data/baselines/CURRENT`. Do not substitute the gitignored `.snapshots/` cache for that walk.

## Day 8 report contract

Schema: `jackson-tests/tests/reports/changes/change-report.schema.json`

Emitter: `jackson-tests/tests/utils/change-detector.ts` (`npm run detect:changes`)

Committed pointer: `jackson-tests/tests/reports/changes/latest-change-report.json`

Required on each change: `changeId`, `page`, `fieldOrLocator`, `changeType`, `severity`, `classification`, `evidenceScreenshot`, `requiresHumanAcceptance`.

Schema fields beyond that summary:

| Field | Values / role |
|-------|----------------|
| `changeType` | `added`, `removed`, `modified`, `relocated`, `label-changed`, `option-changed`, `dom-changed`, `unscanned` |
| `healAction` | Proposed next step: `update-locator` / `update-assertion` / `file-defect` / `recapture-baseline` / `none` |
| `acceptanceStatus` | HITL: `pending`, `accepted`, `rejected` |
| `unscanned` (as `changeType`) | Wizard page in `WIZARD_PAGES` that the walk did not reach — not a silent skip |
| `dom-changed` | Serialized `html` / `htmlHash` differed with no matching field inventory delta |

Pages the walk did not reach are reported as `unscanned`, not omitted.

## Heal (one pipeline, three entry points)

Unexpected changes become Markdown defects, not silent locator patches.

`apply-heal-acceptance.ts` is the **mechanical** helper: HITL IDs on `latest-change-report.json`, expected **`label-changed`** strategies in `*.locators.json`, defect notes. It does **not** rewrite POM TypeScript, fixtures, or assertions, and it does **not** recapture the live baseline.

| Entry | How | What it does |
|-------|-----|----------------|
| Change review **Heal accepted / reject rest** | UI `POST /api/run` `script: heal` | Runs `apply-heal-acceptance.ts` only. Rehearsal locators if Live Firelight is off. |
| `npm run heal:accept -- --accept CHG-001 --reject CHG-002` | CLI | Same helper (pass IDs yourself). Default locators: `tests/pages/firelight/`. |
| `npm run heal:rehearse` | CLI | Same helper with fixed rehearsal IDs and `tests/data/rehearsal/locators`. No Firelight. |
| Cursor `/heal` | Agent + `self-healer.md` | Runs the helper **and** patches POMs / fixtures / assertions for other accepted expected types (`option-changed`, relocated locators, etc.), **then** `npm run baseline:capture` to freeze a new Day 6 CURRENT. |

Do not auto-run `baseline:capture` from the dashboard Heal button (needs live Firelight and is slow). Recapture stays on `/heal` or a separate **Baseline** job.

## Auth

`jackson-tests/tests/auth.setup.ts` persists `storageState` to `.auth/firelight-state.json`. Specs depend on the `setup` project.
