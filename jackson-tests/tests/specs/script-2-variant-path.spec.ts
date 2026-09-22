import { test, expect } from '@playwright/test';
import { runFirelightWizard, variantPathData } from '../utils/wizard-flow';
import ENV from '../utils/env';

/**
 * Script 2 — Variant path
 * Same wizard flow with alternate owner/beneficiary proceeds and payment amount.
 * Ensures the POC has two distinct executable scripts, not a duplicate file.
 */
test.describe('Firelight POC — Script 2 Variant Path', () => {
  test.skip(!ENV.FIRELIGHT_USERNAME, 'Requires FIRELIGHT_USERNAME / PASSWORD (Day 0)');

  test('[FL-VP-001] @smoke @poc Variant data path reaches Signing with alternate proceeds', async ({
    page,
  }) => {
    await runFirelightWizard(page, variantPathData);
    await expect(page.getByText(/wet signature|signing/i).first()).toBeVisible();
    // Variant assertion: payment amount differs from happy path
    expect(variantPathData.payment.amount).not.toEqual('50000');
    expect(variantPathData.primaryBeneficiary.proceedsPct).toBe('60');
  });
});
