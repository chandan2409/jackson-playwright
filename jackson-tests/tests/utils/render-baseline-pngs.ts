import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';

/**
 * Renders before/after screenshots from frozen HTML (no live Firelight).
 * Expands the clipped wizard scroller so lower fields (e.g. Owner military) appear.
 */

const ROOT = path.resolve(__dirname, '../..');
const BASELINE_ROOT = path.join(ROOT, 'tests/data/baselines');
const SNAPSHOTS = path.join(ROOT, 'tests/data/.snapshots');
const EVIDENCE = path.join(ROOT, 'tests/reports/changes/evidence');
const EVIDENCE_BEFORE = path.join(EVIDENCE, 'before');

function wrapHtml(pageKey: string, html: string, banner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Baseline ${pageKey}</title>
  <style>
    body { margin: 16px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1c1917; background: #fff; }
    .banner { font: 12px/1.4 ui-sans-serif, system-ui, sans-serif; color: #57534e; margin: 0 0 12px; padding: 8px 10px; background: #faf7f2; border: 1px solid #e4dcd0; border-radius: 8px; }
    input, select, textarea, button { font: inherit; min-height: 24px; }
    input[type="text"], input[type="email"], input:not([type]), select, textarea { border: 1px solid #a8a29e; padding: 4px 6px; min-width: 160px; }
    .ITWizardRoot, .ITWizardRootDefault, .eAppPanelContainer {
      max-height: none !important;
      height: auto !important;
      overflow: visible !important;
    }
    .row { margin: 6px 0; }
  </style>
</head>
<body>
  <p class="banner">${banner}</p>
  ${html}
</body>
</html>`;
}

async function renderDir(
  page: import('@playwright/test').Page,
  jsonDir: string,
  dests: string[],
  banner: string,
): Promise<number> {
  if (!fs.existsSync(jsonDir)) return 0;
  let count = 0;
  const files = fs.readdirSync(jsonDir).filter((f) => f.endsWith('.json') && f !== 'manifest.json');
  for (const file of files) {
    const snap = JSON.parse(fs.readFileSync(path.join(jsonDir, file), 'utf8')) as {
      pageKey?: string;
      html?: string;
      scanned?: boolean;
    };
    const pageKey = snap.pageKey || file.replace(/\.json$/, '');
    if (!snap.html || snap.scanned === false) {
      console.log(`Skip ${pageKey} (no scanned HTML)`);
      continue;
    }
    await page.setContent(wrapHtml(pageKey, snap.html, banner), { waitUntil: 'domcontentloaded' });
    const buf = await page.screenshot({ fullPage: true });
    for (const dest of dests) {
      fs.mkdirSync(dest, { recursive: true });
      fs.writeFileSync(path.join(dest, `${pageKey}.png`), buf);
    }
    count += 1;
    console.log(`Rendered ${pageKey}.png → ${dests.map((d) => path.relative(ROOT, d)).join(', ')}`);
  }
  return count;
}

async function main() {
  const currentId = fs.existsSync(path.join(BASELINE_ROOT, 'CURRENT'))
    ? fs.readFileSync(path.join(BASELINE_ROOT, 'CURRENT'), 'utf8').trim()
    : '';
  const dir = currentId ? path.join(BASELINE_ROOT, currentId) : '';
  if (!dir || !fs.existsSync(path.join(dir, 'manifest.json'))) {
    console.error('No CURRENT baseline JSON to render.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  try {
    const before = await renderDir(
      page,
      dir,
      [dir, EVIDENCE_BEFORE],
      'Before · frozen baseline DOM (full wizard — not a live Firelight recapture)',
    );
    const after = await renderDir(
      page,
      SNAPSHOTS,
      [EVIDENCE],
      'After · frozen live Detect DOM (full wizard, not the clipped Firelight viewport)',
    );
    console.log(`Wrote ${before} before-screenshots and ${after} after-screenshots from cached HTML`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
