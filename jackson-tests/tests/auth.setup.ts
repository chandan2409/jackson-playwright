import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import ENV from './utils/env';

const authFile = path.resolve(__dirname, '../.auth/firelight-state.json');

/**
 * Logs into Firelight FLQANEXT (Hexure STS) and persists storageState.
 * App: https://flqanext.insurancetechnologies.com/EGApp/
 * Login redirects to /EGSTS/login.aspx
 */
setup('authenticate to Firelight', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  if (!ENV.FIRELIGHT_USERNAME || !ENV.FIRELIGHT_PASSWORD) {
    fs.writeFileSync(
      authFile,
      JSON.stringify({ cookies: [], origins: [] }, null, 2),
    );
    setup.skip(true, 'FIRELIGHT_USERNAME / FIRELIGHT_PASSWORD not set — skipping live login');
    return;
  }

  await page.goto(ENV.FIRELIGHT_BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: 'Welcome Back!' })).toBeVisible();

  await page.getByRole('textbox').first().fill(ENV.FIRELIGHT_USERNAME);
  await page.locator('input[type="password"]').fill(ENV.FIRELIGHT_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();

  await page.waitForURL(/\/EGApp\//, { timeout: 60_000, waitUntil: 'domcontentloaded' });
  await expect(page).not.toHaveURL(/login\.aspx/i);
  await page.getByText(/start new|home|activity/i).first().waitFor({ timeout: 30_000 }).catch(() => undefined);
  await page.context().storageState({ path: authFile });
});
