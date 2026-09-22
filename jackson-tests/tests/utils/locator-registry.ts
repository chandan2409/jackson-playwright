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

export function loadLocators(filePath: string): LocatorRegistry {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as LocatorRegistry;
}

/**
 * Resolve the highest-confidence strategy that matches on the page.
 * Foundation for self-healing: failed strategies are skipped; survivors stay ranked.
 */
export async function resolveLocator(page: Page, entry: LocatorEntry): Promise<Locator> {
  const sorted = [...entry.strategies].sort((a, b) => b.confidence - a.confidence);
  const errors: string[] = [];

  for (const strategy of sorted) {
    try {
      const locator = strategyToLocator(page, strategy);
      const count = await locator.count();
      if (count > 0) {
        return locator.first();
      }
      errors.push(`${strategy.type}=${strategy.value} (count=0)`);
    } catch (e: any) {
      errors.push(`${strategy.type}=${strategy.value} (${e.message})`);
    }
  }

  throw new Error(
    `Unable to resolve locator "${entry.name}" on page "${entry.page}". Tried: ${errors.join('; ')}`,
  );
}

function strategyToLocator(page: Page, strategy: LocatorStrategy): Locator {
  switch (strategy.type) {
    case 'testid':
      return page.getByTestId(strategy.value);
    case 'id':
      return page.locator(`#${strategy.value}`);
    case 'css':
      return page.locator(strategy.value);
    case 'label':
      return page.getByLabel(strategy.value, { exact: false });
    case 'text':
      return page.getByText(strategy.value, { exact: false });
    case 'role': {
      // format: role[name='Accessible Name'] or bare role
      const match = strategy.value.match(/^(\w+)(?:\[name=['"](.+)['"]\])?$/);
      if (!match) return page.getByRole(strategy.value as any);
      const [, role, name] = match;
      return name
        ? page.getByRole(role as any, { name })
        : page.getByRole(role as any);
    }
    case 'xpath':
      return page.locator(`xpath=${strategy.value}`);
    default:
      return page.locator(strategy.value);
  }
}

export function registryPath(pageFile: string): string {
  return path.join(path.dirname(pageFile), path.basename(pageFile).replace(/\.ts$/, '.locators.json'));
}
