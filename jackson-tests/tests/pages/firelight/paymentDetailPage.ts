import { Page } from '@playwright/test';
import path from 'path';
import { selectByEntry, fillByEntry, clickByEntry } from '../../utils/form-helpers';
import { loadLocators } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'paymentDetailPage.locators.json'));
const E = (key: string) => registry.entries[key];

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
    await selectByEntry(this.page, E('existingPolicies'), data.existingPolicies);
    await selectByEntry(this.page, E('replacing'), data.replacing);
    await selectByEntry(this.page, E('premiumType'), data.premiumType);
    await selectByEntry(this.page, E('paymentMethod'), data.paymentMethod);
    await fillByEntry(this.page, E('amount'), data.amount);
  }

  async next() {
    await clickByEntry(this.page, E('next'));
  }
}
