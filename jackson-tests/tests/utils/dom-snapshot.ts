import { createHash } from 'crypto';
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
  /** True when this file is a live (or rehearsal) capture of the page DOM. */
  scanned: boolean;
  /** CSS selector whose outerHTML was serialized. */
  domRoot: string | null;
  /** Serialized DOM (scripts/styles/values stripped). Source of truth for baseline vs current. */
  html: string;
  htmlHash: string;
  /** Interactive inventory derived from the same DOM for field-level diffs. */
  elements: DomElementSnapshot[];
};

export async function serializeDom(page: Page): Promise<{ html: string; htmlHash: string; domRoot: string }> {
  const { html, domRoot } = await page.evaluate(() => {
    const candidates = [
      '#divContent',
      '#content',
      '#form1',
      'form',
      '[role="main"]',
      'main',
      '#pageContent',
      'body',
    ];
    let root: Element | null = null;
    let used = 'body';
    for (const sel of candidates) {
      const found = document.querySelector(sel);
      if (found) {
        root = found;
        used = sel;
        break;
      }
    }
    root = root || document.body;
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, noscript, iframe, link[rel="stylesheet"]').forEach((n) => n.remove());
    clone.querySelectorAll('input, textarea').forEach((el) => {
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      input.value = '';
      el.removeAttribute('value');
    });
    return { html: clone.outerHTML, domRoot: used };
  });
  return {
    html,
    domRoot,
    htmlHash: hashHtml(html),
  };
}

export async function extractInteractive(page: Page): Promise<DomElementSnapshot[]> {
  return page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll('input, select, textarea, button, [role="button"], [role="combobox"], a'),
    );
    return nodes.map((el, idx) => {
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

/** Drop session/layout noise so two wizard runs of the same page share a hash. */
export function normalizeDom(html: string): string {
  return (html || '')
    .replace(/style="[^"]*"/gi, '')
    .replace(/style='[^']*'/gi, '')
    .replace(/AppGuid=[a-f0-9-]+/gi, 'AppGuid=')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')
    .replace(/\b\d+(\.\d+)?(px|%)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hashHtml(html: string): string {
  return createHash('sha256').update(normalizeDom(html)).digest('hex');
}

export async function captureCurrentPage(page: Page, pageKey: string): Promise<PageSnapshot> {
  const { html, htmlHash, domRoot } = await serializeDom(page);
  return {
    pageKey,
    url: page.url(),
    capturedAt: new Date().toISOString(),
    title: await page.title(),
    scanned: true,
    domRoot,
    html,
    htmlHash,
    elements: await extractInteractive(page),
  };
}

export function unscannedSnapshot(pageKey: string, reason: string): PageSnapshot {
  return {
    pageKey,
    url: '',
    capturedAt: new Date().toISOString(),
    title: reason,
    scanned: false,
    domRoot: null,
    html: '',
    htmlHash: hashHtml(''),
    elements: [],
  };
}

export function isScanned(snap: PageSnapshot): boolean {
  if (typeof snap.scanned === 'boolean') return snap.scanned;
  return Boolean(snap.html || snap.url || (snap.elements && snap.elements.length));
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
