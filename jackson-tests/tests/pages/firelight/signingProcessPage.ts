import { Page, expect } from '@playwright/test';
import path from 'path';
import { clickByEntry } from '../../utils/form-helpers';
import { wizardScope } from '../../utils/wizard-scope';
import { loadLocators, resolveLocator, tryResolveLocator } from '../../utils/locator-registry';
import { BeneficiariesPage } from './beneficiariesPage';

const registry = loadLocators(path.join(__dirname, 'signingProcessPage.locators.json'));
const E = (key: string) => registry.entries[key];

export const WET_SIGNATURE_PDF = path.resolve(__dirname, '../../data/fixtures/wet-signature.pdf');

export class SigningProcessPage {
  constructor(private page: Page) {}

  async selectSigningMethod(method: string) {
    const choice = this.page.getByRole('checkbox', { name: method, exact: true });
    await choice.waitFor({ state: 'visible', timeout: 20_000 });
    await choice.click({ force: true });
    if ((await choice.getAttribute('aria-checked')) !== 'true') {
      await choice.evaluate((el) => (el as HTMLElement).click());
    }
  }

  async assertDataEntryComplete() {
    await this.dismissWetSignatureNotice();
    if (!(await this.page.getByText('100%', { exact: true }).first().isVisible().catch(() => false))) {
      const beneficiaries = new BeneficiariesPage(this.page);
      await beneficiaries.openFailedStepFromPageList();
      await this.page.getByRole('link', { name: /Open Page List/i }).first().click().catch(() => undefined);
      const signingItem = this.page.getByRole('link', { name: /Signing Process/i }).or(
        this.page.getByText('Signing Process', { exact: true }),
      );
      await signingItem.last().click({ timeout: 5_000 }).catch(() => undefined);
    }
    await this.selectSigningMethod('Wet Signature');
    await this.dismissWetSignatureNotice();
    await expect(this.page.getByRole('checkbox', { name: /Wet Signature/i })).toBeChecked({
      timeout: 15_000,
    });
    await expect(this.page.getByText('100%', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  }

  async dismissWetSignatureNotice() {
    const toast = this.page.getByText(/If you are collecting a wet signature/i);
    if (!(await toast.isVisible().catch(() => false))) return;
    const close = this.page
      .getByRole('link', { name: 'Close', exact: true })
      .or(this.page.getByRole('button', { name: 'Close', exact: true }));
    await close.last().click({ force: true });
    await toast.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  }

  /** Open Select Documents to Print, print selected, keep a download when Firelight offers one. */
  async printDocumentsIfPresent(): Promise<string | null> {
    const print = await tryResolveLocator(this.page, E('print'));
    if (!print) return null;
    const downloadPromise = this.page.waitForEvent('download', { timeout: 20_000 }).catch(() => null);
    await print.click();
    const printDialog = this.page.getByRole('dialog', { name: /Select Documents to Print/i });
    await printDialog.waitFor({ state: 'visible', timeout: 15_000 });
    const checkAll = printDialog.getByRole('checkbox').first();
    await checkAll.check({ force: true });
    const printSelected = printDialog.getByRole('button', { name: 'Print Selected Documents' });
    await expect(printSelected).toBeEnabled({ timeout: 15_000 });
    await printSelected.click();
    const download = await downloadPromise;
    await printDialog.waitFor({ state: 'hidden', timeout: 20_000 }).catch(async () => {
      await printDialog.getByRole('button', { name: 'Close' }).click().catch(() => undefined);
    });
    if (download) {
      const dest = path.join(process.cwd(), 'test-results', `wet-print-${Date.now()}.pdf`);
      await download.saveAs(dest).catch(() => undefined);
      return dest;
    }
    return null;
  }

  async attachPrintedDocuments(pdfPath: string) {
    const attach = await resolveLocator(this.page, E('attach'), 20_000);
    const chooserPromise = this.page.waitForEvent('filechooser', { timeout: 10_000 }).catch(() => null);
    await attach.click();
    const chooser = await chooserPromise;
    if (chooser) {
      await chooser.setFiles(pdfPath);
    } else {
      const fileInput = this.page.locator('input[type="file"]').first();
      await fileInput.waitFor({ state: 'attached', timeout: 10_000 });
      await fileInput.setInputFiles(pdfPath);
    }
    const finish = this.page.getByRole('button', { name: /Upload|Save|Done|OK|Attach/i }).first();
    const finishVisible = await finish.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false);
    if (finishVisible) await finish.click().catch(() => undefined);
    await this.page.waitForTimeout(1_500);
  }

  async continueToSignatures() {
    const continueBtn = await resolveLocator(this.page, E('continue'), 60_000);
    await expect(continueBtn).toBeEnabled({ timeout: 60_000 });
    await clickByEntry(this.page, E('continue'));
  }

  async submitForReview() {
    await this.dismissWetSignatureNotice();
    const yes = this.page.getByRole('button', { name: 'Yes', exact: true });
    const submit = await resolveLocator(this.page, E('submitForReview'), 20_000);
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    await submit.click();
    await yes.waitFor({ state: 'visible', timeout: 20_000 });
    await yes.click();
    await yes.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);
  }

  async assertOnSigningPage() {
    const scope = await wizardScope(this.page);
    await expect(scope.getByText(/signing|signature/i).first()).toBeVisible({ timeout: 30_000 });
  }
}
