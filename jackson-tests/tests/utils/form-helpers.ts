import { Locator, Page } from '@playwright/test';
import { wizardScope, type FormScope } from './wizard-scope';
import { fieldLabel, resolveLocator, tryResolveLocator, type LocatorEntry } from './locator-registry';

export type Occurrence = 'first' | 'last';

async function scopes(page: Page): Promise<FormScope[]> {
  const wizard = await wizardScope(page);
  return wizard === page ? [page] : [wizard, page];
}

async function waitForWizardIdle(page: Page): Promise<void> {
  const loading = page.getByText('Loading, please wait', { exact: false });
  if (await loading.count()) {
    await loading.first().waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);
  }
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
  if (!(await choice.isChecked().catch(() => false))) {
    await choice.click({ force: true });
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

export async function selectByLabel(
  page: Page,
  label: string,
  option: string,
  occurrence: Occurrence = 'first',
): Promise<void> {
  await waitForWizardIdle(page);
  const yesNo = /^(Yes|No)$/i.test(option);
  const labelRe = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  for (const scope of await scopes(page)) {
    const question = pick(scope.getByText(label, { exact: false }), occurrence);
    const questionVisible = (await question.count()) > 0;

    if (questionVisible) {
      await question.scrollIntoViewIfNeeded().catch(() => undefined);
      const near = await choiceBelowQuestion(scope, question, option);
      if (near) {
        await checkChoice(near);
        await waitForWizardIdle(page);
        await page.waitForTimeout(400);
        return;
      }

      const followingCombo = question.locator('xpath=following::select[1]');
      if (await followingCombo.count()) {
        await followingCombo.selectOption({ label: option }).catch(async () => {
          await followingCombo.selectOption(option);
        });
        return;
      }
    }

    if (!yesNo && occurrence === 'first') {
      const uniqueChoice = choiceInScope(scope, option);
      if (await uniqueChoice.count()) {
        await checkChoice(uniqueChoice.first());
        await waitForWizardIdle(page);
        await page.waitForTimeout(400);
        return;
      }
    }

    const combo = scope.getByRole('combobox', { name: labelRe });
    if (await combo.count()) {
      const box = pick(combo, occurrence);
      await box.selectOption({ label: option }).catch(async () => {
        const value = await box.evaluate((el, wanted) => {
          const select = el as HTMLSelectElement;
          const match = [...select.options].find(
            (o) => o.text.trim().toLowerCase() === wanted.toLowerCase(),
          );
          return match?.value ?? '';
        }, option);
        if (!value) throw new Error(`No combobox option "${option}"`);
        await box.selectOption(value);
      });
      return;
    }

    const field = scope.getByLabel(label, { exact: false });
    if (await field.count()) {
      const target = pick(field, occurrence);
      const tag = await target.evaluate((el) => el.tagName.toLowerCase());
      if (tag === 'select') {
        await target.selectOption({ label: option });
        return;
      }
    }
  }

  throw new Error(`Could not find field labeled "${label}" (option "${option}") on ${page.url()}`);
}

export async function fillByLabel(
  page: Page,
  label: string,
  value: string,
  occurrence: Occurrence = 'first',
): Promise<void> {
  await waitForWizardIdle(page);
  const name = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  for (const scope of await scopes(page)) {
    const question = pick(scope.getByText(label, { exact: false }), occurrence);
    await question.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);

    const named = scope.getByRole('textbox', { name }).or(scope.getByLabel(label, { exact: false }));
    if (await named.count()) {
      const field = pick(named, occurrence);
      await field.scrollIntoViewIfNeeded().catch(() => undefined);
      await field.click();
      await field.fill(value);
      await field.press('Tab').catch(() => undefined);
      return;
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
        return;
      }
    }
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
