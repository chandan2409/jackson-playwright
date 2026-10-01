import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const ROOT = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(ROOT, '.env') });

export const RUNS_DIR = path.join(ROOT, 'test-results', 'runs');
export const BLOB_RUNS_DIR = path.join(ROOT, 'blob-report', 'runs');
export const LATEST_FILE = path.join(ROOT, 'test-results', 'LATEST');
export const DEFAULT_RETENTION_DAYS = 14;

export function retentionDays(): number {
  const raw = process.env.ARTIFACT_RETENTION_DAYS;
  const n = raw === undefined || raw === '' ? DEFAULT_RETENTION_DAYS : Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_RETENTION_DAYS;
  return Math.floor(n);
}

export function createRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function ensureRunId(): string {
  if (!process.env.PW_RUN_ID) {
    process.env.PW_RUN_ID = createRunId();
  }
  return process.env.PW_RUN_ID;
}

export function runOutputDir(runId: string = ensureRunId()): string {
  return path.join(RUNS_DIR, runId);
}

export function recordLatest(runId: string): void {
  fs.mkdirSync(path.dirname(LATEST_FILE), { recursive: true });
  fs.writeFileSync(LATEST_FILE, runId + '\n');
}

function removeDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function pruneDirChildren(parent: string, days: number, keepRunId?: string): string[] {
  const removed: string[] = [];
  if (!fs.existsSync(parent)) return removed;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  for (const name of fs.readdirSync(parent)) {
    if (keepRunId && name === keepRunId) continue;
    const dir = path.join(parent, name);
    let st: fs.Stats;
    try {
      st = fs.statSync(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    if (st.mtimeMs >= cutoff) continue;
    removeDir(dir);
    removed.push(name);
  }
  return removed;
}

/** Delete `test-results/runs/` and `blob-report/runs/` folders older than `days`. */
export function pruneExpiredRuns(days: number = retentionDays(), keepRunId?: string): string[] {
  return [
    ...pruneDirChildren(RUNS_DIR, days, keepRunId).map((n) => `test-results/runs/${n}`),
    ...pruneDirChildren(BLOB_RUNS_DIR, days, keepRunId).map((n) => `blob-report/runs/${n}`),
  ];
}

function main() {
  const daysIdx = process.argv.indexOf('--days');
  const days =
    daysIdx !== -1 && process.argv[daysIdx + 1]
      ? Math.max(1, Math.floor(Number(process.argv[daysIdx + 1])) || retentionDays())
      : retentionDays();
  const removed = pruneExpiredRuns(days);
  console.log(`ARTIFACT_RETENTION_DAYS=${days}`);
  console.log(`Pruned ${removed.length} run folder(s) (test-results + blob-report)`);
  if (removed.length) console.log(removed.join('\n'));
}

const invokedDirectly = path.basename(process.argv[1] || '') === 'artifact-retention.ts';
if (invokedDirectly) {
  main();
}
