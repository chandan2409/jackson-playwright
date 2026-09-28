import { Page, expect } from '@playwright/test';
import path from 'path';
import { selectByEntry } from '../../utils/form-helpers';
import { wizardScope } from '../../utils/wizard-scope';
import { loadLocators } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'signingProcessPage.locators.json'));
const E = (key: string) => registry.entries[key];

export class SigningProcessPage {
  constructor(private page: Page) {}

  async selectSigningMethod(method: string) {
    await selectByEntry(this.page, E('signingMethod'), method);
  }

  async assertOnSigningPage() {
    const scope = await wizardScope(this.page);
    await expect(scope.getByText(/signing|signature/i).first()).toBeVisible({ timeout: 30_000 });
  }
}
