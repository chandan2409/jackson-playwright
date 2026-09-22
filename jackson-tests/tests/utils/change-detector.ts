import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';
import ENV from './env';
import type { PageSnapshot, DomElementSnapshot } from './baseline-capture';

const ROOT = path.resolve(__dirname, '../..');
const BASELINE_DIR = path.join(ROOT, 'tests/data/baselines');
const REPORT_DIR = path.join(ROOT, 'tests/reports/changes');
const EVIDENCE_DIR = path.join(REPORT_DIR, 'evidence');
const AUTH = path.join(ROOT, '.auth/firelight-state.json');

type Classification = 'expected' | 'unexpected' | 'info';
type Severity = 'low' | 'medium' | 'high' | 'critical';

type ChangeRecord = {
  changeId: string;
  page: string;
  fieldOrLocator: string;
  changeType: 'added' | 'removed' | 'modified' | 'relocated' | 'label-changed' | 'option-changed';
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

function elementKey(el: DomElementSnapshot): string {
  return [el.label, el.nameAttr, el.id, el.testId, el.text].filter(Boolean).join('|') || el.name;
}

function fingerprint(el: DomElementSnapshot): string {
  return JSON.stringify({
    tag: el.tag,
    label: el.label,
    type: el.type,
    options: el.options,
    text: el.text,
  });
}

function classify(
  page: string,
  field: string,
  tickets: ChangeTickets,
): { classification: Classification; matchedTicketId: string | null } {
  const match = (tickets.announcedChanges || []).find((t) => {
    const pageMatch = t.page.toLowerCase() === page.toLowerCase() || page.includes(t.page.toLowerCase());
    const fieldMatch = !t.field || field.toLowerCase().includes(t.field.toLowerCase());
    return pageMatch && fieldMatch;
  });
  if (match) return { classification: 'expected', matchedTicketId: match.ticketId };
  return { classification: 'unexpected', matchedTicketId: null };
}

function severityFor(changeType: ChangeRecord['changeType']): Severity {
  switch (changeType) {
    case 'removed':
      return 'high';
    case 'label-changed':
    case 'option-changed':
      return 'medium';
    case 'added':
      return 'low';
    default:
      return 'medium';
  }
}

function diffPage(
  pageKey: string,
  baseline: PageSnapshot,
  current: PageSnapshot,
  tickets: ChangeTickets,
  counter: { n: number },
): ChangeRecord[] {
  const changes: ChangeRecord[] = [];
  const baseMap = new Map(baseline.elements.map((e) => [elementKey(e), e]));
  const currMap = new Map(current.elements.map((e) => [elementKey(e), e]));

  for (const [key, baseEl] of baseMap) {
    const currEl = currMap.get(key);
    if (!currEl) {
      counter.n += 1;
      const { classification, matchedTicketId } = classify(pageKey, key, tickets);
      changes.push({
        changeId: `CHG-${String(counter.n).padStart(3, '0')}`,
        page: pageKey,
        fieldOrLocator: key,
        changeType: 'removed',
        severity: severityFor('removed'),
        classification,
        matchedTicketId,
        description: `Element present in baseline missing in current UI: ${key}`,
        baselineValue: fingerprint(baseEl),
        currentValue: null,
        evidenceScreenshot: '',
        requiresHumanAcceptance: true,
        acceptanceStatus: 'pending',
        healAction: classification === 'expected' ? 'update-locator' : 'file-defect',
      });
      continue;
    }
    if (fingerprint(baseEl) !== fingerprint(currEl)) {
      counter.n += 1;
      const changeType =
        baseEl.label !== currEl.label
          ? 'label-changed'
          : JSON.stringify(baseEl.options) !== JSON.stringify(currEl.options)
            ? 'option-changed'
            : 'modified';
      const { classification, matchedTicketId } = classify(pageKey, key, tickets);
      changes.push({
        changeId: `CHG-${String(counter.n).padStart(3, '0')}`,
        page: pageKey,
        fieldOrLocator: key,
        changeType,
        severity: severityFor(changeType),
        classification,
        matchedTicketId,
        description: `Element changed on ${pageKey}: ${key}`,
        baselineValue: fingerprint(baseEl),
        currentValue: fingerprint(currEl),
        evidenceScreenshot: '',
        requiresHumanAcceptance: true,
        acceptanceStatus: 'pending',
        healAction: classification === 'expected' ? 'update-locator' : 'file-defect',
      });
    }
  }

  for (const [key, currEl] of currMap) {
    if (baseMap.has(key)) continue;
    counter.n += 1;
    const { classification, matchedTicketId } = classify(pageKey, key, tickets);
    changes.push({
      changeId: `CHG-${String(counter.n).padStart(3, '0')}`,
      page: pageKey,
      fieldOrLocator: key,
      changeType: 'added',
      severity: severityFor('added'),
      classification,
      matchedTicketId,
      description: `New element not in baseline: ${key}`,
      baselineValue: null,
      currentValue: fingerprint(currEl),
      evidenceScreenshot: '',
      requiresHumanAcceptance: true,
      acceptanceStatus: 'pending',
      healAction: classification === 'expected' ? 'update-locator' : 'file-defect',
    });
  }

  return changes;
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  const baselineId = fs.existsSync(path.join(BASELINE_DIR, 'CURRENT'))
    ? fs.readFileSync(path.join(BASELINE_DIR, 'CURRENT'), 'utf8').trim()
    : '';
  if (!baselineId) {
    console.error('No baseline. Run: npm run baseline:capture');
    process.exit(1);
  }

  const baselinePath = path.join(BASELINE_DIR, baselineId);
  const manifest = JSON.parse(fs.readFileSync(path.join(baselinePath, 'manifest.json'), 'utf8'));
  const ticketsPath = path.resolve(ROOT, ENV.CHANGE_TICKETS_PATH);
  const tickets: ChangeTickets = fs.existsSync(ticketsPath)
    ? JSON.parse(fs.readFileSync(ticketsPath, 'utf8'))
    : { announcedChanges: [] };

  const allChanges: ChangeRecord[] = [];
  const counter = { n: 0 };

  const canBrowse = Boolean(ENV.FIRELIGHT_USERNAME && fs.existsSync(AUTH));
  let browser;
  let page;

  if (canBrowse) {
    browser = await chromium.launch();
    const context = await browser.newContext({ storageState: AUTH });
    page = await context.newPage();
    await page.goto(ENV.FIRELIGHT_BASE_URL);
    await page.waitForLoadState('domcontentloaded');
  }

  for (const pageKey of manifest.pages as string[]) {
    const baselineSnap: PageSnapshot = JSON.parse(
      fs.readFileSync(path.join(baselinePath, `${pageKey}.json`), 'utf8'),
    );

    let current: PageSnapshot = {
      pageKey,
      url: page?.url() || '',
      capturedAt: new Date().toISOString(),
      title: pageKey,
      elements: [],
    };

    if (page && pageKey === 'select-application') {
      current = {
        pageKey,
        url: page.url(),
        capturedAt: new Date().toISOString(),
        title: await page.title(),
        elements: await page.evaluate(() => {
          const nodes = Array.from(
            document.querySelectorAll('input, select, textarea, button, [role="button"], [role="combobox"], a'),
          );
          return nodes.slice(0, 400).map((el, idx) => {
            const html = el as HTMLElement;
            const labelEl =
              (html.id && document.querySelector(`label[for="${html.id}"]`)) ||
              html.closest('label');
            return {
              name: html.getAttribute('name') || html.id || `el_${idx}`,
              tag: html.tagName.toLowerCase(),
              text: (html.innerText || html.textContent || '').trim().slice(0, 120),
              label: labelEl?.textContent?.trim() || html.getAttribute('aria-label') || null,
              id: html.id || null,
              testId: html.getAttribute('data-testid'),
              nameAttr: html.getAttribute('name'),
              classes: Array.from(html.classList),
              type: html.getAttribute('type'),
              options:
                html.tagName.toLowerCase() === 'select'
                  ? Array.from((html as HTMLSelectElement).options).map((o) => o.text.trim())
                  : undefined,
            };
          });
        }),
      };
      const shot = path.join(EVIDENCE_DIR, `${pageKey}.png`);
      await page.screenshot({ path: shot, fullPage: true });
    }

    const pageChanges = diffPage(pageKey, baselineSnap, current, tickets, counter);
    for (const c of pageChanges) {
      c.evidenceScreenshot = path.relative(ROOT, path.join(EVIDENCE_DIR, `${pageKey}.png`));
    }
    allChanges.push(...pageChanges);
  }

  if (browser) await browser.close();

  const report: ChangeReport = {
    generatedAt: new Date().toISOString(),
    baselineId,
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
