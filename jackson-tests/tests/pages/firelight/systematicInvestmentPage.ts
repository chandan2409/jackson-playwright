import { Page } from '@playwright/test';
import path from 'path';
import { selectChoiceBelowQuestion, clickByEntry } from '../../utils/form-helpers';
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
    await selectChoiceBelowQuestion(this.page, 'Asset Rebalancing', 'None');
    await selectChoiceBelowQuestion(
      this.page,
      'Dollar Cost Averaging options',
      'None',
      this.page.getByRole('button', { name: 'Next', exact: true }).first(),
    );
    await clickByEntry(this.page, E('next'));
  }
}
