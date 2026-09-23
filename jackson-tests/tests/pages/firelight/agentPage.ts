import { Page } from '@playwright/test';
import { selectByLabel, fillByLabel, clickNext } from '../../utils/form-helpers';

export type AgentData = {
  jacksonApprovedMaterials: string;
  firstName: string;
  middleName: string;
  lastName: string;
  ssn: string;
  commissionPct: string;
  email: string;
  commissionOption: string;
};

export class AgentPage {
  constructor(private page: Page) {}

  async fill(data: AgentData) {
    await selectByLabel(
      this.page,
      'Did the agent use only Jackson-approved sales material',
      data.jacksonApprovedMaterials,
    );
    await fillByLabel(this.page, 'First Name', data.firstName);
    await fillByLabel(this.page, 'Middle Name', data.middleName);
    await fillByLabel(this.page, 'Last Name', data.lastName);
    await fillByLabel(this.page, 'SSN', data.ssn);
    await fillByLabel(this.page, 'Commission', data.commissionPct);
    await fillByLabel(this.page, 'Email', data.email);
    await selectByLabel(this.page, 'Commission Option', data.commissionOption);
  }

  async next() {
    await clickNext(this.page);
  }
}
