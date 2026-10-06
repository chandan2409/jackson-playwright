import type { Page } from '@playwright/test';
import ENV from './env';

/** Re-login when storageState is expired. Script 1 always runs setup; detect/baseline do not. */
export async function ensureFirelightSession(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  const login = page.getByRole('heading', { name: 'Welcome Back!' });
  if (!(await login.isVisible().catch(() => false))) return;
  if (!ENV.FIRELIGHT_USERNAME || !ENV.FIRELIGHT_PASSWORD) {
    throw new Error('Firelight session expired. Run: cd jackson-tests && npm run auth:setup');
  }
  await page.getByRole('textbox').first().fill(ENV.FIRELIGHT_USERNAME);
  await page.locator('input[type="password"]').fill(ENV.FIRELIGHT_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(/\/EGApp\//, { timeout: 60_000, waitUntil: 'domcontentloaded' });
  await page.getByText(/start new|home|activity|jurisdiction/i).first().waitFor({ timeout: 30_000 });
}
