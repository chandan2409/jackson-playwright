function labelFromFingerprint(raw) {
  if (!raw) return '—';
  if (/^[a-f0-9]{16,}$/i.test(raw)) return `<code title="${raw}">${raw.slice(0, 8)}…</code>`;
  try {
    const parsed = JSON.parse(raw);
    return parsed.label || parsed.text || parsed.tag || raw;
  } catch {
    return raw;
  }
}

function pill(text, cls) {
  return `<span class="pill ${cls}">${text}</span>`;
}

let coverageStepRows = [];
let covPage = 1;
let covPageSize = 25;
let covPrintAll = false;

function renderCoverageStepsPage() {
  const body = document.getElementById('coverage-steps');
  const pager = document.getElementById('coverage-steps-pager');
  const prev = document.getElementById('steps-prev');
  const next = document.getElementById('steps-next');
  const label = document.getElementById('steps-page-label');
  if (!body) return;

  const total = coverageStepRows.length;
  const size = covPrintAll ? Math.max(total, 1) : covPageSize;
  const pages = Math.max(1, Math.ceil(total / size) || 1);
  if (covPage > pages) covPage = pages;
  const start = covPrintAll ? 0 : (covPage - 1) * size;
  const slice = coverageStepRows.slice(start, start + size);
  body.innerHTML = slice.join('') || '<tr><td colspan="6">No Excel steps.</td></tr>';

  if (pager) pager.hidden = total <= 10;
  if (label) {
    label.textContent = total
      ? `${start + 1}–${Math.min(start + size, total)} of ${total}`
      : '0 steps';
  }
  if (prev) prev.disabled = covPage <= 1 || covPrintAll;
  if (next) next.disabled = covPage >= pages || covPrintAll;
}

function liveOn() {
  return document.getElementById('live-mode').checked;
}

function setBusy(busy) {
  document.querySelectorAll('[data-run], #heal-btn, #jira-file-missing, #jira-create-report, [data-jira]').forEach((btn) => {
    if (btn.classList.contains('live-only') && !liveOn()) {
      btn.disabled = true;
      return;
    }
    if (btn.id === 'jira-file-missing' || btn.hasAttribute('data-jira')) return;
    btn.disabled = busy;
  });
}

