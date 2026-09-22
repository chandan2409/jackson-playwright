import { Page } from '@playwright/test';

/**
 * Label-first form helpers for Firelight wizard pages.
 * Prefer accessible names; fall back to nearby text when labels are custom widgets.
 */
export async function selectByLabel(page: Page, label: string, option: string): Promise<void> {
  const field = page.getByLabel(label, { exact: false });
  if (await field.count()) {
    const tag = await field.first().evaluate((el) => el.tagName.toLowerCase());
    if (tag === 'select') {
      await field.first().selectOption({ label: option });
      return;
    }
    await field.first().click();
    await page.getByRole('option', { name: option }).click();
    return;
  }

  // Fallback: click label text then choose option
  await page.getByText(label, { exact: false }).first().click();
  await page.getByText(option, { exact: true }).last().click();
}

export async function fillByLabel(page: Page, label: string, value: string): Promise<void> {
  const field = page.getByLabel(label, { exact: false });
  if (await field.count()) {
    await field.first().fill(value);
    return;
  }
  const row = page.getByText(label, { exact: false }).locator('xpath=ancestor::*[self::div or self::tr][1]');
  await row.locator('input, textarea').first().fill(value);
}

export async function clickNext(page: Page): Promise<void> {
  const next = page.getByRole('button', { name: /^next$/i }).or(page.getByText(/^next$/i));
  await next.first().click();
  await page.waitForLoadState('domcontentloaded');
}

export async function clickControl(page: Page, name: string): Promise<void> {
  const control = page.getByRole('button', { name }).or(page.getByText(name, { exact: false }));
  await control.first().click();
}
