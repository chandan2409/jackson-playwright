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
let covPageSize = 10;
let covPrintAll = false;
let changeFilter = 'all';
let selectedChangeId = '';
let changeItems = [];
let changeAccept = new Map();
let chgPage = 1;
let chgPageSize = 10;
let chgPrintAll = false;

function showPanel(id) {
  document.querySelectorAll('.panel').forEach((panel) => {
    panel.hidden = panel.id !== `panel-${id}`;
  });
  document.querySelectorAll('.tabs [data-panel]').forEach((tab) => {
    tab.setAttribute('aria-selected', String(tab.dataset.panel === id));
  });
  if (location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
}

function evidenceHref(raw) {
  if (!raw) return '';
  const norm = String(raw).replace(/\\/g, '/');
  if (!/\.(png|jpe?g)$/i.test(norm)) return '';
  const name = norm.split('/').pop();
  return `/evidence/${encodeURIComponent(name)}`;
}

function openChangeCompare(row) {
  document.querySelectorAll('#changes tr[data-id]').forEach((el) => {
    el.classList.toggle('is-selected', el === row);
  });
  if (!row) {
    selectedChangeId = '';
    return;
  }
  selectedChangeId = row.dataset.id || '';
  window.open(`/compare.html?id=${encodeURIComponent(selectedChangeId)}`, '_blank', 'noopener');
}

function syncVisibleAccept() {
  document.querySelectorAll('#changes .chg').forEach((box) => {
    changeAccept.set(box.dataset.id, box.checked);
  });
}

function filteredChanges() {
  return changeItems.filter((row) => changeFilter === 'all' || row.classification === changeFilter);
}

function renderChangesPage() {
  syncVisibleAccept();
  const body = document.getElementById('changes');
  const pager = document.getElementById('changes-pager');
  const prev = document.getElementById('changes-prev');
  const next = document.getElementById('changes-next');
  const label = document.getElementById('changes-page-label');
  if (!body) return;

  document.querySelectorAll('.filter').forEach((btn) => {
    btn.classList.toggle('is-on', btn.dataset.filter === changeFilter);
  });

  const filtered = filteredChanges();
  const total = filtered.length;
  if (!total) {
    body.innerHTML = '<tr><td colspan="9"><p class="empty">No changes in this filter.</p></td></tr>';
    if (pager) pager.hidden = true;
    if (label) label.textContent = '0 changes';
    return;
  }

  const size = chgPrintAll ? Math.max(total, 1) : chgPageSize;
  const pages = Math.max(1, Math.ceil(total / size) || 1);
  if (chgPage > pages) chgPage = pages;
  const start = chgPrintAll ? 0 : (chgPage - 1) * size;
  const slice = filtered.slice(start, start + size);
  body.innerHTML = slice
    .map((row) => row.html.replace('data-chg-box', changeAccept.get(row.id) ? 'checked' : ''))
    .join('');

  if (selectedChangeId) {
    document.querySelectorAll('#changes tr[data-id]').forEach((el) => {
      el.classList.toggle('is-selected', el.dataset.id === selectedChangeId);
    });
  }

  if (pager) pager.hidden = total <= chgPageSize && !chgPrintAll;
  if (label) label.textContent = `${start + 1}–${Math.min(start + size, total)} of ${total}`;
  if (prev) prev.disabled = chgPage <= 1 || chgPrintAll;
  if (next) next.disabled = chgPage >= pages || chgPrintAll;
}

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
  document.getElementById('tab-coverage').textContent = cov?.scripts?.length
    ? `Coverage (${cov.scripts.length})`
    : 'Coverage';
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
  const htmlAll = document.getElementById('html-report-all');
  const htmlHint = document.getElementById('html-report-hint');
  if (data.htmlReport?.available) {
    htmlLink.classList.remove('is-disabled');
    htmlLink.setAttribute('href', data.htmlReport.href);
    htmlLink.setAttribute('target', '_blank');
    htmlLink.setAttribute('rel', 'noopener noreferrer');
  } else {
    htmlLink.classList.add('is-disabled');
    htmlLink.setAttribute('href', '#');
    htmlLink.removeAttribute('target');
  }
  if (data.htmlReportAll?.available) {
    htmlAll.classList.remove('is-disabled');
    htmlAll.setAttribute('href', data.htmlReportAll.href);
    htmlAll.setAttribute('target', '_blank');
    htmlAll.setAttribute('rel', 'noopener noreferrer');
    htmlHint.textContent = data.htmlReport?.available
      ? 'Last run · All runs merges every blob still within ARTIFACT_RETENTION_DAYS.'
      : 'Merged history of retained Playwright runs.';
  } else {
    htmlAll.classList.add('is-disabled');
    htmlAll.setAttribute('href', '#');
    htmlAll.removeAttribute('target');
    htmlHint.textContent = data.htmlReport?.available
      ? 'Screenshots, video, and traces from the last Playwright run.'
      : 'Run Script 1 or Script 2 to generate the HTML report.';
  }

  const tbody = document.getElementById('changes');
  const defectById = Object.fromEntries((data.defects || []).map((d) => [d.id, d]));
  const changes = report?.changes || [];
  changeItems = changes.map((c) => {
      const before = labelFromFingerprint(c.baselineValue);
      const after = labelFromFingerprint(c.currentValue);
      const defect = defectById[c.changeId];
      const acceptedHeal = c.classification === 'expected' || c.acceptanceStatus === 'accepted';
      let jiraCell = '<span class="meta">—</span>';
      if (!acceptedHeal && defect?.jiraUrl) {
        jiraCell = `<a href="${defect.jiraUrl}" target="_blank" rel="noopener noreferrer">${defect.jiraKey}</a>`;
      } else if (!acceptedHeal && c.classification === 'unexpected') {
        jiraCell = `<button type="button" class="ghost" data-jira="${c.changeId}">Create</button>`;
      }
      const ticketNote = acceptedHeal ? '' : (c.matchedTicketId ? `<br><span class="meta">${c.matchedTicketId}</span>` : '');
      const copy = pageFieldCopy(c);
      return {
        id: c.changeId,
        classification: c.classification,
        html: `<tr class="row-${c.classification}" data-class="${c.classification}" data-id="${c.changeId}" data-page="${c.page}">
        <td><input type="checkbox" class="chg" data-id="${c.changeId}" data-class="${c.classification}" data-chg-box /></td>
        <td><strong>${c.changeId}</strong></td>
        <td>${pill(c.classification, c.classification)}</td>
        <td>${c.changeType}</td>
        <td><strong>${escapeHtml(copy.page)}</strong><br><span class="meta">${escapeHtml(copy.detail)}</span>${ticketNote}</td>
        <td><span class="diff"><span class="from">${before}</span><span class="to">${after}</span></span></td>
        <td>${pill(c.acceptanceStatus || 'pending', c.acceptanceStatus || 'pending')}</td>
        <td>${c.healAction || '—'}</td>
        <td>${jiraCell}</td>
      </tr>`,
      };
    });
  changeAccept = new Map(
    changes.map((c) => [c.changeId, c.classification === 'expected' || c.acceptanceStatus === 'accepted']),
  );
  chgPage = 1;
  if (!changeItems.length) {
    tbody.innerHTML = '<tr><td colspan="9"><p class="empty">No change report yet. Run Detect (rehearsal).</p></td></tr>';
    const pager = document.getElementById('changes-pager');
    if (pager) pager.hidden = true;
  } else {
    renderChangesPage();
  }
  const unexpectedCount = changes.filter((c) => c.classification === 'unexpected').length;
  document.getElementById('tab-changes').textContent = `Changes (${changes.length})`;
  document.getElementById('tab-defects').textContent = unexpectedCount ? `Defects (${unexpectedCount})` : 'Defects';

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

  const unexpected = (report?.changes || []).filter(
    (c) => c.classification === 'unexpected' && c.acceptanceStatus !== 'accepted',
  );
  document.getElementById('jira-defects').innerHTML = unexpected
    .map((c) => {
      const defect = defectById[c.changeId];
      const copy = pageFieldCopy(c);
      const before = labelFromFingerprint(c.baselineValue);
      const after = labelFromFingerprint(c.currentValue);
      const link = defect?.jiraUrl
        ? `<a href="${defect.jiraUrl}" target="_blank" rel="noopener noreferrer">${defect.jiraKey}</a>`
        : '—';
      const action = defect?.jiraKey
        ? ''
        : `<button type="button" class="ghost" data-jira="${c.changeId}" ${jira.configured ? '' : 'disabled'}>Create</button>`;
      return `<tr class="row-unexpected" data-id="${c.changeId}" data-page="${c.page}">
        <td><strong>${c.changeId}</strong></td>
        <td><strong>${escapeHtml(copy.page)}</strong><br><span class="meta">${escapeHtml(copy.detail)}</span></td>
        <td>${c.changeType}</td>
        <td>${c.severity || '—'}</td>
        <td><span class="diff"><span class="from">${before}</span><span class="to">${after}</span></span></td>
        <td>${link}</td>
        <td>${action}</td>
      </tr>`;
    })
    .join('') || '<tr><td colspan="7"><p class="empty">No unexpected defects in the latest Detect report. Accepted heals stay out of this list.</p></td></tr>';

  document.getElementById('defects').innerHTML = unexpected
    .map((c) => {
      const copy = pageFieldCopy(c);
      const explained = explainChange(c);
      const shot = evidenceHref(c.evidenceScreenshot);
      const facts = explained.facts
        .map((f) => `<dt>${escapeHtml(f.term)}</dt><dd>${escapeHtml(f.value)}</dd>`)
        .join('');
      const paras = explained.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
      const img = shot
        ? `<img class="defect-shot" src="${shot}" alt="Live evidence for ${c.changeId}">`
        : '';
      return `<article class="defect" data-id="${c.changeId}">
        <h3>${c.changeId} · ${escapeHtml(copy.page)}</h3>
        <p><strong>${escapeHtml(copy.detail)}</strong></p>
        ${paras}
        <dl>${facts}</dl>
        <p class="meta">${escapeHtml(explained.aside)}</p>
        ${img}
      </article>`;
    })
    .join('') || '';

  if (data.job?.running) pollJob();
}

