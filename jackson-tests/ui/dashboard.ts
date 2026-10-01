import fs from 'fs';
import path from 'path';
import { jiraUiStatus, listDefectNotes } from '../tests/utils/jira-file.ts';
import type { JobState } from './jobs.ts';
import { ROOT } from './root.ts';

const WIZARD_STEPS = [
  { key: 'select-application', label: 'Select' },
  { key: 'new-application-information', label: 'App info' },
  { key: 'owner', label: 'Owner' },
  { key: 'beneficiaries', label: 'Beneficiaries' },
  { key: 'agent', label: 'Agent' },
  { key: 'systematic-investment', label: 'Systematic' },
  { key: 'initial-allocations', label: 'Allocations' },
  { key: 'add-on-benefits', label: 'Add-ons' },
  { key: 'payment-detail', label: 'Payment' },
  { key: 'signing-process', label: 'Signing' },
];

type PageSnap = {
  pageKey: string;
  title?: string;
  elements?: unknown[];
  html?: string;
  htmlHash?: string;
  scanned?: boolean;
};

export type LastSpec = {
  id: string;
  title: string;
  file: string;
  status: string;
  duration: number | null;
};

type CoverageStep = {
  id: string;
  excelRow: number | null;
  requirement: string;
  page: string;
  action: string;
  field: string;
  happyValue?: string;
  variantValue?: string;
  testCases: string[];
  pom?: string;
  locatorEntry?: string | null;
  fixtureKey?: string | null;
  source?: string;
  implemented?: boolean;
  note?: string;
};

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function specStatusMap(specs: LastSpec[]): Record<string, LastSpec> {
  return Object.fromEntries(specs.map((s) => [s.id, s]));
}

function rollupStepStatus(results: Array<{ testId: string; status: string }>): string {
  if (!results.length) return 'not-run';
  if (results.some((r) => r.status === 'failed' || r.status === 'timedOut')) return 'failed';
  if (results.every((r) => r.status === 'passed')) return 'passed';
  if (results.every((r) => r.status === 'not-run' || r.status === 'skipped')) return results[0]?.status || 'not-run';
  return 'partial';
}

function collectSpecs(node: unknown, out: LastSpec[] = []): LastSpec[] {
  if (!node || typeof node !== 'object') return out;
  const rec = node as Record<string, unknown>;
  if (Array.isArray(rec.specs)) {
    for (const spec of rec.specs as Array<{
      title?: string;
      file?: string;
      tests?: Array<{ results?: Array<{ status?: string; duration?: number }> }>;
    }>) {
      const result = spec.tests?.[0]?.results?.[0];
      if (!spec.title || !result?.status) continue;
      const id = spec.title.match(/\[(FL-[A-Z]+-\d+)\]/)?.[1] || spec.title;
      out.push({
        id,
        title: spec.title,
        file: spec.file || '',
        status: result.status,
        duration: typeof result.duration === 'number' ? result.duration : null,
      });
    }
  }
  if (Array.isArray(rec.suites)) {
    for (const kid of rec.suites) collectSpecs(kid, out);
  }
  return out;
}

function locatorBundle(dir: string) {
  if (!fs.existsSync(dir)) return {};
  const out: Record<string, unknown> = {};
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.locators.json'))) {
    out[file] = readJson(path.join(dir, file));
  }
  return out;
}

function loadLivePages(liveDir: string) {
  const liveManifest =
    liveDir && fs.existsSync(path.join(liveDir, 'manifest.json'))
      ? (readJson(path.join(liveDir, 'manifest.json')) as { pages: string[]; baselineId: string; capturedAt: string })
      : null;

  const livePages = (liveManifest?.pages || []).map((pageKey) => {
    const file = path.join(liveDir, `${pageKey}.json`);
    if (!fs.existsSync(file)) {
      return { pageKey, title: '(missing)', elementCount: 0, stub: true };
    }
    const snap = readJson(file) as PageSnap;
    const title = snap.title || pageKey;
    const htmlChars = snap.html?.length ?? 0;
    const stub =
      snap.scanned === false ||
      /pending|scaffold|did not reach|missing snapshot/i.test(title) ||
      (!(snap.elements && snap.elements.length) && !htmlChars);
    return {
      pageKey,
      title,
      elementCount: snap.elements?.length ?? 0,
      htmlChars,
      scanned: snap.scanned !== false && !stub,
      stub,
    };
  });

  return { liveManifest, livePages };
}

function loadLastRun() {
  const lastRunPath = path.join(ROOT, 'tests/reports/last-run.json');
  if (!fs.existsSync(lastRunPath)) return null;
  const raw = JSON.parse(fs.readFileSync(lastRunPath, 'utf8')) as {
    stats?: { expected?: number; unexpected?: number; skipped?: number; duration?: number };
    suites?: unknown[];
  };
  const specs = collectSpecs({ suites: raw.suites });
  const primary = specs.find((s) => s.id.startsWith('FL-')) || specs[0];
  return {
    status: raw.stats?.unexpected ? 'failed' : primary?.status,
    test: primary?.title,
    stats: raw.stats,
    specs,
  };
}

