function labelFromFingerprint(raw) {
  if (!raw) return '—';
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

function liveOn() {
  return document.getElementById('live-mode').checked;
}

function setBusy(busy) {
  document.querySelectorAll('[data-run], #heal-btn').forEach((btn) => {
    if (btn.classList.contains('live-only') && !liveOn()) {
      btn.disabled = true;
      return;
    }
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
  document.getElementById('coverage-meta').textContent = cov
    ? `${cov.source} · ${cov.excelStepCount} Excel steps · ${cov.scripts.length} scripts · ${cov.pages.length} wizard pages`
    : 'No coverage-matrix.json';
  document.getElementById('coverage').innerHTML = (cov?.scripts || [])
    .map((script) => {
      const status = script.lastStatus || 'not-run';
      return `<tr class="row-${status === 'passed' ? 'expected' : status === 'failed' || status === 'timedOut' ? 'unexpected' : ''}">
        <td><strong>${script.id}</strong></td>
        <td>${script.file}<br><span class="meta">${script.lastTitle || ''}</span></td>
        <td>${script.path}</td>
        <td>${pill(status, status === 'passed' ? 'expected' : status === 'not-run' ? 'pending' : 'unexpected')}</td>
      </tr>`;
    })
    .join('');

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
  tbody.innerHTML = (report?.changes || [])
    .map((c) => {
      const before = labelFromFingerprint(c.baselineValue);
      const after = labelFromFingerprint(c.currentValue);
      const checked = c.classification === 'expected' ? 'checked' : '';
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
      const tag = p.stub ? 'stub / empty' : `${p.elementCount} elements`;
      return `<li><span>${p.pageKey}</span><span class="${cls}">${tag}</span></li>`;
    })
    .join('');

  const loc = data.rehearsalLocators?.entries || {};
  document.getElementById('locator').textContent = Object.keys(loc).length
    ? JSON.stringify(loc, null, 2)
    : 'No rehearsal locator file';

  document.getElementById('defects').innerHTML = (data.defects || [])
    .map((d) => `<article class="defect">${d.body.replace(/</g, '&lt;')}</article>`)
    .join('') || '<p class="meta">No defect notes.</p>';

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

refreshDashboard().catch((err) => {
  document.body.insertAdjacentHTML('beforeend', `<p class="note">Failed to load dashboard: ${err.message}</p>`);
});
