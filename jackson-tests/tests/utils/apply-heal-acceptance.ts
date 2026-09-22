import fs from 'fs';
import path from 'path';

/**
 * Applies HITL acceptance onto the latest change report and writes defect stubs.
 * Locator/POM editing is performed by the self-healer agent; this utility updates
 * report metadata and scaffolds defect notes for unexpected/rejected items.
 *
 * Usage:
 *   npx tsx tests/utils/apply-heal-acceptance.ts --accept CHG-001,CHG-003 --reject CHG-002
 */

const ROOT = path.resolve(__dirname, '../..');
const REPORT = path.join(ROOT, 'tests/reports/changes/latest-change-report.json');
const DEFECTS = path.join(ROOT, 'tests/reports/changes/defects');

function parseList(flag: string): string[] {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) return [];
  return process.argv[idx + 1].split(',').map((s) => s.trim()).filter(Boolean);
}

function main() {
  const accepted = new Set(parseList('--accept'));
  const rejected = new Set(parseList('--reject'));

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

  for (const change of report.changes) {
    if (accepted.has(change.changeId)) {
      change.acceptanceStatus = 'accepted';
      if (change.classification === 'unexpected') {
        console.warn(
          `Warning: ${change.changeId} is unexpected but accepted — prefer filing a defect instead of healing.`,
        );
      }
    }
    if (rejected.has(change.changeId) || change.classification === 'unexpected') {
      if (rejected.has(change.changeId) || !accepted.has(change.changeId)) {
        change.acceptanceStatus = change.acceptanceStatus === 'accepted' ? 'accepted' : 'rejected';
        if (change.classification === 'unexpected' || rejected.has(change.changeId)) {
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
  console.log(`Rejected/defects: see ${DEFECTS}`);
  console.log('Next: have the self-healer agent patch locators for accepted expected changes, then npm run baseline:capture');
}

main();
