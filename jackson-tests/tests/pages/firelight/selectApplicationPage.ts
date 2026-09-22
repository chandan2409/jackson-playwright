import { Page } from '@playwright/test';
import { selectByLabel, fillByLabel, clickNext, clickControl } from '../../utils/form-helpers';
import { loadLocators, resolveLocator } from '../../utils/locator-registry';
import path from 'path';

const registry = loadLocators(path.join(__dirname, 'selectApplicationPage.locators.json'));

export class SelectApplicationPage {
  constructor(private page: Page) {}

  async goto(baseUrl: string) {
    await this.page.goto(baseUrl);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async selectJurisdiction(jurisdiction: string) {
    await selectByLabel(this.page, 'Jurisdiction', jurisdiction);
  }

  async selectProduct(product: string) {
    await selectByLabel(this.page, 'Product', product);
  }

  async nameCase(caseName: string) {
    await fillByLabel(this.page, 'Case', caseName);
  }

  async startApplication() {
    const start = await resolveLocator(this.page, registry.entries.startApplication);
    await start.click();
  }
}
