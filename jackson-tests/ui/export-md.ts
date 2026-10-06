import type { loadDashboard } from './dashboard.ts';

type Dash = ReturnType<typeof loadDashboard>;

export function dashboardMarkdown(dash: Dash): string {
  const r = dash.report as {
    baselineId?: string;
    generatedAt?: string;
    summary?: { total: number; expected: number; unexpected: number };
    changes?: Array<{
      changeId: string;
      classification: string;
      changeType: string;
      page: string;
      fieldOrLocator: string;
      severity?: string;
      description?: string;
      evidenceScreenshot?: string;
      acceptanceStatus?: string;
      healAction?: string | null;
    }>;
  } | null;
  const cov = dash.coverage as {
    source?: string;
    summary?: { excelSteps: number; implemented: number; passed: number; failed: number; partial: number; notRun: number };
    scripts?: Array<{ id: string; lastStatus?: string; coveredStepCount?: number }>;
    steps?: Array<{
      id: string;
      page: string;
      field: string;
      requirement: string;
      lastStatus: string;
      results: Array<{ testId: string; status: string }>;
    }>;
  } | null;
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
    '## Test coverage (Excel step → test case → last run)',
    '',
    `- Source: ${cov?.source || 'n/a'}`,
    `- Excel steps: ${cov?.summary?.excelSteps ?? 0} · implemented: ${cov?.summary?.implemented ?? 0}`,
    `- Last run: passed ${cov?.summary?.passed ?? 0} · failed ${cov?.summary?.failed ?? 0} · partial ${cov?.summary?.partial ?? 0} · not-run ${cov?.summary?.notRun ?? 0}`,
    '',
    '| Test | Status | Excel steps |',
    '|------|--------|-------------|',
  ];
  for (const script of cov?.scripts || []) {
    lines.push(`| ${script.id} | ${script.lastStatus || 'not-run'} | ${script.coveredStepCount ?? 0} |`);
  }
  lines.push(
    '',
    '| Step | Page | Field | Tests | Status | Requirement |',
    '|------|------|-------|-------|--------|-------------|',
  );
  for (const step of cov?.steps || []) {
    const tests = (step.results || []).map((res) => `${res.testId}:${res.status}`).join(', ');
    const req = step.requirement.replace(/\|/g, '/').replace(/\n/g, ' ');
    lines.push(`| ${step.id} | ${step.page} | ${step.field} | ${tests} | ${step.lastStatus} | ${req} |`);
  }
  lines.push(
    '',
    '## Change report',
    '',
    '| ID | Class | Type | Page | Field | HITL | Heal |',
    '|----|-------|------|------|-------|------|------|',
  );
  for (const c of r?.changes || []) {
    lines.push(
      `| ${c.changeId} | ${c.classification} | ${c.changeType} | ${c.page} | ${c.fieldOrLocator} | ${c.acceptanceStatus || 'pending'} | ${c.healAction || ''} |`,
    );
  }
  lines.push('', '## Defects', '');
  const unexpected = (r?.changes || []).filter((c) => c.classification === 'unexpected');
  const noteById = Object.fromEntries((dash.defects || []).map((d) => [d.id, d]));
  if (!unexpected.length) {
    lines.push('No unexpected changes in the latest Detect report.');
  }
  for (const c of unexpected) {
    const note = noteById[c.changeId];
    lines.push(
      `### ${c.changeId}`,
      '',
      `- Page: ${c.page}`,
      `- Field: ${c.fieldOrLocator}`,
      `- Type: ${c.changeType}`,
      `- Severity: ${c.severity}`,
      `- Description: ${c.description}`,
      `- Evidence: ${c.evidenceScreenshot || ''}`,
      note?.jiraKey ? `- Jira: ${note.jiraKey}` : '- Jira: (none)',
      '',
    );
  }
  return lines.join('\n');
}