function loadCoverage(bySpec: Record<string, LastSpec>) {
  const coveragePath = path.join(ROOT, 'tests/data/coverage-matrix.json');
  if (!fs.existsSync(coveragePath)) return null;
  const coverageRaw = readJson(coveragePath) as {
    source: string;
    product: string;
    jurisdiction: string;
    caseName: string;
    excelStepCount: number;
    pages: string[];
    scripts: Array<{ id: string; file: string; path: string; title?: string; coversExcel?: string[] }>;
    steps?: CoverageStep[];
  };
  const coverageSteps = (coverageRaw.steps || []).map((step) => {
    const results = step.testCases.map((testId) => ({
      testId,
      status: bySpec[testId]?.status || 'not-run',
      durationMs: bySpec[testId]?.duration ?? null,
    }));
    return { ...step, results, lastStatus: rollupStepStatus(results) };
  });
  return {
    ...coverageRaw,
    scripts: coverageRaw.scripts.map((script) => {
      const hit = bySpec[script.id];
      return {
        ...script,
        lastStatus: hit?.status || 'not-run',
        lastTitle: hit?.title || script.title || '',
        lastDurationMs: hit?.duration ?? null,
        coveredStepCount: coverageSteps.filter((step) => step.testCases.includes(script.id)).length,
      };
    }),
    steps: coverageSteps,
    summary: {
      excelSteps: coverageRaw.excelStepCount,
      mappedSteps: coverageSteps.filter((s) => s.source !== 'live-wizard').length,
      liveOnlySteps: coverageSteps.filter((s) => s.source === 'live-wizard').length,
      implemented: coverageSteps.filter((s) => s.implemented !== false && s.source !== 'live-wizard').length,
      passed: coverageSteps.filter((s) => s.lastStatus === 'passed').length,
      failed: coverageSteps.filter((s) => s.lastStatus === 'failed').length,
      partial: coverageSteps.filter((s) => s.lastStatus === 'partial').length,
      notRun: coverageSteps.filter((s) => s.lastStatus === 'not-run' || s.lastStatus === 'skipped').length,
    },
  };
}

function reportField(report: unknown, key: string, fallback: string): string {
  if (report && typeof report === 'object' && key in report) {
    const value = (report as Record<string, unknown>)[key];
    if (typeof value === 'string') return value;
  }
  return fallback;
}

function htmlLink(file: string, href: string) {
  return fs.existsSync(file) ? { available: true, href } : { available: false, href: null };
}

export function loadDashboard(job: JobState) {
  const reportPath = path.join(ROOT, 'tests/reports/changes/latest-change-report.json');
  const report = fs.existsSync(reportPath) ? readJson(reportPath) : null;

  const currentId = fs.existsSync(path.join(ROOT, 'tests/data/baselines/CURRENT'))
    ? fs.readFileSync(path.join(ROOT, 'tests/data/baselines/CURRENT'), 'utf8').trim()
    : '';
  const liveDir = currentId ? path.join(ROOT, 'tests/data/baselines', currentId) : '';
  const { liveManifest, livePages } = loadLivePages(liveDir);
  const lastRun = loadLastRun();
  const coverage = loadCoverage(specStatusMap(lastRun?.specs || []));

  return {
    generatedAt: new Date().toISOString(),
    phase: 'D',
    product: reportField(report, 'product', 'Elite Access II'),
    jurisdiction: reportField(report, 'jurisdiction', 'Colorado'),
    caseName: reportField(report, 'caseName', 'Boun'),
    wizard: WIZARD_STEPS.map((step) => {
      const page = livePages.find((p) => p.pageKey === step.key);
      if (!page) return { ...step, status: 'missing', elementCount: 0 };
      if (page.stub) return { ...step, status: 'stub', elementCount: page.elementCount };
      return { ...step, status: 'captured', elementCount: page.elementCount };
    }),
    job,
    report,
    liveBaseline: liveManifest
      ? { id: liveManifest.baselineId, capturedAt: liveManifest.capturedAt, pages: livePages }
      : null,
    rehearsalLocators: locatorBundle(path.join(ROOT, 'tests/data/rehearsal/locators')),
    liveLocators: locatorBundle(path.join(ROOT, 'tests/pages/firelight')),
    defects: listDefectNotes(),
    jira: jiraUiStatus(),
    lastRun,
    coverage,
    htmlReport: htmlLink(path.join(ROOT, 'playwright-report/index.html'), '/playwright-report/index.html'),
    htmlReportAll: htmlLink(path.join(ROOT, 'playwright-report-all/index.html'), '/playwright-report-all/index.html'),
  };
}

export function readJsonFile(file: string): unknown {
  return readJson(file);
}
