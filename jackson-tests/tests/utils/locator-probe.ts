/**
 * Compare script locators + ticket dataitemids to a *filled* live snapshot.
 * Does not use CURRENT baseline HTML (avoids false "added" vs a landing freeze).
 */
import fs from 'fs';
import path from 'path';
import type { PageSnapshot } from './dom-snapshot';
import { landingPageKey } from './wizard-pages';

export type LocatorDrift = {
  page: string;
  fieldOrLocator: string;
  changeType: 'label-changed' | 'modified';
  baselineValue: string | null;
  currentValue: string | null;
  description: string;
  labels: string[];
};

type Strategy = { type: string; value: string };
type LocatorFile = {
  page?: string;
  entries?: Record<string, { name: string; page?: string; strategies?: Strategy[] }>;
};

const SKIP_LIVE_LABEL = /^(yes|no|male|female)$/i;

function dataItemFromCss(value: string): string | null {
  const m = value.match(/data-dataitemid=['"]([^'"]+)['"]/i);
  return m?.[1] || null;
}

function roleName(value: string): string | null {
  const m = value.match(/\[name=['"]([^'"]+)['"]\]/);
  return m?.[1] || null;
}

function labelFromMarkup(html: string, dataItemId: string): string | null {
  const token = `data-dataitemid="${dataItemId}"`;
  const i = html.indexOf(token);
  if (i < 0) return null;
  const slice = html.slice(i, i + 2200);
  const label = slice.match(/<label[^>]*>\s*([^<]{2,120})\s*<\/label>/i);
  if (label?.[1]) return label[1].replace(/\s+/g, ' ').trim();
  const title = slice.match(/\btitle="([^"]{2,120})"/i);
  if (title?.[1]) return title[1].replace(/\s+/g, ' ').trim();
  return null;
}

function visibleText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

function loadLocatorFiles(dir: string): LocatorFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.locators.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as LocatorFile);
}

const TICKET_DATAITEMS: Record<string, string[]> = {
  owner: ['Owner_ResidentialAddress1', 'Owner_Active_Military_YN'],
  beneficiaries: ['PrimaryBeneficiary1_Relationship'],
};

export function probeFilledAgainstLocators(
  filledSnaps: PageSnapshot[],
  locatorsDir: string,
): LocatorDrift[] {
  const files = loadLocatorFiles(locatorsDir);
  const drifts: LocatorDrift[] = [];

  for (const snap of filledSnaps) {
    const page = landingPageKey(snap.pageKey);
    const html = snap.html || '';
    if (!html) continue;
    const hay = visibleText(html);
    const file = files.find((f) => (f.page || '').toLowerCase() === page.toLowerCase());
    const entries = Object.values(file?.entries || {});

    for (const entry of entries) {
      const strategies = entry.strategies || [];
      const expected = strategies
        .filter((s) => s.type === 'label' || s.type === 'text')
        .map((s) => s.value.trim())
        .filter(Boolean);
      for (const s of strategies) {
        if (s.type === 'role') {
          const n = roleName(s.value);
          if (n) expected.push(n);
        }
      }
      const dataIds = strategies.map((s) => (s.type === 'css' ? dataItemFromCss(s.value) : null)).filter(Boolean) as string[];

      for (const id of dataIds) {
        const live = labelFromMarkup(html, id);
        if (!live || SKIP_LIVE_LABEL.test(live)) continue;
        if (expected.some((e) => e.toLowerCase() === live.toLowerCase() || hay.includes(e))) continue;
        if (!expected.length) continue;
        drifts.push({
          page,
          fieldOrLocator: id,
          changeType: 'label-changed',
          baselineValue: expected[0],
          currentValue: live,
          description: `Locator sidecar vs live filled DOM (not vs freeze) on ${page}: ${entry.name} (${id}).`,
          labels: [id, entry.name, expected[0], live],
        });
      }

      if (entry.name === 'addBeneficiary' || /add additional beneficiary/i.test(expected.join(' '))) {
        const wanted = expected.filter((e) => /beneficiary/i.test(e));
        const stillThere = wanted.some((e) => hay.includes(e));
        if (stillThere) continue;
        const liveBtn = (snap.elements || []).find((el) => /add.*benefic/i.test(`${el.label || ''} ${el.text || ''}`));
        const liveName = (liveBtn?.label || liveBtn?.text || '').trim();
        if (liveName && wanted.length && !wanted.some((e) => e.toLowerCase() === liveName.toLowerCase())) {
          drifts.push({
            page,
            fieldOrLocator: 'Add Additional Beneficiary',
            changeType: 'label-changed',
            baselineValue: wanted[0],
            currentValue: liveName,
            description: `Locator sidecar vs live filled DOM (not vs freeze) on ${page}: add beneficiary control renamed.`,
            labels: ['Add Additional Beneficiary', liveName],
          });
        }
      }
    }

    for (const id of TICKET_DATAITEMS[page] || []) {
      if (drifts.some((d) => d.page === page && d.fieldOrLocator === id)) continue;
      const live = labelFromMarkup(html, id);
      const inHtml = html.includes(id);
      if (!inHtml) {
        drifts.push({
          page,
          fieldOrLocator: id,
          changeType: 'modified',
          baselineValue: id,
          currentValue: null,
          description: `Ticket field ${id} was not in the filled ${page} DOM (locator probe, not freeze).`,
          labels: [id],
        });
        continue;
      }
      if (!live || SKIP_LIVE_LABEL.test(live)) continue;
      const locatorExpected = entries.flatMap((e) =>
        (e.strategies || []).filter((s) => s.type === 'label' || s.type === 'text').map((s) => s.value),
      );
      if (locatorExpected.some((e) => e.toLowerCase() === live.toLowerCase())) continue;
      if (page === 'beneficiaries' && /relationship/i.test(live)) {
        const rel = locatorExpected.find((e) => /relationship/i.test(e));
        if (rel && rel.toLowerCase() !== live.toLowerCase()) {
          drifts.push({
            page,
            fieldOrLocator: id,
            changeType: 'label-changed',
            baselineValue: rel,
            currentValue: live,
            description: `Locator sidecar vs live filled DOM (not vs freeze) on ${page}: ${id}.`,
            labels: [id, rel, live],
          });
        }
      }
    }
  }

  return drifts;
}
