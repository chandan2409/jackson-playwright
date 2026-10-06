import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';
import ENV from './env';
import { writeDefectStub } from './jira-file';
import {
  captureCurrentPage,
  elementKey,
  extractInteractiveFromHtml,
  fingerprint,
  hashHtml,
  isScanned,
  unscannedSnapshot,
  type PageSnapshot,
  type DomElementSnapshot,
} from './dom-snapshot';
import { happyPathData, runFirelightWizard } from './wizard-flow';
import { screenshotWizard } from './wizard-shot';
import { WIZARD_PAGES } from './wizard-pages';

const ROOT = path.resolve(__dirname, '../..');
const BASELINE_ROOT = path.join(ROOT, 'tests/data/baselines');
const REPORT_DIR = path.join(ROOT, 'tests/reports/changes');
const EVIDENCE_DIR = path.join(REPORT_DIR, 'evidence');
const AUTH = path.join(ROOT, '.auth/firelight-state.json');

type Classification = 'expected' | 'unexpected' | 'info';
type Severity = 'low' | 'medium' | 'high' | 'critical';

type ChangeRecord = {
  changeId: string;
  page: string;
  fieldOrLocator: string;
  changeType:
    | 'added'
    | 'removed'
    | 'modified'
    | 'relocated'
    | 'label-changed'
    | 'option-changed'
    | 'dom-changed'
    | 'unscanned';
  severity: Severity;
  classification: Classification;
  matchedTicketId: string | null;
  description: string;
  baselineValue: string | null;
  currentValue: string | null;
  evidenceScreenshot: string;
  requiresHumanAcceptance: boolean;
  acceptanceStatus: 'pending' | 'accepted' | 'rejected';
  healAction: string | null;
};

type ChangeReport = {
  generatedAt: string;
  baselineId: string;
  baselinePath: string;
  product: string;
  jurisdiction: string;
  caseName: string;
  summary: { total: number; expected: number; unexpected: number; info: number };
  changes: ChangeRecord[];
};

type ChangeTickets = {
  announcedChanges: Array<{
    ticketId: string;
    page: string;
    description: string;
    field?: string;
    severity?: Severity;
  }>;
};

function classify(
  page: string,
  field: string,
  tickets: ChangeTickets,
  labels: string[],
): { classification: Classification; matchedTicketId: string | null } {
  const hay = [page, field, ...labels].join(' ').toLowerCase();
  const match = (tickets.announcedChanges || []).find((t) => {
    const pageMatch =
      t.page.toLowerCase() === page.toLowerCase() || page.toLowerCase().includes(t.page.toLowerCase());
    const fieldMatch = !t.field || hay.includes(t.field.toLowerCase());
    return pageMatch && fieldMatch;
  });
  if (match) return { classification: 'expected', matchedTicketId: match.ticketId };
  return { classification: 'unexpected', matchedTicketId: null };
}

function severityFor(changeType: ChangeRecord['changeType']): Severity {
  switch (changeType) {
    case 'removed':
      return 'high';
    case 'unscanned':
      return 'high';
    case 'dom-changed':
      return 'medium';
    case 'label-changed':
    case 'option-changed':
      return 'medium';
    case 'added':
      return 'low';
    default:
      return 'medium';
  }
}

function fieldChangeType(baseEl: DomElementSnapshot, currEl: DomElementSnapshot): ChangeRecord['changeType'] {
  if (baseEl.label !== currEl.label) return 'label-changed';
  if (JSON.stringify(baseEl.options) !== JSON.stringify(currEl.options)) return 'option-changed';
  return 'modified';
}

/** True when baseline copy is still in live HTML (e.g. ITText restyled as a <p>). */
function textStillInMarkup(html: string, ...parts: Array<string | null | undefined>): boolean {
  if (!html) return false;
  const hay = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return parts
    .map((p) => (p || '').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 12)
    .some((p) => hay.includes(p));
}

function walkCoveredByInventory(changes: ChangeRecord[], pageKey: string, message: string): ChangeRecord | undefined {
  const hay = message.toLowerCase();
  return changes.find((c) => {
    if (c.page !== pageKey) return false;
    if (c.classification === 'info') return false;
    const needles = [c.fieldOrLocator, c.baselineValue, c.currentValue]
      .filter(Boolean)
      .map((v) => {
        try {
          const parsed = JSON.parse(String(v)) as { label?: string; text?: string };
          return parsed.label || parsed.text || String(v);
        } catch {
          return String(v);
        }
      });
    return needles.some((n) => n.length >= 8 && hay.includes(n.toLowerCase().slice(0, 80)));
  });
}

function nextId(counter: { n: number }): string {
  counter.n += 1;
  return `CHG-${String(counter.n).padStart(3, '0')}`;
}

