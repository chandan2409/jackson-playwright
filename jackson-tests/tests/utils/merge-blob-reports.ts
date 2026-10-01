import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = path.resolve(__dirname, '../..');
export const BLOB_RUNS_DIR = path.join(ROOT, 'blob-report', 'runs');
const STAGING_DIR = path.join(ROOT, 'blob-report', 'merge-staging');
const MERGED_REPORT = path.join(ROOT, 'playwright-report-all');

function collectZips(): string[] {
  if (!fs.existsSync(BLOB_RUNS_DIR)) return [];
  const zips: string[] = [];
  for (const run of fs.readdirSync(BLOB_RUNS_DIR)) {
    const dir = path.join(BLOB_RUNS_DIR, run);
    let st: fs.Stats;
    try {
      st = fs.statSync(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.zip')) zips.push(path.join(dir, file));
    }
  }
  return zips;
}

export function mergeBlobReports(): { merged: number; output: string } {
  const zips = collectZips();
  if (!zips.length) {
    console.log('No blob reports under blob-report/runs/ — run Script 1 or 2 first.');
    return { merged: 0, output: MERGED_REPORT };
  }

  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  fs.mkdirSync(STAGING_DIR, { recursive: true });
  zips.forEach((zip, i) => {
    const run = path.basename(path.dirname(zip));
    fs.copyFileSync(zip, path.join(STAGING_DIR, `${String(i).padStart(3, '0')}-${run}.zip`));
  });

  const result = spawnSync(
    path.join(ROOT, 'node_modules', '.bin', 'playwright'),
    ['merge-reports', STAGING_DIR, '--config', 'playwright.merge.config.ts'],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, CI: '1' } },
  );
  if ((result.status ?? 1) !== 0) {
    throw new Error(`playwright merge-reports exited ${result.status}`);
  }
  console.log(`Merged ${zips.length} blob report(s) → ${path.relative(ROOT, MERGED_REPORT)}`);
  return { merged: zips.length, output: MERGED_REPORT };
}

const invokedDirectly = path.basename(process.argv[1] || '') === 'merge-blob-reports.ts';
if (invokedDirectly) {
  try {
    mergeBlobReports();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
