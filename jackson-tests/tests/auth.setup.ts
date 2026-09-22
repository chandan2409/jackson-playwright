import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import ENV from './utils/env';

const authFile = path.resolve(__dirname, '../.auth/firelight-state.json');

/**
 * Day 0 auth setup. Logs into Firelight FLQANEXT once and persists storageState.
 * Wire the real login selectors once sandbox credentials + URL are confirmed.
 */
setup('authenticate to Firelight', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  if (!ENV.FIRELIGHT_USERNAME || !ENV.FIRELIGHT_PASSWORD) {
    // Allow offline scaffold: write empty state so chromium project can load.
    fs.writeFileSync(
      authFile,
      JSON.stringify({ cookies: [], origins: [] }, null, 2),
    );
    setup.skip(true, 'FIRELIGHT_USERNAME / FIRELIGHT_PASSWORD not set — skipping live login');
    return;
  }

  await page.goto(ENV.FIRELIGHT_BASE_URL);
  await page.waitForLoadState('domcontentloaded');

  // PLACEHOLDER: replace with live Firelight login field selectors after Day 0 access
  const user = page.getByLabel(/user(name)?|email/i).or(page.locator('input[type="text"], input[name*="user" i]').first());
  const pass = page.getByLabel(/password/i).or(page.locator('input[type="password"]').first());
  const submit = page.getByRole('button', { name: /sign in|log in|login|submit/i });

  await user.fill(ENV.FIRELIGHT_USERNAME);
  await pass.fill(ENV.FIRELIGHT_PASSWORD);
  await submit.click();
  await page.waitForLoadState('networkidle');

  await expect(page).not.toHaveURL(/login|signin/i);
  await page.context().storageState({ path: authFile });
});
