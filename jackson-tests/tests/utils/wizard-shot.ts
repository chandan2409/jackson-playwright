import type { Page } from '@playwright/test';

/** Firelight clips the wizard in a ~400px scroller, so fullPage viewport shots miss lower fields. */
export async function expandWizardForScreenshot(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('.ITWizardRoot, .ITWizardRootDefault, .eAppPanelContainer').forEach((el) => {
      const node = el as HTMLElement;
      node.style.maxHeight = 'none';
      node.style.height = 'auto';
      node.style.overflow = 'visible';
    });
  });
}

export async function screenshotWizard(page: Page, filePath: string): Promise<void> {
  await expandWizardForScreenshot(page);
  await page.screenshot({ path: filePath, fullPage: true });
}
