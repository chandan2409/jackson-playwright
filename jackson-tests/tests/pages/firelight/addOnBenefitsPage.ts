import { Page } from '@playwright/test';
import { clickNext } from '../../utils/form-helpers';

export class AddOnBenefitsPage {
  constructor(private page: Page) {}

  async continueIfPresent() {
    const heading = this.page.getByText('Add-On Benefits', { exact: false }).first();
    try {
      await heading.waitFor({ timeout: 8_000 });
    } catch {
      return;
    }
    const next = this.page.getByRole('button', { name: 'Next', exact: true }).first();
    try {
      await next.waitFor({ timeout: 5_000 });
      if (!(await next.isEnabled())) {
        await this.page.waitForTimeout(2000);
      }
    } catch {
      return;
    }
    await clickNext(this.page).catch(async () => {
      await this.page.getByRole('button', { name: 'Next', exact: true }).first().click({ force: true });
      await this.page.waitForTimeout(800);
    });
  }
}
