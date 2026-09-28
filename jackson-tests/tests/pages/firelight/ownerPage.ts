import { Page } from '@playwright/test';
import path from 'path';
import { fillByEntry, selectByEntry, clickByEntry } from '../../utils/form-helpers';
import { loadLocators } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'ownerPage.locators.json'));
const E = (key: string) => registry.entries[key];

export type OwnerData = {
  firstName: string;
  middleName: string;
  lastName: string;
  ssn: string;
  dateOfBirth: string;
  sex: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  mailingDifferent: string;
  phoneTransferConsent: string;
  eDeliveryConsent: string;
  email: string;
  authorizeOther: string;
  backupWithholding: string;
  activeMilitary: string;
  citizenship: string;
};

export class OwnerPage {
  constructor(private page: Page) {}

  async fill(data: OwnerData) {
    await fillByEntry(this.page, E('firstName'), data.firstName);
    await fillByEntry(this.page, E('middleName'), data.middleName);
    await fillByEntry(this.page, E('lastName'), data.lastName);
    await fillByEntry(this.page, E('ssn'), data.ssn);
    await fillByEntry(this.page, E('dateOfBirth'), data.dateOfBirth);
    await selectByEntry(this.page, E('sex'), data.sex);
    await fillByEntry(this.page, E('address1'), data.address1);
    await fillByEntry(this.page, E('address2'), data.address2);
    await fillByEntry(this.page, E('city'), data.city);
    await selectByEntry(this.page, E('state'), data.state);
    await fillByEntry(this.page, E('zip'), data.zip);
    await fillByEntry(this.page, E('phone'), data.phone);
    await selectByEntry(this.page, E('mailingDifferent'), data.mailingDifferent);
    await selectByEntry(this.page, E('phoneTransferConsent'), data.phoneTransferConsent);
    await selectByEntry(this.page, E('eDeliveryConsent'), data.eDeliveryConsent);
    await fillByEntry(this.page, E('email'), data.email);
    await selectByEntry(this.page, E('authorizeOther'), data.authorizeOther);
    await selectByEntry(this.page, E('backupWithholding'), data.backupWithholding);
    await selectByEntry(this.page, E('activeMilitary'), data.activeMilitary);
    await selectByEntry(this.page, E('citizenship'), data.citizenship);
  }

  async next() {
    await clickByEntry(this.page, E('next'));
  }
}
