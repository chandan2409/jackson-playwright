import { test, expect } from '@playwright/test';
import { runFirelightWizard, happyPathData } from '../utils/wizard-flow';
import ENV from '../utils/env';

// TEMPLATE — copy to jackson-tests/tests/specs/script-1-happy-path.spec.ts
// or script-2-variant-path.spec.ts (swap happyPathData → variantPathData, FL-HP-001 → FL-VP-001).

test.describe('Firelight POC — <Script Name>', () => {
  test.skip(!ENV.FIRELIGHT_USERNAME, 'Requires FIRELIGHT_USERNAME / PASSWORD (Day 0)');

  test('[FL-HP-001] @smoke @poc <scenario title>', async ({ page }) => {
    test.setTimeout(180_000);
    await runFirelightWizard(page, happyPathData);
    await expect(page.getByText(/signing|wet signature/i).first()).toBeVisible();
  });
});
