/**
 * Open Change review (if needed) and run a Playwright spec headed against live Firelight.
 * CI stays headless and does not open a browser.
 */
import { spawn, spawnSync } from 'child_process';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { pruneExpiredRuns, retentionDays } from '../tests/utils/artifact-retention';
import { mergeBlobReports } from '../tests/utils/merge-blob-reports';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.UI_PORT || 5173);
const UI_URL = `http://127.0.0.1:${PORT}`;
const spec = process.argv[2];

if (!spec) {
  console.error('Usage: tsx ui/run-live.ts <spec-file>');
  process.exit(1);
}

function portOpen(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port: PORT }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

function openBrowser(url: string) {
  if (process.platform === 'darwin') spawn('open', [url], { stdio: 'ignore' }).unref();
  else if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore' }).unref();
  else spawn('xdg-open', [url], { stdio: 'ignore' }).unref();
}

async function ensureUi() {
  if (process.env.CI || process.env.SKIP_OPEN_UI) return;
  if (!(await portOpen())) {
    const tsx = path.join(ROOT, 'node_modules', '.bin', 'tsx');
    const child = spawn(tsx, ['ui/serve.ts'], {
      cwd: ROOT,
      env: process.env,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      if (await portOpen()) break;
    }
  }
  if (await portOpen()) openBrowser(UI_URL);
}

async function main() {
  const pruned = pruneExpiredRuns(retentionDays());
  if (pruned.length) {
    console.log(`Pruned ${pruned.length} artifact run(s) older than ${retentionDays()} day(s)`);
  }
  await ensureUi();
  const headed = process.env.CI ? [] : ['--headed'];
  const result = spawnSync(
    path.join(ROOT, 'node_modules/.bin/playwright'),
    ['test', spec, ...headed],
    { cwd: ROOT, stdio: 'inherit', env: process.env },
  );
  try {
    mergeBlobReports();
  } catch (err) {
    console.warn('Could not merge historical HTML report:', err);
  }
  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

