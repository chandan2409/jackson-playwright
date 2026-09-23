import { Page } from '@playwright/test';
import { selectByLabel, clickNext } from '../../utils/form-helpers';

export class NewApplicationInformationPage {
  constructor(private page: Page) {}

  async fill(data: {
    ownershipType: string;
    annuitantSameAsOwner: string;
    jointAnnuitant: string;
    taxQualificationType: string;
    qualifiedAccountType: string;
  }) {
    await selectByLabel(this.page, 'Please select the type of ownership for this account', data.ownershipType);
    await this.page.waitForTimeout(1500);
    await selectByLabel(this.page, 'Is the annuitant the same as the owner?', data.annuitantSameAsOwner);
    await selectByLabel(this.page, 'Is there a joint annuitant?', data.jointAnnuitant);
    await this.page.getByText('Tax Qualification Type', { exact: false }).first().waitFor({ timeout: 20_000 });
    await selectByLabel(this.page, 'Tax Qualification Type', data.taxQualificationType);
    await this.page.getByText('Type of Qualified Account', { exact: false }).first().waitFor({ timeout: 15000 });
    await selectByLabel(this.page, 'Type of Qualified Account', data.qualifiedAccountType);
  }

  async next() {
    await clickNext(this.page);
  }
}
