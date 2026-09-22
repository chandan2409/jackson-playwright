import { Page, expect } from '@playwright/test';
import { selectByLabel } from '../../utils/form-helpers';

export class SigningProcessPage {
  constructor(private page: Page) {}

  async selectSigningMethod(method: string) {
    await selectByLabel(
      this.page,
      'Which method will be used to collect signatures?',
      method,
    );
  }

  async assertOnSigningPage() {
    await expect(
      this.page.getByText(/signing|signature/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  }
}
