import { Page } from '@playwright/test';
import ENV from '../utils/env';
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

/**
 * Shared Firelight wizard flow for Elite Access II / Colorado.
 * Optional snapshot hook is used by Day 6 baseline capture and Day 8 detect.
 */
export async function runFirelightWizard(
  page: Page,
  data: CaseData,
  snapshot?: WizardSnapshotFn,
) {
  const select = new SelectApplicationPage(page);
  await select.goto(ENV.FIRELIGHT_BASE_URL);
  await select.startApplication();
  await select.selectJurisdiction(data.jurisdiction);
  await select.selectProduct(data.product);
  await snapshot?.('select-application');
  await select.confirmCreate(data.caseName);

  const appInfo = new NewApplicationInformationPage(page);
  await snapshot?.('new-application-information');
  await appInfo.fill({
    ownershipType: data.ownershipType,
    annuitantSameAsOwner: data.annuitantSameAsOwner,
    jointAnnuitant: data.jointAnnuitant,
    taxQualificationType: data.taxQualificationType,
    qualifiedAccountType: data.qualifiedAccountType,
  });
  await appInfo.next();

  const owner = new OwnerPage(page);
  await snapshot?.('owner');
  await owner.fill(data.owner);
  await owner.next();

  const beneficiaries = new BeneficiariesPage(page);
  await snapshot?.('beneficiaries');
  await beneficiaries.fillPrimary(data.primaryBeneficiary);
  await beneficiaries.addContingent(data.contingentBeneficiary);
  await beneficiaries.next();

  const agent = new AgentPage(page);
  await snapshot?.('agent');
  await agent.fill(data.agent);
  await agent.next();

  const systematic = new SystematicInvestmentPage(page);
  await snapshot?.('systematic-investment');
  await systematic.fillIfPresent();

  const allocations = new InitialAllocationsPage(page);
  await snapshot?.('initial-allocations');
  await allocations.selectInvestmentOption();
  await allocations.next();

  const addOns = new AddOnBenefitsPage(page);
  await snapshot?.('add-on-benefits');
  await addOns.continueIfPresent();

  await page.getByText(/Payment Detail|Premium Type|Payment Method/i).first().waitFor({ timeout: 20_000 });
  await snapshot?.('payment-detail');

  const payment = new PaymentDetailPage(page);
  await payment.fill(data.payment);
  await payment.next();

  const signing = new SigningProcessPage(page);
  await snapshot?.('signing-process');
  await signing.selectSigningMethod(data.signingMethod);
  await signing.assertOnSigningPage();
}

export { happyPathData, variantPathData };
