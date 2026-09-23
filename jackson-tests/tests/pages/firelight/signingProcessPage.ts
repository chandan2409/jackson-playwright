import { Page, expect } from '@playwright/test';
import { selectByLabel } from '../../utils/form-helpers';
import { wizardScope } from '../../utils/wizard-scope';

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
    const scope = await wizardScope(this.page);
    await expect(scope.getByText(/signing|signature/i).first()).toBeVisible({ timeout: 30_000 });
  }
}
