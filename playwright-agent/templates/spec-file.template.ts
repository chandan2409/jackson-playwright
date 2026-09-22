import { test, expect } from '@playwright/test';
import { runFirelightWizard, happyPathData } from '../utils/wizard-flow';
import ENV from '../utils/env';

// TEMPLATE: Firelight POC script skeleton.
// Replace script id, fixture, and assertions.

test.describe('Firelight POC — <Script Name>', () => {
  test.skip(!ENV.FIRELIGHT_USERNAME, 'Requires FIRELIGHT_USERNAME / PASSWORD (Day 0)');

  test('[FL-XX-001] @smoke @poc <scenario title>', async ({ page }) => {
    await runFirelightWizard(page, happyPathData /* REPLACE: variantPathData */);
    await expect(page.getByText(/signing|wet signature/i).first()).toBeVisible();
  });
});
