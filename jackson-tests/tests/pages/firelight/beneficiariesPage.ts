import { Page } from '@playwright/test';
import path from 'path';
import { selectByEntry, fillByEntry, clickByEntry } from '../../utils/form-helpers';
import { loadLocators, resolveLocator } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'beneficiariesPage.locators.json'));
const E = (key: string) => registry.entries[key];

export type BeneficiaryData = {
  type: string;
  firstName: string;
  middleName: string;
  lastName: string;
  ssn: string;
  dateOfBirth: string;
  sex: string;
  relationship: string;
  proceedsPct: string;
  beneficiaryType?: string;
};

export class BeneficiariesPage {
  constructor(private page: Page) {}

  async fillPrimary(data: BeneficiaryData) {
    await selectByEntry(this.page, E('livingPerson'), data.type);
    await fillByEntry(this.page, E('firstName'), data.firstName);
    await fillByEntry(this.page, E('middleName'), data.middleName);
    await fillByEntry(this.page, E('lastName'), data.lastName);
    await fillByEntry(this.page, E('ssn'), data.ssn);
    await fillByEntry(this.page, E('dateOfBirth'), data.dateOfBirth);
    await selectByEntry(this.page, E('sex'), data.sex);
    await selectByEntry(this.page, E('relationship'), data.relationship);
    await clickByEntry(this.page, E('sameAsOwner'));
    await fillByEntry(this.page, E('proceedsPct'), data.proceedsPct);
  }

  async addContingent(data: BeneficiaryData) {
    try {
      await resolveLocator(this.page, E('addBeneficiary'), 5_000);
    } catch {
      return;
    }
    await clickByEntry(this.page, E('addBeneficiary'));
    if (data.beneficiaryType) {
      await selectByEntry(this.page, E('beneficiaryType'), data.beneficiaryType, 'last');
    }
    await selectByEntry(this.page, E('livingPerson'), data.type, 'last');
    await fillByEntry(this.page, E('firstName'), data.firstName, 'last');
    await fillByEntry(this.page, E('middleName'), data.middleName, 'last');
    await fillByEntry(this.page, E('lastName'), data.lastName, 'last');
    await fillByEntry(this.page, E('ssn'), data.ssn, 'last');
    await fillByEntry(this.page, E('dateOfBirth'), data.dateOfBirth, 'last');
    await selectByEntry(this.page, E('sex'), data.sex, 'last');
    await selectByEntry(this.page, E('relationship'), data.relationship, 'last');
    await clickByEntry(this.page, E('sameAsOwner'), 'last');
    await fillByEntry(this.page, E('proceedsPct'), data.proceedsPct, 'last');
  }

  async next() {
    await clickByEntry(this.page, E('next'));
  }
}
