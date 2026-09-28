import { expect, Page } from '@playwright/test';
import path from 'path';
import { clickNext } from '../../utils/form-helpers';
import { fieldLabel, loadLocators } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'initialAllocationsPage.locators.json'));
const L = (key: string) => fieldLabel(registry.entries[key]);

export class InitialAllocationsPage {
  constructor(private page: Page) {}

  async selectInvestmentOption() {
    await this.page.getByText(/Initial Allocations/i).first().waitFor({ timeout: 20_000 });
    const fund = this.page.getByText(L('investmentOption'), { exact: true }).first();
    await fund.scrollIntoViewIfNeeded();
    const allocation = fund.locator(
      'xpath=following::input[not(@type="checkbox") and not(@type="radio") and not(@type="hidden")][1]',
    );
    await allocation.click();
    await allocation.fill('100');
    await allocation.press('Tab').catch(() => undefined);
    await expect(this.page.getByRole('button', { name: 'Next', exact: true }).first()).toBeEnabled({
      timeout: 15_000,
    });
  }

  async next() {
    await clickNext(this.page);
  }
}
