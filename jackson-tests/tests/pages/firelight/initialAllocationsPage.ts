import { expect, Page } from '@playwright/test';
import path from 'path';
import { clickByEntry, waitForWizardIdle } from '../../utils/form-helpers';
import { loadLocators, resolveLocator } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'initialAllocationsPage.locators.json'));
const E = (key: string) => registry.entries[key];

export class InitialAllocationsPage {
  constructor(private page: Page) {}

  async selectInvestmentOption() {
    await resolveLocator(this.page, E('heading'), 20_000);
    const fund = await resolveLocator(this.page, E('investmentOption'));
    await fund.scrollIntoViewIfNeeded();
    const allocation = fund.locator(
      'xpath=following::input[not(@type="checkbox") and not(@type="radio") and not(@type="hidden")][1]',
    );
    await waitForWizardIdle(this.page);
    await allocation.click({ force: true });
    await allocation.fill('100');
    await allocation.press('Tab').catch(() => undefined);
    await expect(this.page.getByRole('button', { name: 'Next', exact: true }).first()).toBeEnabled({
      timeout: 15_000,
    });
  }

  async next() {
    await clickByEntry(this.page, E('next'));
  }
}
