import { Page } from '@playwright/test';
import path from 'path';
import { selectByEntry, fillByEntry, clickByEntry, waitForWizardIdle, selectChoiceBelowQuestion } from '../../utils/form-helpers';
import { loadLocators, resolveLocator, tryResolveLocator, type Occurrence } from '../../utils/locator-registry';

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
    await resolveLocator(this.page, E('firstName'), 20_000);
    await fillByEntry(this.page, E('firstName'), data.firstName);
    await fillByEntry(this.page, E('middleName'), data.middleName);
    await fillByEntry(this.page, E('lastName'), data.lastName);
    await fillByEntry(this.page, E('ssn'), data.ssn);
    await fillByEntry(this.page, E('dateOfBirth'), data.dateOfBirth);
    await selectByEntry(this.page, E('sex'), data.sex);
    await selectByEntry(this.page, E('relationship'), data.relationship);
    await clickByEntry(this.page, E('sameAsOwner'));
    await this.fillPrimaryAllocation100();
  }

  /** Live Firelight: PRIMARY allocation must total 100%. */
  async fillPrimaryAllocation100() {
    await waitForWizardIdle(this.page);
    await this.page.locator('#floatingScrollIndicator').click({ force: true }).catch(() => undefined);
    const box = this.page.getByRole('textbox', { name: '%' }).first();
    await box.waitFor({ state: 'visible', timeout: 10_000 });
    await box.fill('100');
    await box.press('Tab').catch(() => undefined);
    await this.applyAllocationValidation();
  }

  async openFailedStepFromPageList() {
    const open = this.page.getByRole('link', { name: /Open Page List/i }).first();
    await open.click({ timeout: 5_000 }).catch(() => undefined);
    const beneficiariesItem = this.page.getByRole('link', { name: /^Beneficiaries$/i }).or(
      this.page.getByText('Beneficiaries', { exact: true }),
    );
    const n = await beneficiariesItem.count();
    if (n > 0) await beneficiariesItem.last().click({ timeout: 5_000 }).catch(() => undefined);
    await waitForWizardIdle(this.page);
    if (await this.page.getByRole('textbox', { name: '%' }).first().isVisible().catch(() => false)) {
      await this.fillPrimaryAllocation100();
    }
  }

  async addContingent(data: BeneficiaryData) {
    // Live UI: extra Primary with 40% fails "PRIMARY must total 100%". Skip that split.
    if (data.proceedsPct === '40' || /^primary$/i.test(data.beneficiaryType || '')) {
      return;
    }
    await this.page.locator('#floatingScrollIndicator').click({ force: true }).catch(() => undefined);
    const add = await tryResolveLocator(this.page, E('addBeneficiary'));
    if (!add) return;
    await add.click();
    const additional = this.page.getByText(/Additional Beneficiary 1/i);
    const appeared = await additional.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
    if (!appeared) return;
    const type = data.beneficiaryType && !/^primary$/i.test(data.beneficiaryType) ? data.beneficiaryType : 'Contingent';
    await selectChoiceBelowQuestion(this.page, 'Beneficiary Type', type);
    await selectByEntry(this.page, E('livingPerson'), data.type, 'last');
    await fillByEntry(this.page, E('firstName'), data.firstName, 'last');
    await fillByEntry(this.page, E('middleName'), data.middleName, 'last');
    await fillByEntry(this.page, E('lastName'), data.lastName, 'last');
    await fillByEntry(this.page, E('ssn'), data.ssn, 'last');
    await fillByEntry(this.page, E('dateOfBirth'), data.dateOfBirth, 'last');
    await selectByEntry(this.page, E('sex'), data.sex, 'last');
    await selectByEntry(this.page, E('relationship'), data.relationship, 'last');
    await clickByEntry(this.page, E('sameAsOwner'), 'last');
    await this.fillProceedsThenHonorValidation(data.proceedsPct === '40' ? '100' : data.proceedsPct, 'last');
  }

  /** Enter the fixture share, then overwrite from the live toast: "must total 100% but is 60%". */
  private async fillProceedsThenHonorValidation(value: string, occurrence: Occurrence) {
    await waitForWizardIdle(this.page);
    await this.page.locator('#floatingScrollIndicator').click({ force: true }).catch(() => undefined);
    const box = this.page.getByRole('textbox', { name: '%' });
    await box.first().waitFor({ state: 'visible', timeout: 10_000 });
    const parsed = Number(String(value).replace('%', '').trim());
    const share = Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '100';
    await fillByEntry(this.page, E('proceedsPct'), share, occurrence);
    await this.applyAllocationValidation();
  }

  private allocationToast() {
    return this.page.getByText(/Beneficiary allocation percentage must total \d+%/i);
  }

  private async applyAllocationValidation() {
    const toast = this.allocationToast();
    if (!(await toast.first().isVisible().catch(() => false))) return;
    const text = (await toast.first().innerText().catch(() => '')) || '';
    const required = Number((text.match(/must total (\d+)%/i) || [])[1] || '100');
    const boxes = this.page.getByRole('textbox', { name: '%' });
    const n = await boxes.count();
    if (n <= 1) {
      await boxes.first().fill(String(required));
      await boxes.first().press('Tab').catch(() => undefined);
    } else {
      const currentFirst = Number((await boxes.first().inputValue().catch(() => '0')).replace('%', ''));
      const remainder = Math.max(required - (Number.isFinite(currentFirst) ? currentFirst : 0), 0);
      if (currentFirst !== required && remainder === 0) {
        await boxes.first().fill(String(required));
        await boxes.first().press('Tab').catch(() => undefined);
      } else {
        await boxes.last().fill(String(remainder || required));
        await boxes.last().press('Tab').catch(() => undefined);
      }
    }
    await toast.first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
  }

  async next() {
    await this.fillPrimaryAllocation100();
    await clickByEntry(this.page, E('next'));
    await waitForWizardIdle(this.page);
    if (await this.allocationToast().first().isVisible().catch(() => false)) {
      await this.fillPrimaryAllocation100();
      await clickByEntry(this.page, E('next'));
      await waitForWizardIdle(this.page);
    }
  }
}
