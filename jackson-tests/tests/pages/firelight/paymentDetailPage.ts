import { Page } from '@playwright/test';
import path from 'path';
import { selectByLabel, fillByLabel, clickNext } from '../../utils/form-helpers';
import { fieldLabel, loadLocators } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'paymentDetailPage.locators.json'));
const L = (key: string) => fieldLabel(registry.entries[key]);

export type PaymentData = {
  existingPolicies: string;
  replacing: string;
  premiumType: string;
  paymentMethod: string;
  amount: string;
};

export class PaymentDetailPage {
  constructor(private page: Page) {}

  async fill(data: PaymentData) {
    await selectByLabel(this.page, L('existingPolicies'), data.existingPolicies);
    await selectByLabel(this.page, L('replacing'), data.replacing);
    await selectByLabel(this.page, L('premiumType'), data.premiumType);
    await selectByLabel(this.page, L('paymentMethod'), data.paymentMethod);
    await fillByLabel(this.page, L('amount'), data.amount);
  }

  async next() {
    await clickNext(this.page);
  }
}
