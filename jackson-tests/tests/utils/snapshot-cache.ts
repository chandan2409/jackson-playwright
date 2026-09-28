import fs from 'fs';
import path from 'path';
import type { PageSnapshot } from './dom-snapshot';

const ROOT = path.resolve(__dirname, '../..');
export const SNAPSHOT_DIR = path.join(ROOT, 'tests/data/.snapshots');

export function writeCachedSnapshot(snap: PageSnapshot): void {
  if (!snap.scanned) return;
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  fs.writeFileSync(path.join(SNAPSHOT_DIR, `${snap.pageKey}.json`), JSON.stringify(snap, null, 2));
}

export function readCachedSnapshot(pageKey: string): PageSnapshot | null {
  const file = path.join(SNAPSHOT_DIR, `${pageKey}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as PageSnapshot;
}
