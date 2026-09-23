import { Page } from '@playwright/test';
import { selectByLabel, fillByLabel, clickNext, clickControl } from '../../utils/form-helpers';

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
    await selectByLabel(
      this.page,
      'Is the beneficiary a living person or non-natural entity?',
      data.type,
    );
    await this.page.getByText('First Name', { exact: false }).first().waitFor({ timeout: 15_000 });
    await fillByLabel(this.page, 'First Name', data.firstName);
    await fillByLabel(this.page, 'Middle Name', data.middleName);
    await fillByLabel(this.page, 'Last Name', data.lastName);
    await fillByLabel(this.page, 'SSN', data.ssn);
    await fillByLabel(this.page, 'Date of Birth', data.dateOfBirth);
    await selectByLabel(this.page, 'Sex', data.sex);
    await selectByLabel(this.page, 'Relationship to Owner', data.relationship);
    await clickControl(this.page, 'Same As Owner');
    await fillByLabel(this.page, 'Proceeds', data.proceedsPct);
  }

  async addContingent(data: BeneficiaryData) {
    const add = this.page
      .getByRole('button', { name: /add beneficiary/i })
      .or(this.page.getByRole('link', { name: /add beneficiary/i }));
    if (!(await add.count())) {
      return;
    }
    await add.first().click();
    if (data.beneficiaryType) {
      await selectByLabel(this.page, 'Beneficiary Type', data.beneficiaryType, 'last');
    }
    await selectByLabel(
      this.page,
      'Is the beneficiary a living person or non-natural entity?',
      data.type,
      'last',
    );
    await fillByLabel(this.page, 'First Name', data.firstName, 'last');
    await fillByLabel(this.page, 'Middle Name', data.middleName, 'last');
    await fillByLabel(this.page, 'Last Name', data.lastName, 'last');
    await fillByLabel(this.page, 'SSN', data.ssn, 'last');
    await fillByLabel(this.page, 'Date of Birth', data.dateOfBirth, 'last');
    await selectByLabel(this.page, 'Sex', data.sex, 'last');
    await selectByLabel(this.page, 'Relationship to Owner', data.relationship, 'last');
    await clickControl(this.page, 'Same As Owner', 'last');
    await fillByLabel(this.page, 'Proceeds', data.proceedsPct, 'last');
  }

  async next() {
    await clickNext(this.page);
  }
}
