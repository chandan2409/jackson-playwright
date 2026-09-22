import { Page } from '@playwright/test';
import { selectByLabel, fillByLabel, clickNext } from '../../utils/form-helpers';
import { loadLocators, resolveLocator } from '../../utils/locator-registry';
import path from 'path';

// TEMPLATE: Replace <PageName>, fields, and locator sidecar entries.
const registry = loadLocators(path.join(__dirname, '<pageName>Page.locators.json'));

export class PageNamePage /* REPLACE: <PageName>Page */ {
  constructor(private page: Page) {}

  async fill(data: Record<string, string>) {
    // REPLACE: map each Firelight field
    // await fillByLabel(this.page, 'First Name', data.firstName);
    // await selectByLabel(this.page, 'Sex', data.sex);
    void data;
    void registry;
  }

  async next() {
    await clickNext(this.page);
  }

  async resolve(entryName: string) {
    return resolveLocator(this.page, (registry as any).entries[entryName]);
  }
}
