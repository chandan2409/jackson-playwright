import fs from 'fs';
import path from 'path';

/**
 * Applies HITL acceptance onto the latest change report, writes defect stubs,
 * and patches locator sidecars for accepted *expected* label changes.
 *
 * Usage:
 *   npx tsx tests/utils/apply-heal-acceptance.ts --accept CHG-001 --reject CHG-002
 *   npx tsx tests/utils/apply-heal-acceptance.ts --accept CHG-001 --locators-dir tests/data/rehearsal/locators
 */

const ROOT = path.resolve(__dirname, '../..');
const REPORT = path.join(ROOT, 'tests/reports/changes/latest-change-report.json');
const DEFECTS = path.join(ROOT, 'tests/reports/changes/defects');
const DEFAULT_LOCATORS = path.join(ROOT, 'tests/pages/firelight');

function parseList(flag: string): string[] {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) return [];
  return process.argv[idx + 1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) return undefined;
  return process.argv[idx + 1];
}

function collectLocatorFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.locators.json')).map((f) => path.join(dir, f));
}

function healLabelChange(locatorsDir: string, fromLabel: string, toLabel: string): string[] {
  const touched: string[] = [];
  for (const file of collectLocatorFiles(locatorsDir)) {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    let changed = false;
    for (const entry of Object.values(json.entries || {}) as Array<{ strategies?: Array<{ type: string; value: string }> }>) {
      for (const strategy of entry.strategies || []) {
        if ((strategy.type === 'label' || strategy.type === 'text') && strategy.value === fromLabel) {
          strategy.value = toLabel;
          changed = true;
        }
      }
    }
    if (changed) {
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
      touched.push(path.relative(ROOT, file));
    }
  }
  return touched;
}

function main() {
  const accepted = new Set(parseList('--accept'));
  const rejected = new Set(parseList('--reject'));
  const locatorsDir = path.resolve(ROOT, argValue('--locators-dir') || DEFAULT_LOCATORS);

  if (!fs.existsSync(REPORT)) {
    console.error('Missing latest-change-report.json — run npm run detect:changes first');
    process.exit(1);
  }
  if (accepted.size === 0 && rejected.size === 0) {
    console.error('Provide --accept and/or --reject change IDs (HITL required)');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  fs.mkdirSync(DEFECTS, { recursive: true });
  const healedFiles: string[] = [];

  for (const change of report.changes) {
    if (accepted.has(change.changeId)) {
      change.acceptanceStatus = 'accepted';
      if (change.classification === 'expected') {
        const defectPath = path.join(DEFECTS, `${change.changeId}.md`);
        if (fs.existsSync(defectPath)) fs.unlinkSync(defectPath);
      }
      if (change.classification === 'unexpected') {
        console.warn(
          `Warning: ${change.changeId} is unexpected but accepted — prefer filing a defect instead of healing.`,
        );
      }
      if (change.classification === 'expected' && change.changeType === 'label-changed') {
        const from = change.baselineValue ? JSON.parse(change.baselineValue).label : null;
        const to = change.currentValue ? JSON.parse(change.currentValue).label : null;
        if (from && to) {
          healedFiles.push(...healLabelChange(locatorsDir, from, to));
        }
      }
    }
    if (rejected.has(change.changeId) || change.classification === 'unexpected') {
      if (rejected.has(change.changeId) || !accepted.has(change.changeId)) {
        change.acceptanceStatus = change.acceptanceStatus === 'accepted' ? 'accepted' : 'rejected';
        if (change.classification === 'unexpected') {
          const defectPath = path.join(DEFECTS, `${change.changeId}.md`);
          const body = `# Defect ${change.changeId}

- Page: ${change.page}
- Field: ${change.fieldOrLocator}
- Severity: ${change.severity}
- Type: ${change.changeType}
- Classification: ${change.classification}
- Description: ${change.description}
- Evidence: ${change.evidenceScreenshot}
- Action: Do not heal; track with Jackson
`;
          fs.writeFileSync(defectPath, body);
        }
      }
    }
  }

  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(`Updated acceptance on ${REPORT}`);
  console.log(`Accepted: ${[...accepted].join(', ') || '(none)'}`);
  console.log(`Locator files healed: ${healedFiles.join(', ') || '(none)'}`);
  console.log(`Rejected/defects: see ${DEFECTS}`);
}

main();
