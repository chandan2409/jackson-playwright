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
    await fillByLabel(this.page, 'First Name', data.firstName);
    await fillByLabel(this.page, 'Middle Name', data.middleName);
    await fillByLabel(this.page, 'Last Name', data.lastName);
    await fillByLabel(this.page, 'SSN', data.ssn);
    await fillByLabel(this.page, 'Date of Birth', data.dateOfBirth);
    await selectByLabel(this.page, 'Sex', data.sex);
    await selectByLabel(this.page, 'Relationship to Owner', data.relationship);
    await clickControl(this.page, 'Same_As_Owner6');
    await fillByLabel(this.page, 'Proceeds %', data.proceedsPct);
  }

  async addContingent(data: BeneficiaryData) {
    await clickControl(this.page, 'Add_Beneficiary_Method');
    if (data.beneficiaryType) {
      await selectByLabel(this.page, 'Beneficiary Type', data.beneficiaryType);
    }
    await selectByLabel(
      this.page,
      'Is the beneficiary a living person or non-natural entity?',
      data.type,
    );
    await fillByLabel(this.page, 'First Name', data.firstName);
    await fillByLabel(this.page, 'Middle Name', data.middleName);
    await fillByLabel(this.page, 'Last Name', data.lastName);
    await fillByLabel(this.page, 'SSN', data.ssn);
    await fillByLabel(this.page, 'Date of Birth', data.dateOfBirth);
    await selectByLabel(this.page, 'Sex', data.sex);
    await selectByLabel(this.page, 'Relationship to Owner', data.relationship);
    await clickControl(this.page, 'Same_As_Owner7');
    await fillByLabel(this.page, 'Proceeds %', data.proceedsPct);
  }

  async next() {
    await clickNext(this.page);
  }
}
