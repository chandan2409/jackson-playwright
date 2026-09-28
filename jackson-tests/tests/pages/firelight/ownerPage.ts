import { Page } from '@playwright/test';
import path from 'path';
import { selectByLabel, fillByLabel, clickNext } from '../../utils/form-helpers';
import { fieldLabel, loadLocators } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'ownerPage.locators.json'));
const L = (key: string) => fieldLabel(registry.entries[key]);

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
    await fillByLabel(this.page, L('firstName'), data.firstName);
    await fillByLabel(this.page, L('middleName'), data.middleName);
    await fillByLabel(this.page, L('lastName'), data.lastName);
    await fillByLabel(this.page, L('ssn'), data.ssn);
    await fillByLabel(this.page, L('dateOfBirth'), data.dateOfBirth);
    await selectByLabel(this.page, L('sex'), data.sex);
    await fillByLabel(this.page, L('address1'), data.address1);
    await fillByLabel(this.page, L('address2'), data.address2);
    await fillByLabel(this.page, L('city'), data.city);
    await selectByLabel(this.page, L('state'), data.state);
    await fillByLabel(this.page, L('zip'), data.zip);
    await fillByLabel(this.page, L('phone'), data.phone);
    await selectByLabel(this.page, L('mailingDifferent'), data.mailingDifferent);
    await selectByLabel(this.page, L('phoneTransferConsent'), data.phoneTransferConsent);
    await selectByLabel(this.page, L('eDeliveryConsent'), data.eDeliveryConsent);
    await fillByLabel(this.page, L('email'), data.email);
    await selectByLabel(this.page, L('authorizeOther'), data.authorizeOther);
    await selectByLabel(this.page, L('backupWithholding'), data.backupWithholding);
    await selectByLabel(this.page, L('activeMilitary'), data.activeMilitary);
    await selectByLabel(this.page, L('citizenship'), data.citizenship);
  }

  async next() {
    await clickNext(this.page);
  }
}
