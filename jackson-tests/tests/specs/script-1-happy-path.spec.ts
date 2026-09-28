import { test, expect } from '@playwright/test';
import { runFirelightWizard, happyPathData } from '../utils/wizard-flow';
import ENV from '../utils/env';

/**
 * Script 1 — Happy path
 * Source: Boun_POCtestcase.xlsx
 * Product: Elite Access II | Jurisdiction: Colorado | Case: Boun
 * Ends at Signing Process with Wet Signature.
 */
test.describe('Firelight POC — Script 1 Happy Path', () => {
  test.skip(!ENV.FIRELIGHT_USERNAME, 'Requires FIRELIGHT_USERNAME / PASSWORD (Day 0)');

  test('[FL-HP-001] @smoke @poc Elite Access II Colorado wizard completes to Wet Signature', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await runFirelightWizard(page, happyPathData);
    await expect(page.getByText(/wet signature|signing/i).first()).toBeVisible();
  });
});
