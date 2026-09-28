import { Page, Locator } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export type LocatorStrategy = {
  type: 'testid' | 'id' | 'css' | 'role' | 'label' | 'text' | 'xpath';
  value: string;
  confidence: number;
};

export type LocatorEntry = {
  name: string;
  page: string;
  strategies: LocatorStrategy[];
};

export type LocatorRegistry = {
  page: string;
  generatedAt: string;
  source: string;
  entries: Record<string, LocatorEntry>;
};

type LocatorHost = Pick<Page, 'getByTestId' | 'locator' | 'getByLabel' | 'getByText' | 'getByRole'>;

export function loadLocators(filePath: string): LocatorRegistry {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as LocatorRegistry;
}

/** Label/text used by form helpers — heal updates this sidecar, not hardcoded POM strings. */
export function fieldLabel(entry: LocatorEntry): string {
  const ranked = [...entry.strategies].sort((a, b) => b.confidence - a.confidence);
  const hit = ranked.find((s) => s.type === 'label' || s.type === 'text');
  return hit?.value ?? entry.name;
}

function hosts(page: Page): LocatorHost[] {
  return [page];
}

async function firstVisible(locator: Locator): Promise<Locator | null> {
  const n = await locator.count();
  for (let i = 0; i < n; i++) {
    const cand = locator.nth(i);
    if (await cand.isVisible().catch(() => false)) return cand;
  }
  return null;
}

/**
 * Resolve the highest-confidence strategy that matches a **visible** control on the page.
 * Child frames are not searched unless a later call site adds them (Firelight wizard is main-document).
 */
export async function resolveLocator(
  page: Page,
  entry: LocatorEntry,
  timeout = 20_000,
): Promise<Locator> {
  const sorted = [...entry.strategies].sort((a, b) => b.confidence - a.confidence);
  const deadline = Date.now() + timeout;
  const errors: string[] = [];

  while (Date.now() < deadline) {
    for (const host of hosts(page)) {
      for (const strategy of sorted) {
        try {
          const hit = await firstVisible(strategyToLocator(host, strategy));
          if (hit) return hit;
        } catch (e: any) {
          errors.push(`${strategy.type}=${strategy.value} (${e.message})`);
        }
      }
    }
    await page.waitForTimeout(250);
  }

  throw new Error(
    `Unable to resolve locator "${entry.name}" on page "${entry.page}". Tried: ${
      errors.slice(-8).join('; ') || sorted.map((s) => `${s.type}=${s.value} (not visible)`).join('; ')
    }`,
  );
}

function strategyToLocator(host: LocatorHost, strategy: LocatorStrategy): Locator {
  switch (strategy.type) {
    case 'testid':
      return host.getByTestId(strategy.value);
    case 'id':
      return host.locator(`#${strategy.value}`);
    case 'css':
      return host.locator(strategy.value);
    case 'label':
      return host.getByLabel(strategy.value, { exact: false });
    case 'text':
      return host.getByText(strategy.value, { exact: false });
    case 'role': {
      const match = strategy.value.match(/^(\w+)(?:\[name=['"](.+)['"]\])?$/);
      if (!match) return host.getByRole(strategy.value as any);
      const [, role, name] = match;
      return name ? host.getByRole(role as any, { name }) : host.getByRole(role as any);
    }
    case 'xpath':
      return host.locator(`xpath=${strategy.value}`);
    default:
      return host.locator(strategy.value);
  }
}

export function registryPath(pageFile: string): string {
  return path.join(path.dirname(pageFile), path.basename(pageFile).replace(/\.ts$/, '.locators.json'));
}
