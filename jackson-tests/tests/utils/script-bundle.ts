import fs from 'fs';
import path from 'path';
import { crc32 } from 'zlib';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SCRIPT_PACKS = path.join(ROOT, 'tests/reports/scripts');
export const BASELINE_PACK = path.join(SCRIPT_PACKS, 'baseline');
export const HEALED_PACK = path.join(SCRIPT_PACKS, 'healed');

const BUNDLE_PATHS = [
  'tests/specs/script-1-happy-path.spec.ts',
  'tests/specs/script-2-variant-path.spec.ts',
  'tests/data/fixtures/case-data.ts',
  'tests/utils/form-helpers.ts',
  'tests/utils/locator-registry.ts',
  'tests/utils/wizard-flow.ts',
  'tests/utils/wizard-pages.ts',
  'tests/utils/wizard-scope.ts',
  'tests/utils/firelight-session.ts',
];

export type ScriptPackKind = 'baseline' | 'healed';

export type ScriptPackInfo = {
  kind: ScriptPackKind;
  ready: boolean;
  capturedAt: string | null;
  fileCount: number;
  download: string;
};

function listPageFiles(): string[] {
  const dir = path.join(ROOT, 'tests/pages/firelight');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.locators.json'))
    .map((f) => path.posix.join('tests/pages/firelight', f));
}

function collectLiveFiles(): Array<{ rel: string; abs: string }> {
  const rels = [...BUNDLE_PATHS, ...listPageFiles()];
  return rels
    .map((rel) => ({ rel, abs: path.join(ROOT, rel) }))
    .filter((f) => fs.existsSync(f.abs) && fs.statSync(f.abs).isFile());
}

function packDir(kind: ScriptPackKind): string {
  return kind === 'baseline' ? BASELINE_PACK : HEALED_PACK;
}

function readme(kind: ScriptPackKind, capturedAt: string): string {
  const title = kind === 'baseline' ? 'Baseline Firelight scripts' : 'Healed Firelight scripts';
  return `# ${title}

Frozen ${capturedAt}.

Contains Script 1, Script 2, POMs, and \`*.locators.json\` sidecars.
Heal updates locators only after human acceptance of **expected** Detect rows.

Run from jackson-tests after copying these files over the live tree (do not overwrite \`.env\`):

\`\`\`bash
npm run test:script1
npm run test:script2
\`\`\`

Success: Wet Signature checked, DATA ENTRY 100%. Do not CONTINUE or Submit for Review.
`;
}

export function snapshotScriptPack(kind: ScriptPackKind): ScriptPackInfo {
  const dest = packDir(kind);
  fs.mkdirSync(dest, { recursive: true });
  const files = collectLiveFiles();
  for (const file of files) {
    const out = path.join(dest, file.rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(file.abs, out);
  }
  const capturedAt = new Date().toISOString();
  fs.writeFileSync(path.join(dest, 'README.md'), readme(kind, capturedAt));
  fs.writeFileSync(
    path.join(dest, 'manifest.json'),
    JSON.stringify({ kind, capturedAt, files: files.map((f) => f.rel) }, null, 2),
  );
  return packInfo(kind);
}

export function packInfo(kind: ScriptPackKind): ScriptPackInfo {
  const dest = packDir(kind);
  const manifestPath = path.join(dest, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return {
      kind,
      ready: false,
      capturedAt: null,
      fileCount: 0,
      download: `/api/download/${kind}-script.zip`,
    };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { capturedAt?: string; files?: string[] };
  return {
    kind,
    ready: true,
    capturedAt: manifest.capturedAt || null,
    fileCount: (manifest.files || []).length,
    download: `/api/download/${kind}-script.zip`,
  };
}

function dosTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getSeconds() / 2) | (date.getMinutes() << 5) | (date.getHours() << 11),
    date: date.getDate() | ((date.getMonth() + 1) << 5) | ((date.getFullYear() - 1980) << 9),
  };
}

function zipStore(entries: Array<{ name: string; data: Buffer; mtime: Date }>): Buffer {
  const chunks: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf8');
    const crc = crc32(entry.data) >>> 0;
    const { time, date } = dosTime(entry.mtime);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const localFull = Buffer.concat([local, name, entry.data]);
    chunks.push(localFull);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));
    offset += localFull.length;
  }
  const centralBlob = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBlob.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBlob, end]);
}

function walkPack(dir: string, prefix = ''): Array<{ name: string; data: Buffer; mtime: Date }> {
  if (!fs.existsSync(dir)) return [];
  const out: Array<{ name: string; data: Buffer; mtime: Date }> = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const abs = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    const st = fs.statSync(abs);
    if (st.isDirectory()) out.push(...walkPack(abs, rel));
    else out.push({ name: rel, data: fs.readFileSync(abs), mtime: st.mtime });
  }
  return out;
}

export function zipScriptPack(kind: ScriptPackKind): { filename: string; body: Buffer } | { error: string } {
  if (kind === 'baseline' && !packInfo('baseline').ready) snapshotScriptPack('baseline');
  const info = packInfo(kind);
  if (!info.ready) {
    return {
      error:
        kind === 'healed'
          ? 'No healed script pack yet. Accept expected Detect rows and Heal first.'
          : 'No baseline script pack. Capture baseline or download once to freeze current scripts.',
    };
  }
  const files = walkPack(packDir(kind));
  const stamp = (info.capturedAt || 'pack').slice(0, 10);
  return {
    filename: `jackson-${kind}-scripts-${stamp}.zip`,
    body: zipStore(files),
  };
}
