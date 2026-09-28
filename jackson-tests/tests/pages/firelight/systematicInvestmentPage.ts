import { Page } from '@playwright/test';
import path from 'path';
import { selectByLabel, clickNext } from '../../utils/form-helpers';
import { fieldLabel, loadLocators } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'systematicInvestmentPage.locators.json'));
const L = (key: string) => fieldLabel(registry.entries[key]);

export class SystematicInvestmentPage {
  constructor(private page: Page) {}

  async fillIfPresent() {
    const heading = this.page.getByText('Systematic Investment', { exact: false }).first();
    try {
      await heading.waitFor({ timeout: 8_000 });
    } catch {
      return;
    }
    await selectByLabel(this.page, L('assetRebalancing'), 'None');
    await selectByLabel(this.page, L('dca'), 'None');
    await clickNext(this.page);
  }
}
