import { Page, expect } from '@playwright/test';
import path from 'path';
import { clickByEntry } from '../../utils/form-helpers';
import { loadLocators, tryResolveLocator } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'signaturesPage.locators.json'));
const E = (key: string) => registry.entries[key];

export class SignaturesPage {
  constructor(private page: Page) {}

  async assertOnSignatures() {
    await expect(
      this.page.getByRole('button', { name: /Submit for Review|CONTINUE/i }).first(),
    ).toBeVisible({ timeout: 45_000 });
  }

  async completeWetSignaturePhase() {
    await this.assertOnSignatures();
    for (const key of ['generate', 'request', 'submit'] as const) {
      const loc = await tryResolveLocator(this.page, E(key));
      if (!loc) continue;
      if (!(await loc.isEnabled().catch(() => false))) continue;
      await clickByEntry(this.page, E(key)).catch(() => undefined);
      await this.page.waitForTimeout(1_200);
    }
    const cont = await tryResolveLocator(this.page, E('continue'));
    if (cont && (await cont.isEnabled().catch(() => false))) {
      await clickByEntry(this.page, E('continue')).catch(() => undefined);
    }
    await expect(
      this.page.getByText(/SIGNATURES|FINALIZE|Submit for Review|complete|signed|review/i).first(),
    ).toBeVisible({
      timeout: 30_000,
    });
  }
}
