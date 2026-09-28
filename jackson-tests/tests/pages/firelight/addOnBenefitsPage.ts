import { Page } from '@playwright/test';
import path from 'path';
import { clickByEntry } from '../../utils/form-helpers';
import { loadLocators, resolveLocator } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'addOnBenefitsPage.locators.json'));
const E = (key: string) => registry.entries[key];

export class AddOnBenefitsPage {
  constructor(private page: Page) {}

  async continueIfPresent() {
    try {
      await resolveLocator(this.page, E('heading'), 8_000);
    } catch {
      return;
    }
    try {
      const next = await resolveLocator(this.page, E('next'), 5_000);
      if (!(await next.isEnabled())) {
        await this.page.waitForTimeout(2000);
      }
    } catch {
      return;
    }
    await clickByEntry(this.page, E('next')).catch(async () => {
      const next = await resolveLocator(this.page, E('next'));
      await next.click({ force: true });
      await this.page.waitForTimeout(800);
    });
  }
}
