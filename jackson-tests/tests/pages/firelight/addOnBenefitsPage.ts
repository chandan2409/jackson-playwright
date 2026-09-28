import { Page } from '@playwright/test';
import path from 'path';
import { clickNext } from '../../utils/form-helpers';
import { fieldLabel, loadLocators } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'addOnBenefitsPage.locators.json'));
const L = (key: string) => fieldLabel(registry.entries[key]);

export class AddOnBenefitsPage {
  constructor(private page: Page) {}

  async continueIfPresent() {
    const heading = this.page.getByText(L('heading'), { exact: false }).first();
    try {
      await heading.waitFor({ timeout: 8_000 });
    } catch {
      return;
    }
    const next = this.page.getByRole('button', { name: L('next'), exact: true }).first();
    try {
      await next.waitFor({ timeout: 5_000 });
      if (!(await next.isEnabled())) {
        await this.page.waitForTimeout(2000);
      }
    } catch {
      return;
    }
    await clickNext(this.page).catch(async () => {
      await this.page.getByRole('button', { name: L('next'), exact: true }).first().click({ force: true });
      await this.page.waitForTimeout(800);
    });
  }
}
