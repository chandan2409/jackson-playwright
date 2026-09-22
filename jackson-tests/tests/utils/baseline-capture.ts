import fs from 'fs';
import path from 'path';
import { chromium, Page } from '@playwright/test';
import ENV from './env';

const ROOT = path.resolve(__dirname, '../..');
const BASELINE_DIR = path.join(ROOT, 'tests/data/baselines');
const AUTH = path.join(ROOT, '.auth/firelight-state.json');

export type DomElementSnapshot = {
  name: string;
  tag: string;
  text: string;
  label: string | null;
  id: string | null;
  testId: string | null;
  nameAttr: string | null;
  classes: string[];
  type: string | null;
  options?: string[];
};

export type PageSnapshot = {
  pageKey: string;
  url: string;
  capturedAt: string;
  title: string;
  elements: DomElementSnapshot[];
};

export type BaselineManifest = {
  baselineId: string;
  capturedAt: string;
  product: string;
  jurisdiction: string;
  caseName: string;
  pages: string[];
};

const WIZARD_PAGES = [
  'select-application',
  'new-application-information',
  'owner',
  'beneficiaries',
  'agent',
  'initial-allocations',
  'payment-detail',
  'signing-process',
];

async function extractInteractive(page: Page): Promise<DomElementSnapshot[]> {
  return page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll('input, select, textarea, button, [role="button"], [role="combobox"], a'),
    );
    return nodes.slice(0, 400).map((el, idx) => {
      const html = el as HTMLElement;
      const labelEl =
        (html.id && document.querySelector(`label[for="${html.id}"]`)) ||
        html.closest('label');
      const labelText = labelEl?.textContent?.trim() || html.getAttribute('aria-label');
      const options =
        html.tagName.toLowerCase() === 'select'
          ? Array.from((html as HTMLSelectElement).options).map((o) => o.text.trim())
          : undefined;
      return {
        name: html.getAttribute('name') || html.id || `el_${idx}`,
        tag: html.tagName.toLowerCase(),
        text: (html.innerText || html.textContent || '').trim().slice(0, 120),
        label: labelText || null,
        id: html.id || null,
        testId: html.getAttribute('data-testid'),
        nameAttr: html.getAttribute('name'),
        classes: Array.from(html.classList),
        type: html.getAttribute('type'),
        options,
      };
    });
  });
}

async function captureCurrentPage(page: Page, pageKey: string): Promise<PageSnapshot> {
  return {
    pageKey,
    url: page.url(),
    capturedAt: new Date().toISOString(),
    title: await page.title(),
    elements: await extractInteractive(page),
  };
}

/**
 * Captures DOM snapshots for baseline freeze (Day 6).
 * With credentials: navigates live Firelight and snapshots each wizard step reached.
 * Without credentials: writes an empty scaffold baseline so the path exists for commit.
 */
async function main() {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  const baselineId = `baseline-${new Date().toISOString().slice(0, 10)}`;
  const outDir = path.join(BASELINE_DIR, baselineId);
  fs.mkdirSync(outDir, { recursive: true });

  const manifest: BaselineManifest = {
    baselineId,
    capturedAt: new Date().toISOString(),
    product: ENV.FIRELIGHT_PRODUCT,
    jurisdiction: ENV.FIRELIGHT_JURISDICTION,
    caseName: ENV.FIRELIGHT_CASE_NAME,
    pages: [],
  };

  if (!ENV.FIRELIGHT_USERNAME || !fs.existsSync(AUTH)) {
    for (const pageKey of WIZARD_PAGES) {
      const stub: PageSnapshot = {
        pageKey,
        url: ENV.FIRELIGHT_BASE_URL,
        capturedAt: new Date().toISOString(),
        title: `(scaffold) ${pageKey}`,
        elements: [],
      };
      fs.writeFileSync(path.join(outDir, `${pageKey}.json`), JSON.stringify(stub, null, 2));
      manifest.pages.push(pageKey);
    }
    fs.writeFileSync(path.join(BASELINE_DIR, 'CURRENT'), baselineId);
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`Wrote scaffold baseline ${baselineId} (no live auth). Re-run after Day 0 login.`);
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: AUTH });
  const page = await context.newPage();
  await page.goto(ENV.FIRELIGHT_BASE_URL);
  await page.waitForLoadState('domcontentloaded');

  // Capture whatever page we land on; full wizard walk uses POMs once live selectors exist
  const pageKey = 'select-application';
  const snap = await captureCurrentPage(page, pageKey);
  fs.writeFileSync(path.join(outDir, `${pageKey}.json`), JSON.stringify(snap, null, 2));
  manifest.pages.push(pageKey);

  // Placeholder snapshots for remaining steps until full wizard automation is wired
  for (const key of WIZARD_PAGES.filter((p) => p !== pageKey)) {
    const stub: PageSnapshot = {
      pageKey: key,
      url: '',
      capturedAt: new Date().toISOString(),
      title: `(pending wizard navigation) ${key}`,
      elements: [],
    };
    fs.writeFileSync(path.join(outDir, `${key}.json`), JSON.stringify(stub, null, 2));
    manifest.pages.push(key);
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(BASELINE_DIR, 'CURRENT'), baselineId);
  await browser.close();
  console.log(`Baseline frozen: ${baselineId} → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
