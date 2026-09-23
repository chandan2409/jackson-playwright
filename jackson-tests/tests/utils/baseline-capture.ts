import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';
import ENV from './env';
import { captureCurrentPage, type PageSnapshot } from './dom-snapshot';
import { happyPathData, runFirelightWizard } from './wizard-flow';

const ROOT = path.resolve(__dirname, '../..');
const BASELINE_DIR = path.join(ROOT, 'tests/data/baselines');
const AUTH = path.join(ROOT, '.auth/firelight-state.json');

export type { DomElementSnapshot, PageSnapshot } from './dom-snapshot';

export type BaselineManifest = {
  baselineId: string;
  capturedAt: string;
  product: string;
  jurisdiction: string;
  caseName: string;
  pages: string[];
};

const FALLBACK_PAGES = [
  'select-application',
  'new-application-information',
  'owner',
  'beneficiaries',
  'agent',
  'systematic-investment',
  'initial-allocations',
  'add-on-benefits',
  'payment-detail',
  'signing-process',
];

function writeSnap(outDir: string, snap: PageSnapshot) {
  fs.writeFileSync(path.join(outDir, `${snap.pageKey}.json`), JSON.stringify(snap, null, 2));
}

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

  const stubRemaining = () => {
    for (const pageKey of FALLBACK_PAGES) {
      if (manifest.pages.includes(pageKey)) continue;
      const stub: PageSnapshot = {
        pageKey,
        url: '',
        capturedAt: new Date().toISOString(),
        title: `(pending wizard navigation) ${pageKey}`,
        elements: [],
      };
      writeSnap(outDir, stub);
      manifest.pages.push(pageKey);
    }
  };

  if (!ENV.FIRELIGHT_USERNAME || !fs.existsSync(AUTH)) {
    stubRemaining();
    fs.writeFileSync(path.join(BASELINE_DIR, 'CURRENT'), baselineId);
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`Wrote scaffold baseline ${baselineId} (no live auth). Re-run after Day 0 login.`);
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: AUTH });
  const page = await context.newPage();

  try {
    await runFirelightWizard(page, happyPathData, async (pageKey) => {
      const snap = await captureCurrentPage(page, pageKey);
      writeSnap(outDir, snap);
      if (!manifest.pages.includes(pageKey)) manifest.pages.push(pageKey);
      console.log(`Captured ${pageKey} (${snap.elements.length} elements)`);
    });
  } catch (err) {
    console.warn('Wizard walk stopped early:', err);
  } finally {
    stubRemaining();
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(BASELINE_DIR, 'CURRENT'), baselineId);
    await browser.close();
  }

  console.log(`Baseline frozen: ${baselineId} → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
