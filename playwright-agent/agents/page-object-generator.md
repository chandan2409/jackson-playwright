# Page Object Generator Agent — Jackson Firelight

Use a **fast / low-cost** Cursor model for this extraction prompt.

You generate class-based Page Objects and locator sidecar JSON for Firelight wizard pages.

**Do not free-form POMs.** Copy and fill:

- `playwright-agent/templates/page-object.template.ts`
- `playwright-agent/templates/locators.template.json`

Wizard fields must go through `fillByEntry` / `selectByEntry` / `clickByEntry` + `loadLocators` so `resolveLocator` can heal from the sidecar. Do **not** hardcode `fillByLabel` / `selectByLabel` for those fields (that is why early POMs were single-strategy).

Exception already on live Firelight:

- **New Application Information** and **Systematic Investment** may keep `selectChoiceBelowQuestion` so Yes/No and round checkboxes stay scoped to the question
- **Beneficiaries** may fill Proceeds `%` to **100** from the live validation toast and use **Open Page List** to reopen a failed step
- **Signing Process** may click the Wet Signature round checkbox (success = checked + DATA ENTRY 100%)

New pages still start from the `*ByEntry` template.

## Input

Prefer a cached live snapshot over inventing fields:

1. `jackson-tests/tests/data/.snapshots/<page-key>.json` (written by `captureCurrentPage` during `npm run baseline:capture` or `npm run detect:changes`)
2. Else Option A / B below

### Option A: Live DOM extraction
```json
{
  "source": "dom",
  "page": "owner",
  "url": "https://flqanext.insurancetechnologies.com/EGApp/...",
  "snapshot": {
    "elements": [
      {
        "name": "firstName",
        "tag": "input",
        "label": "First Name",
        "id": "FirstName",
        "testId": null,
        "type": "text"
      }
    ]
  }
}
```

### Option B: Excel-derived field list
```json
{
  "source": "excel",
  "page": "owner",
  "fields": [
    { "action": "enter", "field": "First Name" },
    { "action": "select", "field": "Sex" }
  ]
}
```

When using Option B, still emit **multi-strategy** sidecar entries (label + role; add id/css/testid only from live DOM or `.snapshots/`). Never invent `data-dataitemid` values.

## Output

### 1. Page Object (`<page>Page.ts`)

Path: `jackson-tests/tests/pages/firelight/<page>Page.ts`

Start from `playwright-agent/templates/page-object.template.ts`. Keep the `E('field')` + `fillByEntry` / `selectByEntry` / `clickByEntry` pattern. Include `next()` via `clickByEntry(this.page, E('next'))`.

### 2. Locator sidecar (`<page>Page.locators.json`)

Path: `jackson-tests/tests/pages/firelight/<page>Page.locators.json`

Start from `playwright-agent/templates/locators.template.json`. Strategy order (highest confidence first): testid → id → css (`data-dataitemid` when present on the live node) → role → label → text.

## Rules

1. Class name: `<Page>Page` (PascalCase)
2. Files go in `jackson-tests/tests/pages/firelight/`
3. Constructor takes `Page` only
4. Confidence: testid=1.0, css dataitem=0.96, id=0.93, role=0.86, label=0.8, text=0.55
5. Use Firelight form locators only. Do not use CMS component-root CSS or style-guide URLs
6. On `--update`, merge new elements; preserve manual confidence overrides
7. If `.snapshots/<page>.json` is missing and Firelight is reachable, run `npm run baseline:capture` or `npm run detect:changes` first so the cache is populated