export function diffPage(
  pageKey: string,
  baseline: PageSnapshot,
  current: PageSnapshot,
  tickets: ChangeTickets,
  counter: { n: number },
): ChangeRecord[] {
  const changes: ChangeRecord[] = [];
  const baseMap = new Map(baseline.elements.map((e) => [elementKey(e), e]));
  const currMap = new Map(current.elements.map((e) => [elementKey(e), e]));

  const push = (
    changeType: ChangeRecord['changeType'],
    key: string,
    baseEl: DomElementSnapshot | null,
    currEl: DomElementSnapshot | null,
    description: string,
    values?: { baselineValue: string | null; currentValue: string | null },
    forced?: { classification: Classification; healAction: ChangeRecord['healAction'] },
  ) => {
    const labels = [baseEl?.label, currEl?.label, baseEl?.text, currEl?.text, key].filter(Boolean) as string[];
    const classified = classify(pageKey, key, tickets, labels);
    const classification = forced?.classification ?? classified.classification;
    const fieldName = (baseEl?.label || currEl?.label || baseEl?.text || currEl?.text || key).trim();
    changes.push({
      changeId: nextId(counter),
      page: pageKey,
      fieldOrLocator: fieldName,
      changeType,
      severity: forced?.classification === 'info' ? 'low' : severityFor(changeType),
      classification,
      matchedTicketId: classified.matchedTicketId,
      description,
      baselineValue: values?.baselineValue ?? (baseEl ? fingerprint(baseEl) : null),
      currentValue: values?.currentValue ?? (currEl ? fingerprint(currEl) : null),
      evidenceScreenshot: '',
      requiresHumanAcceptance: true,
      acceptanceStatus: 'pending',
      healAction:
        forced?.healAction ??
        (classification === 'expected' ? 'update-locator' : classification === 'info' ? 'none' : 'file-defect'),
    });
  };

  for (const [key, baseEl] of baseMap) {
    const currEl = currMap.get(key);
    if (!currEl) {
      if (textStillInMarkup(current.html, baseEl.label, baseEl.text)) {
        push(
          'modified',
          key,
          baseEl,
          null,
          `Inventory node ${key} is gone, but the same wording is still in the live page markup (not a missing field).`,
          undefined,
          { classification: 'info', healAction: 'recapture-baseline' },
        );
        continue;
      }
      push('removed', key, baseEl, null, `Element present in baseline missing in current UI: ${key}`);
      continue;
    }
    if (fingerprint(baseEl) !== fingerprint(currEl)) {
      push(fieldChangeType(baseEl, currEl), key, baseEl, currEl, `Element changed on ${pageKey}: ${key}`);
    }
  }

  for (const [key, currEl] of currMap) {
    if (baseMap.has(key)) continue;
    push('added', key, null, currEl, `New element not in baseline: ${key}`);
  }

  const baseHash = hashHtml(baseline.html || '');
  const currHash = hashHtml(current.html || '');
  if (changes.length === 0 && baseline.html && current.html && baseHash !== currHash) {
    changes.push({
      changeId: nextId(counter),
      page: pageKey,
      fieldOrLocator: `${pageKey}#dom`,
      changeType: 'dom-changed',
      severity: 'low',
      classification: 'info',
      matchedTicketId: null,
      description: `Page markup changed with no field inventory diff (${baseHash.slice(0, 8)} → ${currHash.slice(0, 8)}). Recapture baseline after HITL; do not patch locators from the hash.`,
      baselineValue: baseHash,
      currentValue: currHash,
      evidenceScreenshot: '',
      requiresHumanAcceptance: true,
      acceptanceStatus: 'pending',
      healAction: 'recapture-baseline',
    });
  }

  return changes;
}

function evidenceFor(pageKey: string, currentDir: string): string {
  const png = path.join(EVIDENCE_DIR, `${pageKey}.png`);
  if (fs.existsSync(png)) return path.relative(ROOT, png);
  if (currentDir) {
    const json = path.join(currentDir, `${pageKey}.json`);
    if (fs.existsSync(json)) return path.relative(ROOT, json);
  }
  return '';
}

function stashBeforeScreenshots(baselinePath: string) {
  const dest = path.join(EVIDENCE_DIR, 'before');
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.mkdirSync(dest, { recursive: true });
  if (fs.existsSync(baselinePath)) {
    for (const name of fs.readdirSync(baselinePath)) {
      if (name.endsWith('.png')) {
        fs.copyFileSync(path.join(baselinePath, name), path.join(dest, name));
      }
    }
  }
  for (const name of fs.readdirSync(EVIDENCE_DIR)) {
    const src = path.join(EVIDENCE_DIR, name);
    if (!fs.statSync(src).isFile() || !name.endsWith('.png')) continue;
    if (name.includes('walk-error') || name === 'detect-walk-failed.png') continue;
    const target = path.join(dest, name);
    if (!fs.existsSync(target)) fs.copyFileSync(src, target);
  }
}