function selectedHeal() {
  syncVisibleAccept();
  const accept = [];
  const reject = [];
  changeItems.forEach((row) => {
    if (changeAccept.get(row.id)) accept.push(row.id);
    else reject.push(row.id);
  });
  return { accept, reject };
}

async function startRun(script, extra = {}) {
  setBusy(true);
  document.getElementById('job-status').textContent = `Running ${script}…`;
  document.getElementById('job-fold').open = true;
  document.getElementById('job-log').textContent = '';
  const live = script === 'script1' || script === 'script2' ? true : liveOn();
  if (live) {
    document.getElementById('live-mode').checked = true;
    document.querySelectorAll('.live-only').forEach((btn) => {
      btn.disabled = false;
    });
  }
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script, live, ...extra }),
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
    document.getElementById('job-fold').open = true;
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

document.querySelectorAll('.tabs [data-panel]').forEach((tab) => {
  tab.addEventListener('click', () => showPanel(tab.dataset.panel));
});
document.querySelectorAll('.filter').forEach((btn) => {
  btn.addEventListener('click', () => {
    changeFilter = btn.dataset.filter;
    chgPage = 1;
    renderChangesPage();
  });
});
const initialPanel = (location.hash || '#changes').replace('#', '');
if (['changes', 'coverage', 'baseline', 'defects'].includes(initialPanel)) showPanel(initialPanel);

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
  const statusDefects = document.getElementById('jira-status-defects');
  status.textContent = 'Creating in Jira…';
  if (statusDefects) statusDefects.textContent = 'Creating in Jira…';
  const res = await fetch('/api/jira', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changeIds }),
  });
  const body = await res.json();
  if (!res.ok) {
    const msg = body.error || 'Jira create failed';
    status.textContent = msg;
    if (statusDefects) statusDefects.textContent = msg;
    return;
  }
  const errors = (body.results || []).filter((r) => r.error);
  const made = (body.results || []).filter((r) => r.key && !r.error);
  status.textContent = errors.length
    ? errors.map((r) => `${r.id}: ${r.error}`).join(' · ')
    : made
        .map((r) => {
          if (r.attached) return `${r.key} (+screenshot)`;
          if (r.attachError) return `${r.key} (ticket ok, screenshot failed: ${r.attachError})`;
          if (r.skipped) return r.key;
          return `${r.key} (no PNG — run Detect live first)`;
        })
        .join(', ');
  if (statusDefects) statusDefects.textContent = status.textContent;
  await refreshDashboard();
}

