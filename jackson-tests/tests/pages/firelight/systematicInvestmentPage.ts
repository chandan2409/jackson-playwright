import { Page } from '@playwright/test';
import { selectByLabel, clickNext } from '../../utils/form-helpers';

export class SystematicInvestmentPage {
  constructor(private page: Page) {}

  async fillIfPresent() {
    const heading = this.page.getByText('Systematic Investment', { exact: false }).first();
    try {
      await heading.waitFor({ timeout: 8_000 });
    } catch {
      return;
    }
    await selectByLabel(this.page, 'Asset Rebalancing', 'None');
    await selectByLabel(this.page, 'Dollar Cost Averaging options', 'None');
    await clickNext(this.page);
  }
}