function unscannedRecord(
  pageKey: string,
  counter: { n: number },
  baselineSnap: PageSnapshot,
  currentDir: string,
): ChangeRecord {
  return {
    changeId: nextId(counter),
    page: pageKey,
    fieldOrLocator: pageKey,
    changeType: 'unscanned',
    severity: 'high',
    classification: 'info',
    matchedTicketId: null,
    description: `Wizard page ${pageKey} was not scanned on this detect run (baseline ${isScanned(baselineSnap) ? 'present' : 'also missing'})`,
    baselineValue: baselineSnap.htmlHash || null,
    currentValue: null,
    evidenceScreenshot: evidenceFor(pageKey, currentDir),
    requiresHumanAcceptance: true,
    acceptanceStatus: 'pending',
    healAction: 'none',
  };
}

function loadSnap(file: string, pageKey: string): PageSnapshot {
  if (!fs.existsSync(file)) return unscannedSnapshot(pageKey, `(missing snapshot) ${pageKey}`);
  const snap = JSON.parse(fs.readFileSync(file, 'utf8')) as PageSnapshot;
  if (!snap.htmlHash && snap.html) snap.htmlHash = hashHtml(snap.html);
  return snap;
}

async function refreshInventoryFromHtml(snaps: PageSnapshot[]) {
  const need = snaps.filter((s) => s.html);
  if (!need.length) return;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    for (const snap of need) {
      snap.elements = await extractInteractiveFromHtml(page, snap.html);
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  const baselinePath = process.env.DETECT_BASELINE_DIR
    ? path.resolve(ROOT, process.env.DETECT_BASELINE_DIR)
    : path.join(
        BASELINE_ROOT,
        fs.existsSync(path.join(BASELINE_ROOT, 'CURRENT'))
          ? fs.readFileSync(path.join(BASELINE_ROOT, 'CURRENT'), 'utf8').trim()
          : '',
      );

  if (!baselinePath || !fs.existsSync(path.join(baselinePath, 'manifest.json'))) {
    console.error('No baseline. Run: npm run baseline:capture (or set DETECT_BASELINE_DIR for rehearsal)');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(baselinePath, 'manifest.json'), 'utf8'));
  const ticketsPath = process.env.CHANGE_TICKETS_PATH
    ? path.resolve(ROOT, process.env.CHANGE_TICKETS_PATH)
    : path.resolve(ROOT, ENV.CHANGE_TICKETS_PATH);
  const tickets: ChangeTickets = fs.existsSync(ticketsPath)
    ? JSON.parse(fs.readFileSync(ticketsPath, 'utf8'))
    : { announcedChanges: [] };

  const currentDir = process.env.DETECT_CURRENT_DIR
    ? path.resolve(ROOT, process.env.DETECT_CURRENT_DIR)
    : '';

  const allChanges: ChangeRecord[] = [];
  const counter = { n: 0 };
  const currentByPage = new Map<string, PageSnapshot>();
  const walkErrors: Array<{ pageKey: string; message: string }> = [];

  const pageKeys = Array.from(new Set([...(manifest.pages as string[]), ...WIZARD_PAGES]));
  if (currentDir) {
    for (const pageKey of pageKeys) {
      currentByPage.set(pageKey, loadSnap(path.join(currentDir, `${pageKey}.json`), pageKey));
    }
  } else if (ENV.FIRELIGHT_USERNAME && fs.existsSync(AUTH)) {
    const browser = await chromium.launch({ headless: !!process.env.CI });
    const context = await browser.newContext({ storageState: AUTH });
    const page = await context.newPage();
    try {
      stashBeforeScreenshots(baselinePath);
      await runFirelightWizard(
        page,
        happyPathData,
        async (pageKey) => {
          currentByPage.set(pageKey, await captureCurrentPage(page, pageKey));
          await screenshotWizard(page, path.join(EVIDENCE_DIR, `${pageKey}.png`));
          console.log(`Scanned ${pageKey}`);
        },
        {
          continueOnError: true,
          onStepError: (pageKey, error) => {
            walkErrors.push({ pageKey, message: error.message });
            void screenshotWizard(page, path.join(EVIDENCE_DIR, `${pageKey}-walk-error.png`)).catch(() => undefined);
            console.warn(`Detect fill/nav failed on ${pageKey} (will classify as unexpected and continue):`, error.message);
          },
        },
      );
    } catch (err) {
      await page.screenshot({ path: path.join(EVIDENCE_DIR, 'detect-walk-failed.png'), fullPage: true }).catch(() => undefined);
      console.warn('Detect wizard walk stopped early:', err);
    } finally {
      await browser.close();
    }
  } else {
    console.error('Live detect needs FIRELIGHT_USERNAME and .auth/firelight-state.json. Run: npm run auth:setup');
    process.exit(1);
  }

  const pairs: Array<{ pageKey: string; baselineSnap: PageSnapshot; current: PageSnapshot }> = [];
  for (const pageKey of pageKeys) {
    const baselineFile = path.join(baselinePath, `${pageKey}.json`);
    const baselineSnap = loadSnap(baselineFile, pageKey);
    const current = currentByPage.get(pageKey) || unscannedSnapshot(pageKey, `(not scanned) ${pageKey}`);
    pairs.push({ pageKey, baselineSnap, current });
  }
  await refreshInventoryFromHtml(pairs.flatMap((p) => [p.baselineSnap, p.current]));

  for (const { pageKey, baselineSnap, current } of pairs) {
    if (!isScanned(current)) {
      allChanges.push(unscannedRecord(pageKey, counter, baselineSnap, currentDir));
      continue;
    }

    const pageChanges = diffPage(pageKey, baselineSnap, current, tickets, counter);
    for (const c of pageChanges) {
      c.evidenceScreenshot = evidenceFor(pageKey, currentDir);
    }
    allChanges.push(...pageChanges);
  }

  for (const fail of walkErrors) {
    const labeled = fail.message.match(/labeled "([^"]+)"/);
    const field = labeled?.[1] || fail.message.slice(0, 120);
    const covered = walkCoveredByInventory(allChanges, fail.pageKey, fail.message);
    if (covered) {
      covered.description += ` Detect walk also missed the old locator (${field}); that is the same change, not a second defect.`;
      continue;
    }
    const { classification, matchedTicketId } = classify(fail.pageKey, field, tickets, [field]);
    const walkPng = path.join(EVIDENCE_DIR, `${fail.pageKey}-walk-error.png`);
    allChanges.push({
      changeId: nextId(counter),
      page: fail.pageKey,
      fieldOrLocator: field,
      changeType: labeled ? 'label-changed' : 'modified',
      severity: 'high',
      classification: classification === 'expected' ? 'expected' : 'unexpected',
      matchedTicketId,
      description: `Fill/nav failed; detect continued to later pages. ${fail.message}`,
      baselineValue: labeled?.[1] || null,
      currentValue: null,
      evidenceScreenshot: fs.existsSync(walkPng)
        ? path.relative(ROOT, walkPng)
        : evidenceFor(fail.pageKey, currentDir),
      requiresHumanAcceptance: true,
      acceptanceStatus: 'pending',
      healAction: classification === 'expected' ? 'update-locator' : 'file-defect',
    });
  }

  const report: ChangeReport = {
    generatedAt: new Date().toISOString(),
    baselineId: manifest.baselineId,
    baselinePath: path.relative(ROOT, baselinePath),
    product: ENV.FIRELIGHT_PRODUCT,
    jurisdiction: ENV.FIRELIGHT_JURISDICTION,
    caseName: ENV.FIRELIGHT_CASE_NAME,
    summary: {
      total: allChanges.length,
      expected: allChanges.filter((c) => c.classification === 'expected').length,
      unexpected: allChanges.filter((c) => c.classification === 'unexpected').length,
      info: allChanges.filter((c) => c.classification === 'info').length,
    },
    changes: allChanges,
  };

  const outFile = path.join(REPORT_DIR, 'latest-change-report.json');
  const stamped = path.join(
    REPORT_DIR,
    `change-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  fs.writeFileSync(stamped, JSON.stringify(report, null, 2));
  for (const c of allChanges.filter((row) => row.classification === 'unexpected')) {
    writeDefectStub(c);
  }
  console.log(`Change report written: ${outFile}`);
  console.log(
    `Summary: total=${report.summary.total} expected=${report.summary.expected} unexpected=${report.summary.unexpected}`,
  );
  const scanned = [...currentByPage.values()].filter((s) => isScanned(s)).length;
  if (!currentDir && scanned === 0) {
    console.error(
      'Live detect scanned 0 wizard pages. Session may have expired or Start New was not visible. Run npm run auth:setup and retry. Screenshot: tests/reports/changes/evidence/detect-walk-failed.png',
    );
    process.exit(1);
  }
  for (const c of allChanges) {
    console.log(`  ${c.changeId} ${c.classification} ${c.changeType} ${c.page} ${c.fieldOrLocator}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
