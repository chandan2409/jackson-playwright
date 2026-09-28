import { Page } from '@playwright/test';
import path from 'path';
import { loadLocators, resolveLocator } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'selectApplicationPage.locators.json'));

/**
 * Home + Create New Application (live Firelight EGApp).
 * Locators live in selectApplicationPage.locators.json (heal updates that sidecar).
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
    await resolveLocator(this.page, registry.entries.jurisdiction, 30_000);
  }

  async selectJurisdiction(jurisdiction: string) {
    const field = await resolveLocator(this.page, registry.entries.jurisdiction);
    await field.selectOption({ label: jurisdiction });
  }

  async selectProduct(product: string) {
    const typeField = await resolveLocator(this.page, registry.entries.productType);
    if (await typeField.count()) {
      await typeField.selectOption({ label: 'All' }).catch(() => undefined);
    }
    await this.page.waitForTimeout(1000);
    const productLink = this.page.getByRole('link', { name: product });
    await productLink.first().waitFor({ timeout: 20_000 });
    await productLink.first().click();
    const createLink = await resolveLocator(this.page, registry.entries.create);
    await this.page
      .getByText(/Click 'Create' to proceed/i)
      .or(createLink)
      .first()
      .waitFor({ timeout: 30_000 });
    await createLink.scrollIntoViewIfNeeded().catch(() => undefined);
  }

  async confirmCreate(caseName: string) {
    await this.page.getByText(/Click 'Create' to proceed/i).waitFor({ timeout: 30_000 });
    const createLink = this.page.getByRole('link', { name: 'Create', exact: true });
    const nameBox = this.page.getByRole('textbox', { name: 'Name' });
    if (!(await nameBox.isVisible().catch(() => false))) {
      await createLink.click();
      await nameBox.waitFor({ timeout: 20_000 }).catch(async () => {
        await createLink.click({ force: true });
        await nameBox.waitFor({ timeout: 20_000 });
      });
    }

    await nameBox.fill(caseName);
    await this.page.getByRole('button', { name: 'Create' }).click({ noWaitAfter: true });
    await nameBox.waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);

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