async function refreshDashboard() {
  const res = await fetch('/api/dashboard');
  const data = await res.json();
  const report = data.report;
  const s = report?.summary || { total: 0, expected: 0, unexpected: 0, info: 0 };

  document.getElementById('chips').innerHTML = [
    data.product || 'Elite Access II',
    data.jurisdiction || 'Colorado',
    data.caseName || 'Boun',
    data.liveBaseline?.id || data.report?.baselineId || 'no baseline',
  ]
    .map((chip) => `<span class="chip">${chip}</span>`)
    .join('');

  document.getElementById('wizard').innerHTML = (data.wizard || [])
    .map(
      (step) =>
        `<li class="step ${step.status}" title="${step.key}: ${step.status}">
          <span class="step-label">${step.label}</span>
          <span class="step-count">${step.status === 'captured' ? step.elementCount : step.status}</span>
        </li>`,
    )
    .join('');

  document.getElementById('summary').innerHTML = [
    ['Changes', s.total, ''],
    ['Expected', s.expected, 'card-expected'],
    ['Unexpected', s.unexpected, 'card-unexpected'],
    ['Last run', data.lastRun?.status || 'n/a', ''],
  ]
    .map(
      ([label, value, extra]) =>
        `<article class="card ${extra}"><strong>${value}</strong><span>${label}</span></article>`,
    )
    .join('');

  document.getElementById('report-meta').textContent = report
    ? `${report.baselineId} · ${report.product} · ${report.jurisdiction} · ${report.caseName} · ${report.generatedAt}`
    : 'No latest-change-report.json — run Detect (rehearsal)';

  const cov = data.coverage;
  const covSum = cov?.summary;
  document.getElementById('coverage-meta').textContent = cov
    ? `${cov.source} · ${covSum?.excelSteps ?? cov.excelStepCount} Excel steps mapped · ${cov.scripts.length} scripts · ${cov.pages.length} wizard pages`
    : 'No coverage-matrix.json';
  document.getElementById('coverage').innerHTML = (cov?.scripts || [])
    .map((script) => {
      const status = script.lastStatus || 'not-run';
      return `<tr class="row-${status === 'passed' ? 'expected' : status === 'failed' || status === 'timedOut' ? 'unexpected' : ''}">
        <td><strong>${script.id}</strong></td>
        <td>${script.file}<br><span class="meta">${script.lastTitle || ''}</span></td>
        <td>${script.path}</td>
        <td>${script.coveredStepCount ?? '—'}</td>
        <td>${pill(status, status === 'passed' ? 'expected' : status === 'not-run' ? 'pending' : 'unexpected')}</td>
      </tr>`;
    })
    .join('');
  const stepsMeta = document.getElementById('coverage-steps-meta');
  if (stepsMeta) {
    stepsMeta.textContent = covSum
      ? `${covSum.mappedSteps} Excel rows + ${covSum.liveOnlySteps} live-only · implemented ${covSum.implemented} · last run passed ${covSum.passed} / failed ${covSum.failed} / partial ${covSum.partial} / not-run ${covSum.notRun}`
      : 'No Excel steps in coverage-matrix.json';
  }
  coverageStepRows = (cov?.steps || []).map((step) => {
    const status = step.lastStatus || 'not-run';
    const rowCls =
      status === 'passed' ? 'expected' : status === 'failed' || status === 'timedOut' ? 'unexpected' : status === 'partial' ? 'partial' : '';
    const tests = (step.results || (step.testCases || []).map((id) => ({ testId: id, status: 'not-run' })))
      .map((res) => {
        const cls = res.status === 'passed' ? 'expected' : res.status === 'not-run' || res.status === 'skipped' ? 'pending' : 'unexpected';
        return `${pill(res.testId, cls)} ${pill(res.status, cls)}`;
      })
      .join('<br>');
    const values =
      step.happyValue || step.variantValue
        ? `${step.happyValue || '—'} → ${step.variantValue || '—'}`
        : '—';
    const note = step.note ? `<br><span class="meta">${step.note}</span>` : '';
    const src = step.source === 'live-wizard' ? ' <span class="pill pending">live</span>' : '';
    return `<tr class="row-${rowCls}" title="${String(step.requirement || '').replace(/"/g, '&quot;')}">
          <td><strong>${step.id}</strong>${src}<br><span class="meta req">${step.requirement}</span></td>
          <td>${step.page}</td>
          <td>${step.field || step.action}${note}</td>
          <td class="meta">${values}</td>
          <td>${tests}</td>
          <td>${pill(status, status === 'passed' ? 'expected' : status === 'not-run' || status === 'skipped' ? 'pending' : status === 'partial' ? 'pending' : 'unexpected')}</td>
        </tr>`;
  });
  covPage = 1;
  renderCoverageStepsPage();

  const htmlLink = document.getElementById('html-report');
  const htmlHint = document.getElementById('html-report-hint');
  if (data.htmlReport?.available) {
    htmlLink.classList.remove('is-disabled');
    htmlLink.setAttribute('href', data.htmlReport.href);
    htmlLink.setAttribute('target', '_blank');
    htmlLink.setAttribute('rel', 'noopener noreferrer');
    htmlHint.textContent = 'Screenshots, video, and traces from the last Playwright run.';
  } else {
    htmlLink.classList.add('is-disabled');
    htmlLink.setAttribute('href', '#');
    htmlLink.removeAttribute('target');
    htmlHint.textContent = 'Run Script 1 or Script 2 to generate the HTML report.';
  }

  const tbody = document.getElementById('changes');
  const defectById = Object.fromEntries((data.defects || []).map((d) => [d.id, d]));
  tbody.innerHTML = (report?.changes || [])
    .map((c) => {
      const before = labelFromFingerprint(c.baselineValue);
      const after = labelFromFingerprint(c.currentValue);
      const checked = c.classification === 'expected' ? 'checked' : '';
      const defect = defectById[c.changeId];
      let jiraCell = '—';
      if (defect?.jiraUrl) {
        jiraCell = `<a href="${defect.jiraUrl}" target="_blank" rel="noopener noreferrer">${defect.jiraKey}</a>`;
      } else if (c.classification === 'unexpected') {
        jiraCell = `<button type="button" class="ghost" data-jira="${c.changeId}">Create</button>`;
      }
      return `<tr class="row-${c.classification}">
        <td><input type="checkbox" class="chg" data-id="${c.changeId}" data-class="${c.classification}" ${checked} /></td>
        <td><strong>${c.changeId}</strong></td>
        <td>${pill(c.classification, c.classification)}</td>
        <td>${c.changeType}</td>
        <td>${c.page}<br><span class="meta">${c.fieldOrLocator}</span>
          ${c.matchedTicketId ? `<br><span class="meta">${c.matchedTicketId}</span>` : ''}</td>
        <td>${before} → ${after}</td>
        <td>${pill(c.acceptanceStatus || 'pending', c.acceptanceStatus || 'pending')}</td>
        <td>${c.healAction || '—'}</td>
        <td>${jiraCell}</td>
      </tr>`;
    })
    .join('');

  const live = data.liveBaseline;
  document.getElementById('baseline-meta').textContent = live
    ? `${live.id} · captured ${live.capturedAt}`
    : 'No CURRENT baseline';
  document.getElementById('baseline-pages').innerHTML = (live?.pages || [])
    .map((p) => {
      const cls = p.stub ? 'stub' : 'live';
      const tag = p.stub
        ? 'not scanned'
        : `${p.htmlChars ? `${p.htmlChars} DOM chars · ` : ''}${p.elementCount} fields`;
      return `<li><span>${p.pageKey}</span><span class="${cls}">${tag}</span></li>`;
    })
    .join('');

  const locators = liveOn() ? data.liveLocators : data.rehearsalLocators;
  document.getElementById('locator').textContent = locators && Object.keys(locators).length
    ? JSON.stringify(locators, null, 2)
    : 'No locator sidecars';

  const jira = data.jira || {};
  document.getElementById('jira-meta').textContent = jira.hint || '';
  document.getElementById('jira-file-missing').disabled = !jira.configured;
  document.getElementById('jira-create-report').disabled = !jira.configured;
  document.getElementById('jira-defects').innerHTML = (data.defects || [])
    .map((d) => {
      const link = d.jiraUrl
        ? `<a href="${d.jiraUrl}" target="_blank" rel="noopener noreferrer">${d.jiraKey}</a>`
        : '—';
      const action = d.jiraKey
        ? ''
        : `<button type="button" class="ghost" data-jira="${d.id}" ${jira.configured ? '' : 'disabled'}>Create</button>`;
      return `<tr>
        <td><strong>${d.id}</strong></td>
        <td>${link}</td>
        <td>${action}</td>
      </tr>`;
    })
    .join('') || '<tr><td colspan="3">No defect notes.</td></tr>';

  document.getElementById('defects').innerHTML = (data.defects || [])
    .map((d) => `<article class="defect">${d.body.replace(/</g, '&lt;')}</article>`)
    .join('') || '';

  if (data.job?.running) pollJob();
}

