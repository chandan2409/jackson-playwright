import { test, expect } from '@playwright/test';
import { runFirelightWizard, variantPathData } from '../utils/wizard-flow';
import ENV from '../utils/env';

/**
 * Script 2 — Variant path (same Excel flow, alternate fixture).
 * Copied from spec-file.template.ts.
 */
test.describe('Firelight POC — Script 2 Variant Path', () => {
  test.skip(!ENV.FIRELIGHT_USERNAME, 'Requires FIRELIGHT_USERNAME / PASSWORD (Day 0)');

  test('[FL-VP-001] @smoke @poc Variant data path completes through Submit Application', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await runFirelightWizard(page, variantPathData);
    await expect(page.getByText(/SIGNATURES|FINALIZE|Submit for Review|Submit Application|signing|wet signature/i).first()).toBeVisible();
    expect(variantPathData.payment.amount).not.toEqual('50000');
    expect(variantPathData.primaryBeneficiary.proceedsPct).toBe('60');
  });
});
