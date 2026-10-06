import { Page } from '@playwright/test';
import ENV from '../utils/env';
import { waitForWizardIdle } from './form-helpers';
import { SelectApplicationPage } from '../pages/firelight/selectApplicationPage';
import { NewApplicationInformationPage } from '../pages/firelight/newApplicationInformationPage';
import { OwnerPage } from '../pages/firelight/ownerPage';
import { BeneficiariesPage } from '../pages/firelight/beneficiariesPage';
import { AgentPage } from '../pages/firelight/agentPage';
import { SystematicInvestmentPage } from '../pages/firelight/systematicInvestmentPage';
import { InitialAllocationsPage } from '../pages/firelight/initialAllocationsPage';
import { AddOnBenefitsPage } from '../pages/firelight/addOnBenefitsPage';
import { PaymentDetailPage } from '../pages/firelight/paymentDetailPage';
import { SigningProcessPage } from '../pages/firelight/signingProcessPage';
import { happyPathData, variantPathData } from '../data/fixtures/case-data';

type CaseData = typeof happyPathData;

export type WizardSnapshotFn = (pageKey: string) => Promise<void>;

export type WizardRunOptions = {
  /** Detect/baseline: record the error and jump to the next wizard page instead of aborting. */
  continueOnError?: boolean;
  onStepError?: (pageKey: string, error: Error) => void;
};

const PAGE_LIST_NAME: Record<string, string> = {
  'new-application-information': 'New Application Information',
  owner: 'Owner',
  beneficiaries: 'Beneficiaries',
  agent: 'Agent',
  'systematic-investment': 'Systematic Investment',
  'initial-allocations': 'Initial Allocations',
  'add-on-benefits': 'Add-On Benefits',
  'payment-detail': 'Payment Detail',
  'signing-process': 'Signing Process',
};

async function jumpToWizardPage(page: Page, listName: string): Promise<void> {
  await waitForWizardIdle(page);
  const heading = page.getByText(listName, { exact: true }).first();
  if (await heading.isVisible().catch(() => false)) return;

  const open = page.getByRole('link', { name: /Open Page List/i }).first();
  if (await open.isVisible().catch(() => false)) {
    await open.click().catch(() => undefined);
  } else {
    await page.getByText(/Open Page List/i).first().click().catch(() => undefined);
  }
  await page.waitForTimeout(400);
  const item = page
    .getByRole('link', { name: listName, exact: true })
    .or(page.getByText(listName, { exact: true }));
  if (await item.count()) await item.last().click({ timeout: 8_000 }).catch(() => undefined);
  await waitForWizardIdle(page);
}

/**
 * Shared Firelight wizard flow for Elite Access II / Colorado.
 * Optional snapshot hook is used by Day 6 baseline capture and Day 8 detect.
 */
export async function runFirelightWizard(
  page: Page,
  data: CaseData,
  snapshot?: WizardSnapshotFn,
  options?: WizardRunOptions,
) {
  const recover = async (pageKey: string, nextPageKey: string | null, err: unknown) => {
    const error = err instanceof Error ? err : new Error(String(err));
    options?.onStepError?.(pageKey, error);
    if (!options?.continueOnError) throw error;
    console.warn(`Wizard ${pageKey} failed; continuing walk: ${error.message}`);
    if (nextPageKey && PAGE_LIST_NAME[nextPageKey]) {
      await jumpToWizardPage(page, PAGE_LIST_NAME[nextPageKey]);
    }
  };

  const select = new SelectApplicationPage(page);
  await select.goto(ENV.FIRELIGHT_BASE_URL);
  await select.startApplication();
  await select.selectJurisdiction(data.jurisdiction);
  await select.selectProduct(data.product);
  await snapshot?.('select-application');
  await select.confirmCreate(data.caseName);

  const appInfo = new NewApplicationInformationPage(page);
  await snapshot?.('new-application-information');
  try {
    await appInfo.fill({
      ownershipType: data.ownershipType,
      annuitantSameAsOwner: data.annuitantSameAsOwner,
      jointAnnuitant: data.jointAnnuitant,
      taxQualificationType: data.taxQualificationType,
      qualifiedAccountType: data.qualifiedAccountType,
    });
    await appInfo.next();
  } catch (err) {
    await recover('new-application-information', 'owner', err);
  }

  const owner = new OwnerPage(page);
  await snapshot?.('owner');
  try {
    await owner.fill(data.owner);
    await owner.next();
  } catch (err) {
    await recover('owner', 'beneficiaries', err);
  }

  const beneficiaries = new BeneficiariesPage(page);
  await snapshot?.('beneficiaries');
  try {
    await beneficiaries.fillPrimary(data.primaryBeneficiary);
    await beneficiaries.addContingent(data.contingentBeneficiary);
    await beneficiaries.next();
  } catch (err) {
    await recover('beneficiaries', 'agent', err);
  }

  const agent = new AgentPage(page);
  await snapshot?.('agent');
  try {
    await agent.fill(data.agent);
    await agent.next();
  } catch (err) {
    await recover('agent', 'systematic-investment', err);
  }

  const systematic = new SystematicInvestmentPage(page);
  await snapshot?.('systematic-investment');
  try {
    await systematic.fillIfPresent();
  } catch (err) {
    await recover('systematic-investment', 'initial-allocations', err);
  }

  const allocations = new InitialAllocationsPage(page);
  await snapshot?.('initial-allocations');
  try {
    await allocations.selectInvestmentOption();
    await allocations.next();
  } catch (err) {
    await recover('initial-allocations', 'add-on-benefits', err);
  }

  const addOns = new AddOnBenefitsPage(page);
  await snapshot?.('add-on-benefits');
  try {
    await addOns.continueIfPresent();
  } catch (err) {
    await recover('add-on-benefits', 'payment-detail', err);
  }

  try {
    await page.getByText(/Payment Detail|Premium Type|Payment Method/i).first().waitFor({ timeout: 20_000 });
  } catch (err) {
    await recover('payment-detail', 'payment-detail', err);
  }
  await snapshot?.('payment-detail');

  const payment = new PaymentDetailPage(page);
  try {
    await payment.fill(data.payment);
    await payment.next();
  } catch (err) {
    await recover('payment-detail', 'signing-process', err);
  }

  const signing = new SigningProcessPage(page);
  await snapshot?.('signing-process');
  try {
    await signing.selectSigningMethod(data.signingMethod);
    await signing.assertOnSigningPage();
    await signing.assertDataEntryComplete();
  } catch (err) {
    await recover('signing-process', null, err);
  }
}

export { happyPathData, variantPathData };
