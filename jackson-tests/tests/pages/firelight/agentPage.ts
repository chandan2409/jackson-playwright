import { Page } from '@playwright/test';
import path from 'path';
import { selectByEntry, fillByEntry, clickByEntry } from '../../utils/form-helpers';
import { loadLocators } from '../../utils/locator-registry';

const registry = loadLocators(path.join(__dirname, 'agentPage.locators.json'));
const E = (key: string) => registry.entries[key];

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
    await selectByEntry(this.page, E('jacksonApprovedMaterials'), data.jacksonApprovedMaterials);
    await fillByEntry(this.page, E('firstName'), data.firstName);
    await fillByEntry(this.page, E('middleName'), data.middleName);
    await fillByEntry(this.page, E('lastName'), data.lastName);
    await fillByEntry(this.page, E('ssn'), data.ssn);
    await fillByEntry(this.page, E('commissionPct'), data.commissionPct);
    await fillByEntry(this.page, E('email'), data.email);
    await selectByEntry(this.page, E('commissionOption'), data.commissionOption);
  }

  async next() {
    await clickByEntry(this.page, E('next'));
  }
}
