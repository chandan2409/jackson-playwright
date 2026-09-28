import { Page } from '@playwright/test';
import path from 'path';
import { selectByLabel, clickNext } from '../../utils/form-helpers';
import { fieldLabel, loadLocators } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'newApplicationInformationPage.locators.json'));
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
    await selectByLabel(this.page, L('ownershipType'), data.ownershipType);
    await this.page.waitForTimeout(1500);
    await selectByLabel(this.page, L('annuitantSameAsOwner'), data.annuitantSameAsOwner);
    await selectByLabel(this.page, L('jointAnnuitant'), data.jointAnnuitant);
    await this.page.getByText(L('taxQualificationType'), { exact: false }).first().waitFor({ timeout: 20_000 });
    await selectByLabel(this.page, L('taxQualificationType'), data.taxQualificationType);
    await this.page.getByText(L('qualifiedAccountType'), { exact: false }).first().waitFor({ timeout: 15000 });
    await selectByLabel(this.page, L('qualifiedAccountType'), data.qualifiedAccountType);
  }

  async next() {
    await clickNext(this.page);
  }
}