function selectedHeal() {
  const accept = [];
  const reject = [];
  document.querySelectorAll('.chg').forEach((box) => {
    const id = box.dataset.id;
    if (box.checked) accept.push(id);
    else reject.push(id);
  });
  return { accept, reject };
}

async function startRun(script, extra = {}) {
  setBusy(true);
  document.getElementById('job-status').textContent = `Running ${script}…`;
  document.getElementById('job-log').textContent = '';
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script, live: liveOn(), ...extra }),
  });
  const body = await res.json();
  if (!res.ok) {
    setBusy(false);
    document.getElementById('job-status').textContent = body.error || 'Failed to start';
    return;
  }
  pollJob();
}

let pollTimer = 0;
async function pollJob() {
  clearTimeout(pollTimer);
  const res = await fetch('/api/job');
  const job = await res.json();
  document.getElementById('job-log').textContent = job.log || '';
  document.getElementById('job-log').scrollTop = document.getElementById('job-log').scrollHeight;
  if (job.running) {
    document.getElementById('job-status').textContent = `Running ${job.name}…`;
    setBusy(true);
    pollTimer = window.setTimeout(pollJob, 600);
    return;
  }
  setBusy(false);
  if (job.name) {
    document.getElementById('job-status').textContent =
      job.exitCode === 0 ? `${job.name} finished` : `${job.name} exited ${job.exitCode}`;
    await refreshDashboard();
  }
}

