import { Page } from '@playwright/test';
import path from 'path';
import { selectByEntry, clickByEntry } from '../../utils/form-helpers';
import { fieldLabel, loadLocators } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'newApplicationInformationPage.locators.json'));
const E = (key: string) => registry.entries[key];
const L = (key: string) => fieldLabel(registry.entries[key]);

export class NewApplicationInformationPage {
  constructor(private page: Page) {}

  async fill(data: {
    ownershipType: string;
    annuitantSameAsOwner: string;
    jointAnnuitant: string;
    taxQualificationType: string;
    qualifiedAccountType: string;
  }) {
    await selectByEntry(this.page, E('ownershipType'), data.ownershipType);
    await this.page.waitForTimeout(1500);
    await selectByEntry(this.page, E('annuitantSameAsOwner'), data.annuitantSameAsOwner);
    await selectByEntry(this.page, E('jointAnnuitant'), data.jointAnnuitant);
    await this.page.getByText(L('taxQualificationType'), { exact: false }).first().waitFor({ timeout: 20_000 });
    await selectByEntry(this.page, E('taxQualificationType'), data.taxQualificationType);
    await this.page.getByText(L('qualifiedAccountType'), { exact: false }).first().waitFor({ timeout: 15_000 });
    await selectByEntry(this.page, E('qualifiedAccountType'), data.qualifiedAccountType);
  }

  async next() {
    await clickByEntry(this.page, E('next'));
  }
}
