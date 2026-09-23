import { Page, Frame, FrameLocator } from '@playwright/test';

export type FormScope = Page | Frame | FrameLocator;

/**
 * Wizard data-entry is on the top page (EditWizardApplication).
 * Fall back to iframes only if they exist.
 */
export async function wizardScope(page: Page): Promise<FormScope> {
  await page
    .getByText(/New Application Information|DATA ENTRY|Please select the type of ownership/i)
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => undefined);

  const iframeCount = await page.locator('iframe').count();
  if (iframeCount === 0) {
    return page;
  }

  const hints = /Ownership|Annuitant|Tax Qualification|First Name|Beneficiary|Wet Signature/i;
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      if (await frame.getByText(hints).count()) {
        return frame;
      }
    } catch {
      // ignore
    }
  }
  return page;
}
