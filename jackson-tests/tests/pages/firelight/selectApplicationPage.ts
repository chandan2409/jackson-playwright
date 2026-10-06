import { Frame, Page } from '@playwright/test';
import path from 'path';
import { loadLocators, resolveLocator } from '../../utils/locator-registry';
import { ensureFirelightSession } from '../../utils/firelight-session';

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
    await ensureFirelightSession(this.page);
  }

  async startApplication() {
    const jurisdiction = this.page.getByRole('combobox', { name: 'Jurisdiction' });
    if (await jurisdiction.isVisible().catch(() => false)) return;

    await this.page.getByText('Start New', { exact: true }).waitFor({ timeout: 20_000 });
    const clicked = await this.clickStartNewApplication();
    if (!clicked) {
      throw new Error(
        'Firelight home is visible (Start New) but Application was not clickable. See tests/reports/changes/evidence/detect-walk-failed.png',
      );
    }
    await resolveLocator(this.page, registry.entries.jurisdiction, 30_000);
  }

  /** Home tile is a labeled row, not a link/button in the a11y tree. Search frames too. */
  private async clickStartNewApplication(): Promise<boolean> {
    const tryHost = async (host: Page | Frame): Promise<boolean> => {
      const tiles = [
        host.getByText('Application', { exact: true }),
        host.getByRole('link', { name: 'Application', exact: true }),
        host.getByRole('button', { name: 'Application', exact: true }),
        host.getByRole('row', { name: 'Application', exact: true }),
      ];
      for (const loc of tiles) {
        const n = await loc.count().catch(() => 0);
        for (let i = 0; i < n; i++) {
          const el = loc.nth(i);
          if (!(await el.isVisible().catch(() => false))) continue;
          await el.click();
          return true;
        }
      }
      return false;
    };

    if (await tryHost(this.page)) return true;
    for (const frame of this.page.frames()) {
      if (frame === this.page.mainFrame()) continue;
      if (await tryHost(frame)) return true;
    }
    return false;
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
