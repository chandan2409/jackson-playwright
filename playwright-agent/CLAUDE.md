# Playwright Agent — Jackson Firelight POC

> Cursor/Claude agent that generates, detects changes in, and self-heals Playwright scripts for Jackson Firelight FLQANEXT.

## What This Plugin Does

Produces Page Object Models (POMs), Playwright specs, UI baselines, and Day 8 change reports for the Jackson Agentic QA POC. Primary input: Excel test case (`Boun_POCtestcase.xlsx`).

## Commands

- `/automate excel <path>` — Generate/update Firelight wizard scripts from Excel
- `/detect-changes` — Compare live UI to frozen baseline; emit change report
- `/heal` — Repair scripts after human-in-the-loop acceptance of expected changes

## Agents

| Agent | Purpose | Model |
|-------|---------|-------|
| `test-generator` | Generates Firelight wizard specs from Excel steps | sonnet |
| `page-object-generator` | POMs + multi-strategy locator sidecars from live DOM | haiku |
| `change-detector` | Baseline vs current diff; expected vs unexpected | sonnet |
| `self-healer` | Updates locators/POMs/specs after HITL acceptance | sonnet |

## Target Repo

- **`jackson-tests/`** — Playwright suite the agent writes into
- Generated code goes into `jackson-tests/tests/` — never write agent plugin files there
- Never write test files into `playwright-agent/`

## Key Conventions

### Generated POM Pattern
- Class-based with constructor-injected `Page` (parallel-safe)
- Locator data in JSON sidecar files (`*.locators.json`)
- Goes into `jackson-tests/tests/pages/firelight/`
- Auth via `storageState` from `tests/auth.setup.ts` → `.auth/firelight-state.json`
- Prefer **label-first** locators for Firelight form fields (`getByLabel`, then role/text/css)

### Generated Spec Pattern
- Uses `@playwright/test`
- Goes into `jackson-tests/tests/specs/`
- POC requires **2 working scripts**: happy path + variant path
- Every test MUST contain at least one `expect()`

### Locator Strategy
- Multi-locator per element (label, role, testid, css, text, xpath)
- Confidence scoring for self-healing foundation
- Compatible with `resolveLocator()` in `jackson-tests/tests/utils/locator-registry.ts`

### Environment
- dotenv `.env` in `jackson-tests/` (see `.env.example`)
- Platform: Firelight FLQANEXT sandbox
- Product / jurisdiction from env: Elite Access II / Colorado

### Wizard Pages (POC)
1. Select Application
2. New Application Information
3. Owner
4. Beneficiaries
5. Agent
6. Initial Allocations
7. Payment Detail
8. Signing Process

## POC Constraints

- Frontend-only (no backend/API)
- No Xray — Excel/Markdown defect notes are enough
- Human interaction only for initial start and acceptance of healing
- Day 6 baseline freeze is immutable until Day 8 heal

## Token Optimization
- Prefer haiku for DOM → POM extraction
- Prefer sonnet for change classification and healing
- Cache DOM snapshots in `jackson-tests/tests/data/.snapshots/`
- Use templates under `playwright-agent/templates/`
