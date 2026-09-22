import { Page } from '@playwright/test';
import { selectByLabel, fillByLabel, clickNext } from '../../utils/form-helpers';

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
    await selectByLabel(
      this.page,
      'Does the owner have existing or pending life insurance or annuity policies?',
      data.existingPolicies,
    );
    await selectByLabel(
      this.page,
      'Are you replacing an existing life insurance or annuity contract?',
      data.replacing,
    );
    await selectByLabel(this.page, 'Premium Type', data.premiumType);
    await selectByLabel(this.page, 'Payment Method', data.paymentMethod);
    await fillByLabel(this.page, 'Amount', data.amount);
  }

  async next() {
    await clickNext(this.page);
  }
}
