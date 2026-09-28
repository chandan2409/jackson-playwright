import { Page } from '@playwright/test';
import path from 'path';
import { selectByLabel, fillByLabel, clickNext, clickControl } from '../../utils/form-helpers';
import { fieldLabel, loadLocators, resolveLocator } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'beneficiariesPage.locators.json'));
const L = (key: string) => fieldLabel(registry.entries[key]);

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
    await selectByLabel(this.page, L('livingPerson'), data.type);
    await this.page.getByText(L('firstName'), { exact: false }).first().waitFor({ timeout: 15_000 });
    await fillByLabel(this.page, L('firstName'), data.firstName);
    await fillByLabel(this.page, L('middleName'), data.middleName);
    await fillByLabel(this.page, L('lastName'), data.lastName);
    await fillByLabel(this.page, L('ssn'), data.ssn);
    await fillByLabel(this.page, L('dateOfBirth'), data.dateOfBirth);
    await selectByLabel(this.page, L('sex'), data.sex);
    await selectByLabel(this.page, L('relationship'), data.relationship);
    await clickControl(this.page, L('sameAsOwner'));
    await fillByLabel(this.page, L('proceedsPct'), data.proceedsPct);
  }

  async addContingent(data: BeneficiaryData) {
    let add;
    try {
      add = await resolveLocator(this.page, registry.entries.addBeneficiary);
    } catch {
      return;
    }
    if (!(await add.count())) {
      return;
    }
    await add.first().click();
    if (data.beneficiaryType) {
      await selectByLabel(this.page, L('beneficiaryType'), data.beneficiaryType, 'last');
    }
    await selectByLabel(this.page, L('livingPerson'), data.type, 'last');
    await fillByLabel(this.page, L('firstName'), data.firstName, 'last');
    await fillByLabel(this.page, L('middleName'), data.middleName, 'last');
    await fillByLabel(this.page, L('lastName'), data.lastName, 'last');
    await fillByLabel(this.page, L('ssn'), data.ssn, 'last');
    await fillByLabel(this.page, L('dateOfBirth'), data.dateOfBirth, 'last');
    await selectByLabel(this.page, L('sex'), data.sex, 'last');
    await selectByLabel(this.page, L('relationship'), data.relationship, 'last');
    await clickControl(this.page, L('sameAsOwner'), 'last');
    await fillByLabel(this.page, L('proceedsPct'), data.proceedsPct, 'last');
  }

  async next() {
    await clickNext(this.page);
  }
}
