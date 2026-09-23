import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';
import ENV from './env';

const ROOT = path.resolve(__dirname, '../..');
const SNAP_DIR = path.join(ROOT, 'tests/data/.snapshots');

async function extract(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll(
        'input, select, textarea, button, a, [role="button"], [role="combobox"], [role="option"], label',
      ),
    );
    return {
      url: location.href,
      title: document.title,
      heading: Array.from(document.querySelectorAll('h1,h2,h3,.page-title,[class*="title"]'))
        .slice(0, 20)
        .map((el) => (el.textContent || '').trim())
        .filter(Boolean),
      bodyText: (document.body.innerText || '').slice(0, 4000),
      elements: nodes.slice(0, 250).map((el, idx) => {
        const html = el as HTMLElement;
        const labelEl =
          (html.id && document.querySelector(`label[for="${html.id}"]`)) || html.closest('label');
        return {
          name: html.getAttribute('name') || html.id || `el_${idx}`,
          tag: html.tagName.toLowerCase(),
          type: html.getAttribute('type'),
          id: html.id || null,
          testId: html.getAttribute('data-testid'),
          nameAttr: html.getAttribute('name'),
          aria: html.getAttribute('aria-label'),
          placeholder: html.getAttribute('placeholder'),
          text: (html.innerText || html.textContent || '').trim().slice(0, 160),
          label: labelEl?.textContent?.trim() || null,
          classes: Array.from(html.classList).slice(0, 12),
        };
      }),
    };
  });
}

async function main() {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  if (!ENV.FIRELIGHT_USERNAME || !ENV.FIRELIGHT_PASSWORD) {
    console.error('Missing credentials');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(ENV.FIRELIGHT_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('heading', { name: 'Welcome Back!' }).waitFor({ timeout: 30_000 });
  await page.getByRole('textbox').first().fill(ENV.FIRELIGHT_USERNAME);
  await page.locator('input[type="password"]').fill(ENV.FIRELIGHT_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();

  try {
    await page.waitForURL(/\/EGApp\//, { timeout: 45_000 });
  } catch {
    const loginSnap = await extract(page);
    fs.writeFileSync(path.join(SNAP_DIR, 'login-failed.json'), JSON.stringify(loginSnap, null, 2));
    await page.screenshot({ path: path.join(SNAP_DIR, 'login-failed.png'), fullPage: true });
    await browser.close();
    console.error('LOGIN_FAILED url=' + page.url());
    process.exit(2);
  }

  await page.waitForTimeout(2000);
  const home = await extract(page);
  fs.writeFileSync(path.join(SNAP_DIR, 'post-login.json'), JSON.stringify(home, null, 2));
  await page.screenshot({ path: path.join(SNAP_DIR, 'post-login.png'), fullPage: true });
  console.log('LOGIN_OK url=' + page.url());
  console.log('headings=' + JSON.stringify(home.heading.slice(0, 10)));

  const startApp = page.locator('#startNew__103');
  if (await startApp.count()) {
    await startApp.click({ timeout: 15_000 });
    await page.waitForTimeout(4000);
    const app = await extract(page);
    fs.writeFileSync(path.join(SNAP_DIR, 'start-application.json'), JSON.stringify(app, null, 2));
    await page.screenshot({ path: path.join(SNAP_DIR, 'start-application.png'), fullPage: true });
    console.log('APP_PAGE url=' + page.url());
    console.log('app_headings=' + JSON.stringify(app.heading.slice(0, 15)));
    console.log('app_text=' + app.bodyText.slice(0, 800).replace(/\s+/g, ' '));

    const jurisdiction = page.locator('#Jurisdiction');
    if (await jurisdiction.count()) {
      await jurisdiction.selectOption({ label: 'Colorado' });
      await page.waitForTimeout(3000);
      const afterState = await extract(page);
      fs.writeFileSync(
        path.join(SNAP_DIR, 'select-colorado.json'),
        JSON.stringify(afterState, null, 2),
      );
      await page.screenshot({
        path: path.join(SNAP_DIR, 'select-colorado.png'),
        fullPage: true,
      });
      console.log('COLORADO_TEXT=' + afterState.bodyText.slice(0, 1200).replace(/\s+/g, ' '));
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
