import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';
import ENV from './env';
import {
  captureCurrentPage,
  elementKey,
  fingerprint,
  hashHtml,
  isScanned,
  unscannedSnapshot,
  type PageSnapshot,
  type DomElementSnapshot,
} from './dom-snapshot';
import { happyPathData, runFirelightWizard } from './wizard-flow';
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
  ) => {
    const labels = [baseEl?.label, currEl?.label, key].filter(Boolean) as string[];
    const { classification, matchedTicketId } = classify(pageKey, key, tickets, labels);
    changes.push({
      changeId: nextId(counter),
      page: pageKey,
      fieldOrLocator: key,
      changeType,
      severity: severityFor(changeType),
      classification,
      matchedTicketId,
      description,
      baselineValue: values?.baselineValue ?? (baseEl ? fingerprint(baseEl) : null),
      currentValue: values?.currentValue ?? (currEl ? fingerprint(currEl) : null),
      evidenceScreenshot: '',
      requiresHumanAcceptance: true,
      acceptanceStatus: 'pending',
      healAction: classification === 'expected' ? 'update-locator' : 'file-defect',
    });
  };

  for (const [key, baseEl] of baseMap) {
    const currEl = currMap.get(key);
    if (!currEl) {
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

  const pageKeys = Array.from(new Set([...(manifest.pages as string[]), ...WIZARD_PAGES]));
  if (currentDir) {
    for (const pageKey of pageKeys) {
      currentByPage.set(pageKey, loadSnap(path.join(currentDir, `${pageKey}.json`), pageKey));
    }
  } else if (ENV.FIRELIGHT_USERNAME && fs.existsSync(AUTH)) {
    const browser = await chromium.launch();
    const context = await browser.newContext({ storageState: AUTH });
    const page = await context.newPage();
    try {
      await runFirelightWizard(page, happyPathData, async (pageKey) => {
        currentByPage.set(pageKey, await captureCurrentPage(page, pageKey));
        await page.screenshot({ path: path.join(EVIDENCE_DIR, `${pageKey}.png`), fullPage: true });
        console.log(`Scanned ${pageKey}`);
      });
    } catch (err) {
      console.warn('Detect wizard walk stopped early:', err);
    } finally {
      await browser.close();
    }
  }

  for (const pageKey of pageKeys) {
    const baselineFile = path.join(baselinePath, `${pageKey}.json`);
    const baselineSnap = loadSnap(baselineFile, pageKey);
    const current = currentByPage.get(pageKey) || unscannedSnapshot(pageKey, `(not scanned) ${pageKey}`);

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
  console.log(`Change report written: ${outFile}`);
  console.log(
    `Summary: total=${report.summary.total} expected=${report.summary.expected} unexpected=${report.summary.unexpected}`,
  );
  for (const c of allChanges) {
    console.log(`  ${c.changeId} ${c.classification} ${c.changeType} ${c.page} ${c.fieldOrLocator}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