document.getElementById('jira-file-missing').addEventListener('click', () => fileJira([]));
document.getElementById('jira-create-report').addEventListener('click', () => {
  fileJira(changeItems.filter((row) => row.classification === 'unexpected').map((row) => row.id));
});
document.getElementById('changes').addEventListener('change', (event) => {
  const box = event.target.closest('.chg');
  if (!box) return;
  changeAccept.set(box.dataset.id, box.checked);
});
document.getElementById('changes').addEventListener('click', (event) => {
  const btn = event.target.closest('[data-jira]');
  if (btn) {
    fileJira([btn.dataset.jira]);
    return;
  }
  if (event.target.closest('input, button, a')) return;
  const row = event.target.closest('tr[data-id]');
  if (!row) return;
  openChangeCompare(row);
});
document.getElementById('jira-defects').addEventListener('click', (event) => {
  const btn = event.target.closest('[data-jira]');
  if (btn) {
    fileJira([btn.dataset.jira]);
    return;
  }
  if (event.target.closest('a, button')) return;
  const row = event.target.closest('tr[data-id]');
  if (row) openChangeCompare(row);
});
document.getElementById('defects').addEventListener('click', (event) => {
  const card = event.target.closest('article[data-id]');
  if (!card) return;
  window.open(`/compare.html?id=${encodeURIComponent(card.dataset.id)}`, '_blank', 'noopener');
});

