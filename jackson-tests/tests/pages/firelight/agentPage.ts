import { Page } from '@playwright/test';
import path from 'path';
import { selectByLabel, fillByLabel, clickNext } from '../../utils/form-helpers';
import { fieldLabel, loadLocators } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'agentPage.locators.json'));
const L = (key: string) => fieldLabel(registry.entries[key]);

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
    await selectByLabel(this.page, L('jacksonApprovedMaterials'), data.jacksonApprovedMaterials);
    await fillByLabel(this.page, L('firstName'), data.firstName);
    await fillByLabel(this.page, L('middleName'), data.middleName);
    await fillByLabel(this.page, L('lastName'), data.lastName);
    await fillByLabel(this.page, L('ssn'), data.ssn);
    await fillByLabel(this.page, L('commissionPct'), data.commissionPct);
    await fillByLabel(this.page, L('email'), data.email);
    await selectByLabel(this.page, L('commissionOption'), data.commissionOption);
  }

  async next() {
    await clickNext(this.page);
  }
}