document.getElementById('live-mode').addEventListener('change', () => {
  document.querySelectorAll('.live-only').forEach((btn) => {
    btn.disabled = !liveOn();
  });
});

document.querySelectorAll('[data-run]').forEach((btn) => {
  btn.addEventListener('click', () => startRun(btn.dataset.run));
});

document.getElementById('heal-btn').addEventListener('click', () => {
  const { accept, reject } = selectedHeal();
  startRun('heal', { accept, reject });
});

document.getElementById('export-pdf').addEventListener('click', () => window.print());

async function fileJira(changeIds) {
  const status = document.getElementById('jira-status');
  status.textContent = 'Creating in Jira…';
  const res = await fetch('/api/jira', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changeIds }),
  });
  const body = await res.json();
  if (!res.ok) {
    status.textContent = body.error || 'Jira create failed';
    return;
  }
  const errors = (body.results || []).filter((r) => r.error);
  const made = (body.results || []).filter((r) => r.key && !r.error);
  status.textContent = errors.length
    ? errors.map((r) => `${r.id}: ${r.error}`).join(' · ')
    : `Filed ${made.map((r) => r.key).join(', ')}`;
  await refreshDashboard();
}

document.getElementById('jira-file-missing').addEventListener('click', () => fileJira([]));
document.getElementById('jira-create-report').addEventListener('click', () => {
  const unexpected = [...document.querySelectorAll('.chg')]
    .filter((box) => box.dataset.class === 'unexpected')
    .map((box) => box.dataset.id);
  fileJira(unexpected);
});
document.getElementById('changes').addEventListener('click', (event) => {
  const btn = event.target.closest('[data-jira]');
  if (!btn) return;
  fileJira([btn.dataset.jira]);
});
document.getElementById('jira-defects').addEventListener('click', (event) => {
  const btn = event.target.closest('[data-jira]');
  if (!btn) return;
  fileJira([btn.dataset.jira]);
});

document.getElementById('steps-prev').addEventListener('click', () => {
  covPage -= 1;
  renderCoverageStepsPage();
});
document.getElementById('steps-next').addEventListener('click', () => {
  covPage += 1;
  renderCoverageStepsPage();
});
document.getElementById('steps-page-size').addEventListener('change', (event) => {
  covPageSize = Number(event.target.value) || 25;
  covPage = 1;
  renderCoverageStepsPage();
});
window.addEventListener('beforeprint', () => {
  covPrintAll = true;
  renderCoverageStepsPage();
});
window.addEventListener('afterprint', () => {
  covPrintAll = false;
  renderCoverageStepsPage();
});

refreshDashboard().catch((err) => {
  document.body.insertAdjacentHTML('beforeend', `<p class="note">Failed to load dashboard: ${err.message}</p>`);
});
