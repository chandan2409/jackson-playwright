import { Page, expect } from '@playwright/test';
import path from 'path';
import { selectByLabel } from '../../utils/form-helpers';
import { wizardScope } from '../../utils/wizard-scope';
import { fieldLabel, loadLocators } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'signingProcessPage.locators.json'));
const L = (key: string) => fieldLabel(registry.entries[key]);

export class SigningProcessPage {
  constructor(private page: Page) {}

  async selectSigningMethod(method: string) {
    await selectByLabel(this.page, L('signingMethod'), method);
  }

  async assertOnSigningPage() {
    const scope = await wizardScope(this.page);
    await expect(scope.getByText(/signing|signature/i).first()).toBeVisible({ timeout: 30_000 });
  }
}
