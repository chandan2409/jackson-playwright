import { Page } from '@playwright/test';
import path from 'path';
import { selectByEntry, clickByEntry, selectChoiceBelowQuestion } from '../../utils/form-helpers';
import { loadLocators } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'newApplicationInformationPage.locators.json'));
const E = (key: string) => registry.entries[key];

export class NewApplicationInformationPage {
  constructor(private page: Page) {}

  async fill(data: {
    ownershipType: string;
    annuitantSameAsOwner: string;
    jointAnnuitant: string;
    taxQualificationType: string;
    qualifiedAccountType: string;
  }) {
    await this.page.bringToFront();
    await selectByEntry(this.page, E('ownershipType'), data.ownershipType);
    await selectChoiceBelowQuestion(
      this.page,
      'Is the annuitant the same as the owner?',
      data.annuitantSameAsOwner,
    );
    await selectChoiceBelowQuestion(
      this.page,
      'Is there a joint annuitant?',
      data.jointAnnuitant,
      this.page.getByRole('checkbox', { name: /Qualified Account|^Qualified$/i }).first(),
    );
    await selectChoiceBelowQuestion(
      this.page,
      'Tax Qualification Type',
      data.taxQualificationType,
      this.page.getByRole('combobox', { name: /Type of Qualified Account/i }).first(),
    );
    await selectByEntry(this.page, E('qualifiedAccountType'), data.qualifiedAccountType);
  }

  async next() {
    await clickByEntry(this.page, E('next'));
  }
}
