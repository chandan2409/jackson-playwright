function labelFromFingerprint(raw) {
  if (!raw) return '—';
  if (/^[a-f0-9]{16,}$/i.test(raw)) return `${raw.slice(0, 8)}…`;
  try {
    const parsed = JSON.parse(raw);
    return parsed.label || parsed.text || parsed.tag || raw;
  } catch {
    return raw;
  }
}

function evidenceHref(raw) {
  if (!raw) return '';
  const norm = String(raw).replace(/\\/g, '/');
  if (!/\.(png|jpe?g)$/i.test(norm)) return '';
  const name = norm.split('/').pop();
  return `/evidence/${encodeURIComponent(name)}`;
}

function bindImg(img, missing, srcs, alt) {
  const urls = srcs.filter(Boolean);
  if (!urls.length) {
    img.hidden = true;
    missing.hidden = false;
    return;
  }
  let i = 0;
  img.alt = alt;
  img.onload = () => {
    img.hidden = false;
    missing.hidden = true;
  };
  img.onerror = () => {
    i += 1;
    if (i < urls.length) {
      img.src = urls[i];
      return;
    }
    img.hidden = true;
    missing.hidden = false;
  };
  img.src = urls[0];
}

async function main() {
  const id = new URLSearchParams(location.search).get('id') || '';
  const title = document.getElementById('compare-title');
  const sub = document.getElementById('compare-sub');
  const diff = document.getElementById('compare-diff');
  const note = document.getElementById('compare-note');
  const data = await fetch('/api/dashboard').then((r) => r.json());
  const change = (data.report?.changes || []).find((c) => c.changeId === id);
  if (!change) {
    title.textContent = id || 'Change evidence';
    sub.textContent = 'That change ID is not in the latest report. Run Detect, then click the row again.';
    return;
  }

  const copy = pageFieldCopy(change);
  document.title = `${change.changeId} · ${copy.page}`;
  title.textContent = `${change.changeId} · ${copy.page}`;
  sub.textContent = [change.classification, change.changeType, data.report?.baselineId].filter(Boolean).join(' · ');
  const fromEl = document.createElement('span');
  fromEl.className = 'from';
  fromEl.textContent = labelFromFingerprint(change.baselineValue);
  const toEl = document.createElement('span');
  toEl.className = 'to';
  toEl.textContent = labelFromFingerprint(change.currentValue);
  diff.replaceChildren(fromEl, toEl);
  note.textContent = copy.detail;

  const explain = explainChange(change);
  const meaning = document.getElementById('explain-meaning');
  meaning.replaceChildren();
  explain.paragraphs.forEach((text) => {
    const p = document.createElement('p');
    p.textContent = text;
    meaning.appendChild(p);
  });
  const facts = document.getElementById('explain-facts');
  facts.replaceChildren();
  explain.facts.forEach((fact) => {
    const dt = document.createElement('dt');
    dt.textContent = fact.term;
    const dd = document.createElement('dd');
    dd.textContent = fact.value;
    facts.append(dt, dd);
  });
  document.getElementById('explain-aside').textContent = explain.aside;

  const page = change.page;
  const baselineId = data.report?.baselineId || data.liveBaseline?.id || '';
  const cache = encodeURIComponent(data.report?.generatedAt || '');
  bindImg(
    document.getElementById('compare-before'),
    document.getElementById('compare-before-missing'),
    [
      baselineId ? `/baseline-png/${encodeURIComponent(baselineId)}/${encodeURIComponent(page)}.png?t=${cache}` : '',
      `/evidence/before/${encodeURIComponent(page)}.png?t=${cache}`,
    ],
    `Baseline ${page}`,
  );
  bindImg(
    document.getElementById('compare-after'),
    document.getElementById('compare-after-missing'),
    [
      evidenceHref(change.evidenceScreenshot) ? `${evidenceHref(change.evidenceScreenshot)}?t=${cache}` : '',
      `/evidence/${encodeURIComponent(page)}.png?t=${cache}`,
    ],
    `Live detect ${page}`,
  );
}

main().catch((err) => {
  document.getElementById('compare-sub').textContent = err.message;
});
