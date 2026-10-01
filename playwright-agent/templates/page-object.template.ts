import { Page } from '@playwright/test';
import path from 'path';
import { fillByEntry, selectByEntry, clickByEntry } from '../../utils/form-helpers';
import { loadLocators } from '../../utils/locator-registry';

// TEMPLATE — copy to jackson-tests/tests/pages/firelight/<pageName>Page.ts
// Replace PageName / OwnerData / field keys. Do not call fillByLabel for wizard fields;
// heal must be able to patch *.locators.json without editing this class.
// App Info / Systematic already use selectChoiceBelowQuestion for question-scoped radios;
// do not copy that helper here unless live Firelight checkboxes ignore *ByEntry.

const registry = loadLocators(path.join(__dirname, '<pageName>Page.locators.json'));
const E = (key: string) => registry.entries[key];

export type PageNameData = {
  firstName: string;
  // REPLACE: remaining fixture keys for this page
};

export class PageNamePage {
  constructor(private page: Page) {}

  async fill(data: PageNameData) {
    await fillByEntry(this.page, E('firstName'), data.firstName);
    // await selectByEntry(this.page, E('sex'), data.sex);
    // await clickByEntry(this.page, E('sameAsOwner'));
  }

  async next() {
    await clickByEntry(this.page, E('next'));
  }
}
