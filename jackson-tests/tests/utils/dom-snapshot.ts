import { createHash } from 'crypto';
import type { Page } from '@playwright/test';
import { writeCachedSnapshot } from './snapshot-cache';

export type DomElementSnapshot = {
  name: string;
  tag: string;
  text: string;
  label: string | null;
  id: string | null;
  testId: string | null;
  nameAttr: string | null;
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

const INVENTORY_NOISE =
  /QA\s*\d|2\.49|Log Off|Other Actions|Open Page List|Rename\/Summary|Request Client|Manage Optional Forms|Copy Activity|^Home$|^History$|^Documents$|☰|toolbar_|transactionBar_|ITNavBar|navPointer|navDisplay/i;

function inventoryNoiseHay(el: {
  id?: string | null;
  name?: string;
  label?: string | null;
  text?: string;
  nameAttr?: string | null;
}): string {
  return [el.id, el.name, el.nameAttr, el.label, el.text].filter(Boolean).join(' ');
}

export function isInventoryNoise(el: DomElementSnapshot): boolean {
  return INVENTORY_NOISE.test(inventoryNoiseHay(el));
}

/**
 * Inventory from frozen wizard HTML.
 * `parser` must be a disposable tab (never the live Firelight page — setContent would wipe the app).
 */
export async function extractInteractiveFromHtml(parser: Page, markup: string): Promise<DomElementSnapshot[]> {
  if (!markup) return [];
  await parser.setContent('<!DOCTYPE html><html><body></body></html>');
  const noiseSource = JSON.stringify(INVENTORY_NOISE.source);
  return parser.evaluate(`(() => {
      const html = ${JSON.stringify(markup)};
      const noise = new RegExp(${noiseSource}, 'i');
      const root = document.createElement('div');
      root.innerHTML = html;
      document.body.appendChild(root);
      const seen = new Set();
      const nodes = [];
      const take = (list) => {
        for (const el of list) {
          if (!seen.has(el)) { seen.add(el); nodes.push(el); }
        }
      };
      take(root.querySelectorAll('input, select, textarea, button, [role="button"], [role="checkbox"], [role="radio"], [role="combobox"]'));
      take(root.querySelectorAll('a[data-dataitemid], .groupField a'));
      take(root.querySelectorAll('.ITText[title*="?"]'));
      const out = nodes.map((el, idx) => {
        let dataItem = el.getAttribute('data-dataitemid');
        for (let n = el.parentElement; n && n !== root && !dataItem; n = n.parentElement) {
          dataItem = n.getAttribute('data-dataitemid');
        }
        const group = el.closest('.groupField, .row');
        const question = group ? group.querySelector('.ITText, [title*="?"]') : null;
        const id = el.id;
        let labelEl = el.closest('label');
        if (id) {
          const safe = (window.CSS && CSS.escape) ? CSS.escape(id) : id.replace(/"/g, '');
          labelEl = root.querySelector('label[for="' + safe + '"]') || labelEl;
        }
        const nearbyParent = el.closest('.groupField, .row, tr, td, th');
        const nearby = nearbyParent
          ? nearbyParent.querySelector('.ITText, [title*="?"], th, legend')
          : (el.closest('td') && el.closest('td').previousElementSibling);
        const labelText =
          (labelEl && labelEl.textContent && labelEl.textContent.trim()) ||
          el.getAttribute('aria-label') ||
          (question && question.textContent && question.textContent.trim()) ||
          (nearby && nearby.textContent && nearby.textContent.trim().slice(0, 80)) ||
          el.getAttribute('title') ||
          el.getAttribute('placeholder') ||
          null;
        const options = el.tagName.toLowerCase() === 'select'
          ? Array.from(el.options).map((o) => o.text.trim())
          : undefined;
        return {
          name: el.getAttribute('name') || el.id || dataItem || (labelText ? labelText.slice(0, 80) : ('el_' + idx)),
          tag: el.tagName.toLowerCase(),
          text: ((el.innerText || el.textContent || '').trim()).slice(0, 120),
          label: labelText || null,
          id: el.id || dataItem || null,
          testId: el.getAttribute('data-testid'),
          nameAttr: el.getAttribute('name'),
          type: el.getAttribute('type') || el.getAttribute('role'),
          options,
        };
      });
      return out.filter((el) => {
        const hay = [el.id, el.name, el.nameAttr, el.label, el.text].filter(Boolean).join(' ');
        return !noise.test(hay);
      });
    })()`);
}

/** Parser tab in a new context so Firelight (same context, cookies, SSO) is untouched. */
async function withIsolatedParser<T>(from: Page, fn: (parser: Page) => Promise<T>): Promise<T> {
  const browser = from.context().browser();
  if (!browser) {
    throw new Error('Need a Playwright browser to parse HTML without touching the live Firelight tab');
  }
  const ctx = await browser.newContext();
  try {
    return await fn(await ctx.newPage());
  } finally {
    await ctx.close();
  }
}

export async function extractInteractive(page: Page): Promise<DomElementSnapshot[]> {
  const { html } = await serializeDom(page);
  return withIsolatedParser(page, (parser) => extractInteractiveFromHtml(parser, html));
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
  const snap: PageSnapshot = {
    pageKey,
    url: page.url(),
    capturedAt: new Date().toISOString(),
    title: await page.title(),
    scanned: true,
    domRoot,
    html,
    htmlHash,
    elements: await withIsolatedParser(page, (parser) => extractInteractiveFromHtml(parser, html)),
  };
  writeCachedSnapshot(snap);
  return snap;
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
