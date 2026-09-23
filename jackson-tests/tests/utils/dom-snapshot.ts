import type { Page } from '@playwright/test';

export type DomElementSnapshot = {
  name: string;
  tag: string;
  text: string;
  label: string | null;
  id: string | null;
  testId: string | null;
  nameAttr: string | null;
  classes: string[];
  type: string | null;
  options?: string[];
};

export type PageSnapshot = {
  pageKey: string;
  url: string;
  capturedAt: string;
  title: string;
  elements: DomElementSnapshot[];
};

export async function extractInteractive(page: Page): Promise<DomElementSnapshot[]> {
  return page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll('input, select, textarea, button, [role="button"], [role="combobox"], a'),
    );
    return nodes.slice(0, 400).map((el, idx) => {
      const html = el as HTMLElement;
      const labelEl =
        (html.id && document.querySelector(`label[for="${html.id}"]`)) || html.closest('label');
      const labelText = labelEl?.textContent?.trim() || html.getAttribute('aria-label');
      const options =
        html.tagName.toLowerCase() === 'select'
          ? Array.from((html as HTMLSelectElement).options).map((o) => o.text.trim())
          : undefined;
      return {
        name: html.getAttribute('name') || html.id || `el_${idx}`,
        tag: html.tagName.toLowerCase(),
        text: (html.innerText || html.textContent || '').trim().slice(0, 120),
        label: labelText || null,
        id: html.id || null,
        testId: html.getAttribute('data-testid'),
        nameAttr: html.getAttribute('name'),
        classes: Array.from(html.classList),
        type: html.getAttribute('type'),
        options,
      };
    });
  });
}

export async function captureCurrentPage(page: Page, pageKey: string): Promise<PageSnapshot> {
  return {
    pageKey,
    url: page.url(),
    capturedAt: new Date().toISOString(),
    title: await page.title(),
    elements: await extractInteractive(page),
  };
}

/** Stable identity so a label rename is `label-changed`, not removed+added. */
export function elementKey(el: DomElementSnapshot): string {
  return el.id || el.nameAttr || el.testId || el.label || el.text || el.name;
}

export function fingerprint(el: DomElementSnapshot): string {
  return JSON.stringify({
    tag: el.tag,
    label: el.label,
    type: el.type,
    options: el.options,
    text: el.text,
  });
}
