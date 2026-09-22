import { Page } from '@playwright/test';
import { clickNext } from '../../utils/form-helpers';

export class InitialAllocationsPage {
  constructor(private page: Page) {}

  /** Select first available investment option — refine once live DOM is known */
  async selectInvestmentOption() {
    const option = this.page.locator('input[type="checkbox"], input[type="radio"]').first();
    if (await option.count()) {
      await option.check({ force: true }).catch(async () => option.click());
      return;
    }
    await this.page.getByText(/investment|allocation|fund/i).first().click();
  }

  async next() {
    await clickNext(this.page);
  }
}
