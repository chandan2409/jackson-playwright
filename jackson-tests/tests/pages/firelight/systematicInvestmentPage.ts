import { Page } from '@playwright/test';
import path from 'path';
import { selectByEntry, clickByEntry } from '../../utils/form-helpers';
import { loadLocators, resolveLocator } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'systematicInvestmentPage.locators.json'));
const E = (key: string) => registry.entries[key];

export class SystematicInvestmentPage {
  constructor(private page: Page) {}

  async fillIfPresent() {
    try {
      await resolveLocator(this.page, E('heading'), 8_000);
    } catch {
      return;
    }
    await selectByEntry(this.page, E('assetRebalancing'), 'None');
    await selectByEntry(this.page, E('dca'), 'None');
    await clickByEntry(this.page, E('next'));
  }
}
