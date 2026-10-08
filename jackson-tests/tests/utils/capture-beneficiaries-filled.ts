/**
 * Landing Detect/baseline shots miss Add Additional Beneficiary.
 * Create app → Owner → Beneficiaries fillPrimary → screenshot expanded form.
 */
import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';
import ENV from './env';
import { happyPathData } from './wizard-flow';
import { screenshotWizard } from './wizard-shot';
import { captureCurrentPage } from './dom-snapshot';
import { SelectApplicationPage } from '../pages/firelight/selectApplicationPage';
import { NewApplicationInformationPage } from '../pages/firelight/newApplicationInformationPage';
import { OwnerPage } from '../pages/firelight/ownerPage';
import { BeneficiariesPage } from '../pages/firelight/beneficiariesPage';

const ROOT = path.resolve(__dirname, '../..');
const AUTH = path.join(ROOT, '.auth/firelight-state.json');
const OUT_DIR = path.join(ROOT, 'tests/reports/changes/evidence');
const BASELINE_PNG = path.join(
  ROOT,
  'tests/data/baselines/baseline-2026-10-05',
  'beneficiaries-filled.png',
);

async function main() {
  if (!ENV.FIRELIGHT_USERNAME || !fs.existsSync(AUTH)) {
    console.error('Need FIRELIGHT_USERNAME and .auth/firelight-state.json');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const data = happyPathData;
  const browser = await chromium.launch({ headless: !!process.env.CI });
  const context = await browser.newContext({ storageState: AUTH });
  const page = await context.newPage();

  const select = new SelectApplicationPage(page);
  await select.goto(ENV.FIRELIGHT_BASE_URL);
  await select.startApplication();
  await select.selectJurisdiction(data.jurisdiction);
  await select.selectProduct(data.product);
  await select.confirmCreate(data.caseName);

  const appInfo = new NewApplicationInformationPage(page);
  await appInfo.fill({
    ownershipType: data.ownershipType,
    annuitantSameAsOwner: data.annuitantSameAsOwner,
    jointAnnuitant: data.jointAnnuitant,
    taxQualificationType: data.taxQualificationType,
    qualifiedAccountType: data.qualifiedAccountType,
  });
  await appInfo.next();

  const owner = new OwnerPage(page);
  try {
    await owner.fill(data.owner);
    await owner.next();
  } catch (err) {
    console.warn('Owner fill/next:', err instanceof Error ? err.message : err);
    const open = page.getByRole('link', { name: /Open Page List/i }).first();
    await open.click().catch(() => undefined);
    await page.getByRole('link', { name: /^Beneficiaries$/i }).last().click({ timeout: 8_000 });
  }

  const beneficiaries = new BeneficiariesPage(page);
  await beneficiaries.fillPrimary(data.primaryBeneficiary);

  const evidencePng = path.join(OUT_DIR, 'beneficiaries-filled.png');
  await screenshotWizard(page, evidencePng);
  if (fs.existsSync(path.dirname(BASELINE_PNG))) {
    fs.copyFileSync(evidencePng, BASELINE_PNG);
  }
  const snap = await captureCurrentPage(page, 'beneficiaries');
  const html = snap.html || '';
  console.log(`Wrote ${evidencePng}`);
  if (fs.existsSync(BASELINE_PNG)) console.log(`Copied ${BASELINE_PNG}`);
  console.log(
    'Add Additional Beneficiary in HTML:',
    html.includes('Add Additional Beneficiary') || html.includes('Add Beneficiary'),
  );
  console.log('Relationship in HTML:', html.includes('Relationship') || html.includes('PrimaryBeneficiary1_Relationship'));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
