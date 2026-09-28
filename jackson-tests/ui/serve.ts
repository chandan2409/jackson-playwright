import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { fileURLToPath } from 'url';
import { createJiraForDefect, jiraUiStatus, listDefectNotes, writeDefectStub } from '../tests/utils/jira-file.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UI_DIR = path.join(ROOT, 'ui');
const PORT = Number(process.env.UI_PORT || 5173);

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

type JobState = {
  name: string;
  running: boolean;
  log: string;
  exitCode: number | null;
  startedAt: string | null;
  finishedAt: string | null;
};

const job: JobState = {
  name: '',
  running: false,
  log: '',
  exitCode: null,
  startedAt: null,
  finishedAt: null,
};

let child: ChildProcessWithoutNullStreams | null = null;

const ALLOWED_NPM: Record<string, string[]> = {
  script1: ['run', 'test:script1'],
  script2: ['run', 'test:script2'],
  baseline: ['run', 'baseline:capture'],
  'detect-rehearse': ['run', 'detect:rehearse'],
  'detect-live': ['run', 'detect:changes'],
};

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

type LastSpec = {
  id: string;
  title: string;
  file: string;
  status: string;
  duration: number | null;
};

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

function loadDashboard() {
  const reportPath = path.join(ROOT, 'tests/reports/changes/latest-change-report.json');
  const report = fs.existsSync(reportPath) ? readJson(reportPath) : null;

  const currentId = fs.existsSync(path.join(ROOT, 'tests/data/baselines/CURRENT'))
    ? fs.readFileSync(path.join(ROOT, 'tests/data/baselines/CURRENT'), 'utf8').trim()
    : '';
  const liveDir = currentId ? path.join(ROOT, 'tests/data/baselines', currentId) : '';
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

  function locatorBundle(dir: string) {
    if (!fs.existsSync(dir)) return {};
    const out: Record<string, unknown> = {};
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.locators.json'))) {
      out[file] = readJson(path.join(dir, file));
    }
    return out;
  }

  const rehearsalLocators = locatorBundle(path.join(ROOT, 'tests/data/rehearsal/locators'));
  const liveLocators = locatorBundle(path.join(ROOT, 'tests/pages/firelight'));

  const defects = listDefectNotes();

  const lastRunPath = path.join(ROOT, 'tests/reports/last-run.json');
  let lastRun: {
    status?: string;
    test?: string;
    stats?: { expected?: number; unexpected?: number; skipped?: number; duration?: number };
    specs: LastSpec[];
  } | null = null;
  if (fs.existsSync(lastRunPath)) {
    const raw = JSON.parse(fs.readFileSync(lastRunPath, 'utf8')) as {
      stats?: { expected?: number; unexpected?: number; skipped?: number; duration?: number };
      suites?: unknown[];
    };
    const specs = collectSpecs({ suites: raw.suites });
    const primary = specs.find((s) => s.id.startsWith('FL-')) || specs[0];
    lastRun = {
      status: raw.stats?.unexpected ? 'failed' : primary?.status,
      test: primary?.title,
      stats: raw.stats,
      specs,
    };
  }

  const coveragePath = path.join(ROOT, 'tests/data/coverage-matrix.json');
  const coverageRaw = fs.existsSync(coveragePath)
    ? (readJson(coveragePath) as {
        source: string;
        product: string;
        jurisdiction: string;
        caseName: string;
        excelStepCount: number;
        pages: string[];
        scripts: Array<{ id: string; file: string; path: string }>;
      })
    : null;
  const coverage = coverageRaw
    ? {
        ...coverageRaw,
        scripts: coverageRaw.scripts.map((script) => {
          const hit = lastRun?.specs.find((s) => s.id === script.id);
          return {
            ...script,
            lastStatus: hit?.status || 'not-run',
            lastTitle: hit?.title || '',
            lastDurationMs: hit?.duration ?? null,
          };
        }),
      }
    : null;

  const htmlReportReady = fs.existsSync(path.join(ROOT, 'playwright-report/index.html'));

  return {
    generatedAt: new Date().toISOString(),
    phase: 'D',
    product: report && typeof report === 'object' && 'product' in report ? (report as { product: string }).product : 'Elite Access II',
    jurisdiction:
      report && typeof report === 'object' && 'jurisdiction' in report
        ? (report as { jurisdiction: string }).jurisdiction
        : 'Colorado',
    caseName:
      report && typeof report === 'object' && 'caseName' in report ? (report as { caseName: string }).caseName : 'Boun',
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
    rehearsalLocators,
    liveLocators,
    defects,
    jira: jiraUiStatus(),
    lastRun,
    coverage,
    htmlReport: htmlReportReady
      ? { available: true, href: '/playwright-report/index.html' }
      : { available: false, href: null },
  };
}

