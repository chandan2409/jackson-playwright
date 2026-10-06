import fs from 'fs';
import http from 'http';
import path from 'path';
import { createJiraForDefect, jiraUiStatus, listDefectNotes, writeDefectStub } from '../tests/utils/jira-file.ts';
import { loadDashboard, readJsonFile } from './dashboard.ts';
import { dashboardMarkdown } from './export-md.ts';
import { json, readBody, sendFile, validChangeIds } from './http.ts';
import { job, startBin, startNpm } from './jobs.ts';
import { PORT, ROOT, UI_DIR } from './root.ts';

const ALLOWED_NPM: Record<string, string[]> = {
  script1: ['run', 'test:script1'],
  script2: ['run', 'test:script2'],
  baseline: ['run', 'baseline:capture'],
  'detect-rehearse': ['run', 'detect:rehearse'],
  'detect-live': ['run', 'detect:changes'],
};

async function handleJira(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const body = JSON.parse((await readBody(req)) || '{}') as { changeIds?: string[] };
    const reportPath = path.join(ROOT, 'tests/reports/changes/latest-change-report.json');
    const report = fs.existsSync(reportPath)
      ? (readJsonFile(reportPath) as {
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
    const unexpected = (report.changes || []).filter((c) => c.classification === 'unexpected');
    const unexpectedIds = new Set(unexpected.map((c) => c.changeId));
    let ids = validChangeIds(body.changeIds).filter((id) => unexpectedIds.has(id));
    if (ids.length === 0) {
      ids = unexpected.map((c) => c.changeId).filter((id) => !listDefectNotes().find((d) => d.id === id)?.jiraKey);
    }
    if (ids.length === 0) {
      json(res, 400, { error: 'No unexpected defects left to file (or they already have a Jira key). Expected/accepted heals are not filed to Jira.' });
      return;
    }
    const results = [];
    for (const id of ids) {
      const change = (report.changes || []).find((c) => c.changeId === id);
      if (change) writeDefectStub(change);
      try {
        results.push({ id, ...(await createJiraForDefect(id, change?.evidenceScreenshot)) });
      } catch (err) {
        results.push({ id, error: err instanceof Error ? err.message : String(err) });
      }
    }
    json(res, 200, { results, jira: jiraUiStatus(), defects: listDefectNotes() });
  } catch (err) {
    json(res, 400, { error: err instanceof Error ? err.message : String(err) });
  }
}

async function handleRun(req: http.IncomingMessage, res: http.ServerResponse) {
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
    if ((script === 'detect-live' || script === 'baseline') && !body.live) {
      json(res, 400, { error: 'Turn on Live Firelight to run this command' });
      return;
    }
    startNpm(script, npmArgs);
    json(res, 202, job);
  } catch (err) {
    json(res, 409, { error: err instanceof Error ? err.message : String(err) });
  }
}

function handleExtraRoots(url: URL, res: http.ServerResponse): boolean {
  const extraRoots: Array<{ prefix: string; dir: string }> = [
    { prefix: '/playwright-report/', dir: path.join(ROOT, 'playwright-report') },
    { prefix: '/playwright-report-all/', dir: path.join(ROOT, 'playwright-report-all') },
    { prefix: '/evidence/', dir: path.join(ROOT, 'tests/reports/changes/evidence') },
    { prefix: '/baseline-png/', dir: path.join(ROOT, 'tests/data/baselines') },
  ];
  for (const extra of extraRoots) {
    if (url.pathname === extra.prefix.slice(0, -1) || url.pathname.startsWith(extra.prefix)) {
      let rel = url.pathname.startsWith(extra.prefix)
        ? decodeURIComponent(url.pathname.slice(extra.prefix.length))
        : 'index.html';
      if (!rel || rel.endsWith('/')) rel = `${rel}index.html`;
      if (extra.prefix === '/baseline-png/' && !rel.toLowerCase().endsWith('.png')) {
        res.writeHead(404);
        res.end('Baseline screenshot not found.');
        return true;
      }
      sendFile(res, extra.dir, rel, 'Playwright HTML report not generated yet. Run Script 1 or Script 2.');
      return true;
    }
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/api/dashboard') {
    json(res, 200, loadDashboard(job));
    return;
  }

  if (url.pathname === '/api/export.md' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="jackson-change-report.md"',
    });
    res.end(dashboardMarkdown(loadDashboard(job)));
    return;
  }

  if (url.pathname === '/api/jira' && req.method === 'POST') {
    await handleJira(req, res);
    return;
  }

  if (url.pathname === '/api/job') {
    json(res, 200, job);
    return;
  }

  if (url.pathname === '/api/run' && req.method === 'POST') {
    await handleRun(req, res);
    return;
  }

  if (handleExtraRoots(url, res)) return;

  const relative = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
  sendFile(res, UI_DIR, relative, 'Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Jackson Firelight change review → http://127.0.0.1:${PORT}`);
});