document.getElementById('changes-prev').addEventListener('click', () => {
  chgPage -= 1;
  renderChangesPage();
});
document.getElementById('changes-next').addEventListener('click', () => {
  chgPage += 1;
  renderChangesPage();
});
document.getElementById('changes-page-size').addEventListener('change', (event) => {
  chgPageSize = Number(event.target.value) || 10;
  chgPage = 1;
  renderChangesPage();
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
  covPageSize = Number(event.target.value) || 10;
  covPage = 1;
  renderCoverageStepsPage();
});
let printPanel = 'changes';
window.addEventListener('beforeprint', () => {
  printPanel = (location.hash || '#changes').replace('#', '');
  covPrintAll = true;
  chgPrintAll = true;
  document.querySelectorAll('.panel').forEach((panel) => {
    panel.hidden = false;
  });
  renderCoverageStepsPage();
  renderChangesPage();
});
window.addEventListener('afterprint', () => {
  covPrintAll = false;
  chgPrintAll = false;
  showPanel(['changes', 'coverage', 'baseline', 'defects'].includes(printPanel) ? printPanel : 'changes');
  renderCoverageStepsPage();
  renderChangesPage();
});

refreshDashboard().catch((err) => {
  document.body.insertAdjacentHTML('beforeend', `<p class="note">Failed to load dashboard: ${err.message}</p>`);
});