function appendLog(chunk: Buffer | string) {
  job.log += chunk.toString();
  if (job.log.length > 80_000) job.log = job.log.slice(-80_000);
}

function startProcess(command: string, args: string[], name: string) {
  if (job.running) throw new Error('A job is already running');
  job.name = name;
  job.running = true;
  job.log = `$ ${command} ${args.join(' ')}\n`;
  job.exitCode = null;
  job.startedAt = new Date().toISOString();
  job.finishedAt = null;

  child = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: '0' },
    shell: false,
  });
  child.stdout.on('data', appendLog);
  child.stderr.on('data', appendLog);
  child.on('close', (code) => {
    job.running = false;
    job.exitCode = code;
    job.finishedAt = new Date().toISOString();
    appendLog(`\n[exit ${code}]\n`);
    child = null;
  });
  child.on('error', (err) => {
    job.running = false;
    job.exitCode = 1;
    job.finishedAt = new Date().toISOString();
    appendLog(`\n${err.message}\n`);
    child = null;
  });
}

function startNpm(name: string, args: string[]) {
  startProcess('npm', args, name);
}

function startBin(command: string, name: string, args: string[]) {
  startProcess(command, args, name);
}

function validChangeIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === 'string' && /^CHG-\d{3}$/.test(id));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/api/dashboard') {
    json(res, 200, loadDashboard());
    return;
  }

  if (url.pathname === '/api/export.md' && req.method === 'GET') {
    const dash = loadDashboard() as ReturnType<typeof loadDashboard> & {
      report: {
        baselineId?: string;
        product?: string;
        jurisdiction?: string;
        caseName?: string;
        generatedAt?: string;
        summary?: { total: number; expected: number; unexpected: number };
        changes?: Array<{
          changeId: string;
          classification: string;
          changeType: string;
          page: string;
          fieldOrLocator: string;
          matchedTicketId?: string | null;
          description: string;
          acceptanceStatus?: string;
          healAction?: string | null;
        }>;
      } | null;
      defects: Array<{ id: string; body: string }>;
    };
    const r = dash.report;
    const lines = [
      '# Jackson Firelight change report',
      '',
      `- Product: ${dash.product}`,
      `- Jurisdiction: ${dash.jurisdiction}`,
      `- Case: ${dash.caseName}`,
      `- Baseline: ${r?.baselineId || 'n/a'}`,
      `- Generated: ${r?.generatedAt || dash.generatedAt}`,
      `- Summary: ${r?.summary?.total ?? 0} total · ${r?.summary?.expected ?? 0} expected · ${r?.summary?.unexpected ?? 0} unexpected`,
      '',
      '| ID | Class | Type | Page | Field | HITL | Heal |',
      '|----|-------|------|------|-------|------|------|',
    ];
    for (const c of r?.changes || []) {
      lines.push(
        `| ${c.changeId} | ${c.classification} | ${c.changeType} | ${c.page} | ${c.fieldOrLocator} | ${c.acceptanceStatus || 'pending'} | ${c.healAction || ''} |`,
      );
    }
    lines.push('', '## Defects', '');
    for (const d of dash.defects) {
      lines.push(d.body, '');
    }
    res.writeHead(200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="jackson-change-report.md"',
    });
    res.end(lines.join('\n'));
    return;
  }

  if (url.pathname === '/api/jira' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}') as { changeIds?: string[] };
      const reportPath = path.join(ROOT, 'tests/reports/changes/latest-change-report.json');
      const report = fs.existsSync(reportPath)
        ? (readJson(reportPath) as {
            changes?: Array<{
              changeId: string;
              page?: string;
              fieldOrLocator?: string;
              severity?: string;
              changeType?: string;
              classification?: string;
              description?: string;
              evidenceScreenshot?: string;
            }>;
          })
        : { changes: [] };
      const unexpected = (report.changes || []).filter((c) => c.classification === 'unexpected').map((c) => c.changeId);
      let ids = validChangeIds(body.changeIds);
      if (ids.length === 0) ids = unexpected.filter((id) => !listDefectNotes().find((d) => d.id === id)?.jiraKey);
      if (ids.length === 0) ids = listDefectNotes().filter((d) => !d.jiraKey).map((d) => d.id);
      if (ids.length === 0) {
        json(res, 400, { error: 'No unexpected defects left to file (or they already have a Jira key)' });
        return;
      }
      const results = [];
      for (const id of ids) {
        const change = (report.changes || []).find((c) => c.changeId === id);
        if (change) writeDefectStub(change);
        try {
          results.push({ id, ...(await createJiraForDefect(id)) });
        } catch (err) {
          results.push({ id, error: err instanceof Error ? err.message : String(err) });
        }
      }
      json(res, 200, { results, jira: jiraUiStatus(), defects: listDefectNotes() });
    } catch (err) {
      json(res, 400, { error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (url.pathname === '/api/job') {
    json(res, 200, job);
    return;
  }

  if (url.pathname === '/api/run' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}') as {
        script?: string;
        live?: boolean;
        accept?: string[];
        reject?: string[];
      };
      const script = body.script || '';

      if (script === 'heal') {
        const accept = validChangeIds(body.accept);
        const reject = validChangeIds(body.reject);
        if (accept.length === 0 && reject.length === 0) {
          json(res, 400, { error: 'HITL required: select at least one change to accept or reject' });
          return;
        }
        const tsx = path.join(ROOT, 'node_modules', '.bin', 'tsx');
        const args = ['tests/utils/apply-heal-acceptance.ts'];
        if (accept.length) args.push('--accept', accept.join(','));
        if (reject.length) args.push('--reject', reject.join(','));
        if (!body.live) args.push('--locators-dir', 'tests/data/rehearsal/locators');
        startBin(tsx, 'heal', args);
        json(res, 202, job);
        return;
      }

      const npmArgs = ALLOWED_NPM[script];
      if (!npmArgs) {
        json(res, 400, { error: `Unknown script "${script}"` });
        return;
      }
      if ((script === 'detect-live' || script === 'script1' || script === 'script2' || script === 'baseline') && !body.live) {
        json(res, 400, { error: 'Turn on Live Firelight to run this command' });
        return;
      }
      startNpm(script, npmArgs);
      json(res, 202, job);
    } catch (err) {
      json(res, 409, { error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  const extraRoots: Array<{ prefix: string; dir: string }> = [
    { prefix: '/playwright-report/', dir: path.join(ROOT, 'playwright-report') },
    { prefix: '/test-results/', dir: path.join(ROOT, 'test-results') },
  ];
  for (const extra of extraRoots) {
    if (url.pathname === extra.prefix.slice(0, -1) || url.pathname.startsWith(extra.prefix)) {
      let rel = url.pathname.startsWith(extra.prefix)
        ? decodeURIComponent(url.pathname.slice(extra.prefix.length))
        : 'index.html';
      if (!rel || rel.endsWith('/')) rel = `${rel}index.html`;
      const file = path.normalize(path.join(extra.dir, rel || 'index.html'));
      if (!file.startsWith(extra.dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end('Playwright HTML report not generated yet. Run Script 1 or Script 2.');
        return;
      }
      const ext = path.extname(file);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
      return;
    }
  }

  const relative = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.normalize(path.join(UI_DIR, relative));
  if (!file.startsWith(UI_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Jackson Firelight change review → http://127.0.0.1:${PORT}`);
});
