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
    await selectByLabel(this.page, 'Select Ownership type', data.ownershipType);
    await selectByLabel(this.page, 'Is the annuitant the same as the owner?', data.annuitantSameAsOwner);
    await selectByLabel(this.page, 'Is there a joint annuitant?', data.jointAnnuitant);
    await selectByLabel(this.page, 'Tax Qualification Type', data.taxQualificationType);
    await selectByLabel(this.page, 'Type of Qualified Account', data.qualifiedAccountType);
  }

  async next() {
    await clickNext(this.page);
  }
}
