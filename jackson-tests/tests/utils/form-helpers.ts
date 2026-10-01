import { Locator, Page } from '@playwright/test';
import { wizardScope, type FormScope } from './wizard-scope';
import { fieldLabel, resolveLocator, tryResolveLocator, type LocatorEntry } from './locator-registry';

export type Occurrence = 'first' | 'last';

async function scopes(page: Page): Promise<FormScope[]> {
  const wizard = await wizardScope(page);
  return wizard === page ? [page] : [wizard, page];
}

export async function waitForWizardIdle(page: Page): Promise<void> {
  const loading = page.getByText(/Loading, please wait/i);
  await loading.first().waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => undefined);
  const serviceError = page.getByText(/503 Service Unavailable|An error occurred while processing your request/i);
  if (await serviceError.first().isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Close', exact: true }).click().catch(() => undefined);
    await serviceError.first().waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  }
}

async function scrollWizardToBottom(page: Page): Promise<void> {
  await page
    .locator('.ITWizardRoot')
    .first()
    .evaluate((el) => {
      (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
    })
    .catch(() => undefined);
  await page.locator('#floatingScrollIndicator').click({ force: true }).catch(() => undefined);
}

function pick(loc: Locator, occurrence: Occurrence): Locator {
  return occurrence === 'last' ? loc.last() : loc.first();
}

function choiceInScope(scope: Pick<Page, 'getByRole'>, option: string): Locator {
  return scope
    .getByRole('checkbox', { name: option, exact: true })
    .or(scope.getByRole('radio', { name: option, exact: true }));
}

async function checkChoice(choice: Locator): Promise<void> {
  await choice.scrollIntoViewIfNeeded().catch(() => undefined);
  if (await choice.isChecked().catch(() => false)) {
    return;
  }
  await choice.check({ force: true }).catch(async () => {
    await choice.click({ force: true });
  });
  for (let attempt = 0; attempt < 6; attempt++) {
    if (await choice.isChecked().catch(() => false)) return;
    if ((await choice.getAttribute('aria-checked')) === 'true') return;
    await choice.click({ force: true });
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** First visible checkbox/radio for `option` at or below the question (not the first Yes/No on the page). */
async function choiceBelowQuestion(
  scope: FormScope,
  question: Locator,
  option: string,
): Promise<Locator | null> {
  const qbox = await question.boundingBox();
  const choices = choiceInScope(scope, option);
  const n = await choices.count();
  for (let i = 0; i < n; i++) {
    const choice = choices.nth(i);
    if (!(await choice.isVisible())) continue;
    const cbox = await choice.boundingBox();
    if (!qbox || !cbox || cbox.y + cbox.height < qbox.y) continue;
    return choice;
  }
  return null;
}

/** Firelight round checkboxes: click the label under the question until checked or `until` is visible. */
export async function selectChoiceBelowQuestion(
  page: Page,
  questionText: string,
  option: string,
  until?: Locator,
): Promise<void> {
  await waitForWizardIdle(page);
  const question = page.getByText(questionText, { exact: false }).first();
  await question.waitFor({ state: 'visible', timeout: 20_000 });
  await question.scrollIntoViewIfNeeded().catch(() => undefined);
  const box = question.locator(`xpath=following::div[@role="checkbox"][@title="${option}"][1]`);
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    await scrollWizardToBottom(page);
    if ((await box.count()) > 0 && (await box.isVisible().catch(() => false))) break;
    await box.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(400);
  }
  await box.waitFor({ state: 'visible', timeout: 8_000 });
  for (let i = 0; i < 20; i++) {
    const checked =
      (await box.getAttribute('aria-checked')) === 'true' || (await box.isChecked().catch(() => false));
    if (checked) {
      if (!until) {
        await waitForWizardIdle(page);
        await page.waitForTimeout(800);
        return;
      }
      await scrollWizardToBottom(page);
      if (await until.isVisible().catch(() => false)) {
        await waitForWizardIdle(page);
        return;
      }
    } else {
      await box.evaluate((el) => (el as HTMLElement).click());
    }
    await waitForWizardIdle(page);
    await page.waitForTimeout(500);
  }
  if (until) {
    await scrollWizardToBottom(page);
    await until.waitFor({ state: 'visible', timeout: 20_000 });
  }
}

async function selectNativeOption(box: Locator, option: string): Promise<void> {
  await box.selectOption({ label: option }).catch(async () => {
    const value = await box.evaluate((el, wanted) => {
      const select = el as HTMLSelectElement;
      const match = [...select.options].find((o) => o.text.trim().toLowerCase() === wanted.toLowerCase());
      return match?.value ?? '';
    }, option);
    if (!value) throw new Error(`No combobox option "${option}"`);
    await box.selectOption(value);
  });
}

async function trySelectInScope(
  scope: FormScope,
  label: string,
  option: string,
  occurrence: Occurrence,
  page: Page,
): Promise<boolean> {
  const yesNo = /^(Yes|No)$/i.test(option);
  const labelRe = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const question = pick(scope.getByText(label, { exact: false }), occurrence);
  const questionVisible = (await question.count()) > 0;

  if (questionVisible) {
    await question.scrollIntoViewIfNeeded().catch(() => undefined);
    const near = await choiceBelowQuestion(scope, question, option);
    if (near) {
      await checkChoice(near);
      await waitForWizardIdle(page);
      await page.waitForTimeout(400);
      return true;
    }
    const followingCombo = question.locator('xpath=following::select[1]');
    if (await followingCombo.count()) {
      await selectNativeOption(followingCombo, option);
      return true;
    }
  }

  if (!yesNo && occurrence === 'first') {
    const uniqueChoice = choiceInScope(scope, option);
    if (await uniqueChoice.count()) {
      await checkChoice(uniqueChoice.first());
      await waitForWizardIdle(page);
      await page.waitForTimeout(400);
      return true;
    }
  }

  const combo = scope.getByRole('combobox', { name: labelRe });
  if (await combo.count()) {
    await selectNativeOption(pick(combo, occurrence), option);
    return true;
  }

  const field = scope.getByLabel(label, { exact: false });
  if (await field.count()) {
    const target = pick(field, occurrence);
    const tag = await target.evaluate((el) => el.tagName.toLowerCase());
    if (tag === 'select') {
      await target.selectOption({ label: option });
      return true;
    }
  }
  return false;
}

export async function selectByLabel(
  page: Page,
  label: string,
  option: string,
  occurrence: Occurrence = 'first',
): Promise<void> {
  await waitForWizardIdle(page);
  for (const scope of await scopes(page)) {
    if (await trySelectInScope(scope, label, option, occurrence, page)) return;
  }
  throw new Error(`Could not find field labeled "${label}" (option "${option}") on ${page.url()}`);
}

async function tryFillInScope(
  scope: FormScope,
  label: string,
  value: string,
  occurrence: Occurrence,
): Promise<boolean> {
  const name = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const question = pick(scope.getByText(label, { exact: false }), occurrence);
  await question.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);

  const named = scope.getByRole('textbox', { name }).or(scope.getByLabel(label, { exact: false }));
  if (await named.count()) {
    const field = pick(named, occurrence);
    await field.scrollIntoViewIfNeeded().catch(() => undefined);
    await field.click();
    await field.fill(value);
    await field.press('Tab').catch(() => undefined);
    return true;
  }

  if (await question.count()) {
    await question.scrollIntoViewIfNeeded().catch(() => undefined);
    const following = question.locator(
      'xpath=following::input[not(@type="checkbox") and not(@type="radio") and not(@type="hidden")][1]',
    );
    if (await following.count()) {
      await following.click();
      await following.fill(value);
      await following.press('Tab').catch(() => undefined);
      return true;
    }
  }
  return false;
}

export async function fillByLabel(
  page: Page,
  label: string,
  value: string,
  occurrence: Occurrence = 'first',
): Promise<void> {
  await waitForWizardIdle(page);
  for (const scope of await scopes(page)) {
    if (await tryFillInScope(scope, label, value, occurrence)) return;
  }
  throw new Error(`Could not find input labeled "${label}" on ${page.url()}`);
}

export async function clickNext(page: Page): Promise<void> {
  await waitForWizardIdle(page);
  for (const scope of await scopes(page)) {
    const next = scope.getByRole('button', { name: 'Next', exact: true });
    if (await next.count()) {
      await next.first().click({ force: false });
      await waitForWizardIdle(page);
      await page.waitForTimeout(800);
      return;
    }
  }
  throw new Error(`Could not find Next on ${page.url()}`);
}

export async function clickControl(
  page: Page,
  name: string,
  occurrence: Occurrence = 'first',
): Promise<void> {
  await waitForWizardIdle(page);
  for (const scope of await scopes(page)) {
    const control = scope.getByRole('button', { name }).or(scope.getByText(name, { exact: false }));
    if (await control.count()) {
      await pick(control, occurrence).click();
      await waitForWizardIdle(page);
      return;
    }
  }
  throw new Error(`Could not find control "${name}" on ${page.url()}`);
}

async function controlTag(loc: Locator): Promise<string> {
  return loc.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
}

/** Multi-strategy fill: resolveLocator (id/css/role/label/text) then Firelight label heuristic. */
export async function fillByEntry(
  page: Page,
  entry: LocatorEntry,
  value: string,
  occurrence: Occurrence = 'first',
): Promise<void> {
  await waitForWizardIdle(page);
  try {
    const loc = await tryResolveLocator(page, entry, occurrence);
    if (loc) {
      const tag = await controlTag(loc);
      if (tag === 'input' || tag === 'textarea') {
        await loc.scrollIntoViewIfNeeded().catch(() => undefined);
        await loc.click();
        await loc.fill(value);
        await loc.press('Tab').catch(() => undefined);
        return;
      }
      if (tag === 'select') {
        await loc.selectOption({ label: value }).catch(async () => {
          await loc.selectOption(value);
        });
        return;
      }
    }
  } catch {
    /* fall through to question-scoped heuristic */
  }
  await fillByLabel(page, fieldLabel(entry), value, occurrence);
}

/** Multi-strategy select / Yes-No: native <select> via resolveLocator, else grouped radios. */
export async function selectByEntry(
  page: Page,
  entry: LocatorEntry,
  option: string,
  occurrence: Occurrence = 'first',
): Promise<void> {
  await waitForWizardIdle(page);
  try {
    const loc = await tryResolveLocator(page, entry, occurrence);
    if (loc) {
      const tag = await controlTag(loc);
      if (tag === 'select') {
        await loc.selectOption({ label: option }).catch(async () => {
          await loc.selectOption(option);
        });
        return;
      }
    }
  } catch {
    /* grouped checkboxes still need the question-scoped heuristic */
  }
  await selectByLabel(page, fieldLabel(entry), option, occurrence);
}

export async function clickByEntry(
  page: Page,
  entry: LocatorEntry,
  occurrence: Occurrence = 'first',
): Promise<void> {
  await waitForWizardIdle(page);
  try {
    const loc = await tryResolveLocator(page, entry, occurrence);
    if (loc) {
      await loc.click();
      await waitForWizardIdle(page);
      return;
    }
    if (/next/i.test(entry.name)) {
      await clickNext(page);
      return;
    }
    const waited = await resolveLocator(page, entry, 8_000, occurrence);
    await waited.click();
    await waitForWizardIdle(page);
  } catch (err) {
    if (/next/i.test(entry.name)) {
      await clickNext(page);
      return;
    }
    throw err;
  }
}
