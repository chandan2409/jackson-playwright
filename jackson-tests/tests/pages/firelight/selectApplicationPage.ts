import { Page } from '@playwright/test';
import path from 'path';
import { loadLocators, resolveLocator } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'selectApplicationPage.locators.json'));

/**
 * Home + Create New Application (live Firelight EGApp).
 * Source: Boun_POCtestcase.xlsx + live DOM scan 2026-09-23.
 */
export class SelectApplicationPage {
  constructor(private page: Page) {}

  async goto(baseUrl: string) {
    await this.page.goto(baseUrl);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async startApplication() {
    const start = await resolveLocator(this.page, registry.entries.startApplication);
    await start.click();
    await this.page.locator('#Jurisdiction').waitFor({ timeout: 30_000 });
  }

  async selectJurisdiction(jurisdiction: string) {
    const field = await resolveLocator(this.page, registry.entries.jurisdiction);
    await field.selectOption({ label: jurisdiction });
  }

  async selectProduct(product: string) {
    const typeField = this.page.locator('#ProductType');
    if (await typeField.count()) {
      await typeField.selectOption({ label: 'All' }).catch(() => undefined);
    }
    await this.page.waitForTimeout(1000);
    // Accessible name is "Variable Annuity, Jackson Life, Elite Access II (B Share)"
    const productLink = this.page.getByRole('link', { name: product });
    await productLink.first().waitFor({ timeout: 20_000 });
    await productLink.first().click();
    const createLink = this.page.getByRole('link', { name: 'Create' });
    await this.page
      .getByText(/Click 'Create' to proceed/i)
      .or(createLink)
      .first()
      .waitFor({ timeout: 30_000 });
    await createLink.scrollIntoViewIfNeeded().catch(() => undefined);
  }

  async confirmCreate(caseName: string) {
    const dialog = this.page.getByRole('dialog', { name: 'Create Activity' });
    if (!(await dialog.isVisible().catch(() => false))) {
      await this.page.getByRole('link', { name: 'Create' }).click();
      await dialog.waitFor({ timeout: 20_000 });
    }

    await dialog.getByRole('textbox', { name: 'Name' }).fill(caseName);
    await dialog.getByRole('button', { name: 'Create' }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);

    await this.page.getByText(caseName, { exact: true }).first().waitFor({ timeout: 45_000 });
    await this.page
      .getByText('Loading...')
      .waitFor({ state: 'hidden', timeout: 90_000 })
      .catch(() => undefined);
    await this.page
      .getByText(/New Application Information|Please select the type of ownership/i)
      .first()
      .waitFor({ timeout: 90_000 });
    await this.page.waitForTimeout(1000);
  }
}
