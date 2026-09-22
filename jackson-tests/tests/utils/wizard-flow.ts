import { Page } from '@playwright/test';
import ENV from '../utils/env';
import { SelectApplicationPage } from '../pages/firelight/selectApplicationPage';
import { NewApplicationInformationPage } from '../pages/firelight/newApplicationInformationPage';
import { OwnerPage } from '../pages/firelight/ownerPage';
import { BeneficiariesPage } from '../pages/firelight/beneficiariesPage';
import { AgentPage } from '../pages/firelight/agentPage';
import { InitialAllocationsPage } from '../pages/firelight/initialAllocationsPage';
import { PaymentDetailPage } from '../pages/firelight/paymentDetailPage';
import { SigningProcessPage } from '../pages/firelight/signingProcessPage';
import { happyPathData, variantPathData } from '../data/fixtures/case-data';

type CaseData = typeof happyPathData;

/**
 * Shared Firelight wizard flow for Elite Access II / Colorado.
 * Used by both POC scripts with different data fixtures.
 */
export async function runFirelightWizard(page: Page, data: CaseData) {
  const select = new SelectApplicationPage(page);
  await select.goto(ENV.FIRELIGHT_BASE_URL);
  await select.selectJurisdiction(data.jurisdiction);
  await select.selectProduct(data.product);
  await select.nameCase(data.caseName);
  await select.startApplication();

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
  await owner.fill(data.owner);
  await owner.next();

  const beneficiaries = new BeneficiariesPage(page);
  await beneficiaries.fillPrimary(data.primaryBeneficiary);
  await beneficiaries.addContingent(data.contingentBeneficiary);
  await beneficiaries.next();

  const agent = new AgentPage(page);
  await agent.fill(data.agent);
  await agent.next();

  const allocations = new InitialAllocationsPage(page);
  await allocations.selectInvestmentOption();
  await allocations.next();

  const payment = new PaymentDetailPage(page);
  await payment.fill(data.payment);
  await payment.next();

  const signing = new SigningProcessPage(page);
  await signing.selectSigningMethod(data.signingMethod);
  await signing.assertOnSigningPage();
}

export { happyPathData, variantPathData };
