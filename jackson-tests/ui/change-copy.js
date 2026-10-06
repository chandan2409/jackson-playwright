const PAGE_TITLES = {
  'select-application': 'Select Application',
  'new-application-information': 'New Application Information',
  owner: 'Owner',
  beneficiaries: 'Beneficiaries',
  agent: 'Agent',
  'systematic-investment': 'Systematic Investment',
  'initial-allocations': 'Initial Allocations',
  'add-on-benefits': 'Add-On Benefits',
  'payment-detail': 'Payment Detail',
  'signing-process': 'Signing Process',
};

function parseFingerprint(raw) {
  if (!raw) return {};
  if (/^[a-f0-9]{16,}$/i.test(raw)) return { hash: raw };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    /* plain string */
  }
  return { text: String(raw) };
}

function pageTitle(pageKey) {
  return PAGE_TITLES[pageKey] || String(pageKey || '').replace(/-/g, ' ');
}

function fieldPhrase(change) {
  const before = parseFingerprint(change.baselineValue);
  const after = parseFingerprint(change.currentValue);
  const loc = String(change.fieldOrLocator || '').trim();
  const label = (before.label || after.label || before.text || after.text || '').trim();
  if (label) return label;
  const synthetic = /^el_\d+$/i.test(loc) || /#dom$/.test(loc) || loc === change.page;
  const tag = before.tag || after.tag || 'control';
  const type = before.type || after.type;
  const kind = type && type !== tag ? `${type} ${tag}` : tag;
  if (synthetic) return `an unlabeled ${kind}`;
  return loc.replace(/_/g, ' ');
}

function quoteField(phrase) {
  if (/^an unlabeled /i.test(phrase)) return phrase.replace(/^an /, 'An ');
  return `“${phrase}”`;
}

function pageFieldCopy(change) {
  const page = pageTitle(change.page);
  const field = quoteField(fieldPhrase(change));
  let detail;
  switch (change.changeType) {
    case 'removed':
      detail = `${field} was on the baseline ${page} page and is missing in live Firelight.`;
      break;
    case 'added':
      detail = `${field} is new on live ${page} and was not in the baseline.`;
      break;
    case 'label-changed':
      detail = `The wording for ${field} on ${page} changed.`;
      break;
    case 'option-changed':
      detail = `The dropdown options for ${field} on ${page} changed.`;
      break;
    case 'relocated':
      detail = `${field} moved on the ${page} page.`;
      break;
    case 'modified':
      detail = `${field} changed on the ${page} page.`;
      break;
    case 'dom-changed':
      detail = `The ${page} page markup changed, with no matching field-level diff.`;
      break;
    case 'unscanned':
      detail = `Detect did not scan the ${page} page on this run.`;
      break;
    default:
      detail = change.description || field;
  }
  return { page, detail };
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CHROME_HINT =
  /QA\s*\d|2\.49|Log Off|Other Actions|Open Page List|Rename\/Summary|Request Client|Manage Optional Forms|Copy Activity|\bHome\b|\bHistory\b|\bDocuments\b|☰|toolbar_|transactionBar/i;

function isChromeNoise(change) {
  const before = parseFingerprint(change.baselineValue);
  const after = parseFingerprint(change.currentValue);
  const hay = [
    change.fieldOrLocator,
    change.description,
    inventoryKey(change),
    before.label,
    before.text,
    after.label,
    after.text,
  ]
    .filter(Boolean)
    .join(' ');
  return CHROME_HINT.test(hay);
}

function blank(value) {
  if (value == null || value === '') return '(none)';
  return String(value);
}

function inventoryKey(change) {
  const desc = change.description || '';
  const fromDesc = desc.match(/:\s*([A-Za-z][\w-]*)\s*$/);
  if (fromDesc && !/^el_\d+$/i.test(fromDesc[1])) return fromDesc[1];
  const loc = String(change.fieldOrLocator || '');
  if (loc && !/^el_\d+$/i.test(loc) && loc !== change.page) return loc;
  return loc || '—';
}

function controlKind(fp, key) {
  const tag = (fp.tag || '').toLowerCase();
  const text = (fp.text || '').trim();
  const loc = String(key || '');
  if (/imgInfo|Info$/i.test(loc) || (tag === 'a' && !text)) {
    return 'info / icon link, not a form field you type into';
  }
  if (tag === 'a') return 'link in the page chrome or wizard';
  if (tag === 'button') return 'button';
  if (tag === 'select') return 'dropdown';
  if (tag === 'input' || tag === 'textarea') return `${fp.type || 'text'} input`;
  if (tag === 'span' || !tag) return 'control in Detect’s field inventory';
  return `<${tag}> control`;
}

function explainChange(change) {
  const page = pageTitle(change.page);
  const before = parseFingerprint(change.baselineValue);
  const after = parseFingerprint(change.currentValue);
  const key = inventoryKey(change);
  const kind = controlKind(after.tag ? after : before, key);
  const chrome = CHROME_HINT.test(key) || CHROME_HINT.test(before.label || '') || CHROME_HINT.test(after.label || '');
  const paragraphs = [];

  if (change.changeType === 'label-changed') {
    const fromLabel = before.label;
    const toLabel = after.label;
    if (!fromLabel && toLabel) {
      paragraphs.push(
        `Detect compared the same control on ${page}: ${kind} (inventory id ${key}). The baseline snapshot had no accessible name (label empty, visible text “${blank(before.text)}”). Live Detect now reads the accessible name “${toLabel}”.`,
      );
      if (/imgInfo/i.test(key) || /jurisdiction info/i.test(toLabel)) {
        paragraphs.push(
          'That is usually a tooltip, title, or aria-label on the info icon next to Jurisdiction — not a rename of the Jurisdiction dropdown itself.',
        );
      } else {
        paragraphs.push(
          'Detect’s label-changed type here is empty inventory name → this accessible name. The visible control may be the same; only how Detect named it changed.',
        );
      }
    } else if (fromLabel && toLabel && fromLabel !== toLabel) {
      paragraphs.push(
        `On ${page}, Detect matched inventory id ${key} (${kind}). The captured name changed from “${fromLabel}” to “${toLabel}”.`,
      );
    } else {
      paragraphs.push(
        `Detect recorded a label/fingerprint change for ${kind} on ${page} (inventory id ${key}). Visible text: baseline “${blank(before.text)}” → live “${blank(after.text)}”.`,
      );
    }
  } else if (change.changeType === 'added') {
    paragraphs.push(
      `Live Detect found a ${kind} on ${page} with name “${blank(after.label || after.text || key)}” that was not in the baseline inventory.`,
    );
    if (chrome) {
      paragraphs.push(
        'This often sits in the Jackson header or toolbar (for example the QA version string). It can appear “new” because chrome was outside the frozen wizard HTML, or because inventory started attaching nearby header text as a label.',
      );
    }
  } else if (change.changeType === 'removed') {
    paragraphs.push(
      `The baseline inventory had a ${kind} on ${page} (id ${key}, text “${blank(before.text || before.label)}”) and live Detect did not list that same key.`,
    );
    if (/^el_\d+$/i.test(String(change.fieldOrLocator))) {
      paragraphs.push(
        'Unlabeled el_* rows are usually extra inputs Detect numbered because it could not read a Firelight label. They are often inventory noise, not a Jackson field that disappeared.',
      );
    }
  } else if (change.changeType === 'option-changed') {
    paragraphs.push(`Dropdown options for this ${kind} on ${page} (id ${key}) differ between baseline and live.`);
  } else if (change.changeType === 'modified' && /Fill\/nav failed|waitFor/i.test(change.description || '')) {
    paragraphs.push(
      `Detect continued the wizard walk after a fill/navigation failure on ${page}: ${(change.description || '').split('\n')[0]}`,
    );
    paragraphs.push('That is a walk error recorded as unexpected, not a field-inventory rename.');
  } else {
    paragraphs.push(pageFieldCopy(change).detail);
    if (change.description) paragraphs.push(change.description.split('\n')[0]);
  }

  if (chrome) {
    paragraphs.push('Treat this as chrome / environment noise unless a Day 7 ticket named this control.');
  }

  const facts = [
    { term: 'Wizard page', value: page },
    { term: 'Inventory id', value: key },
    { term: 'Change type', value: change.changeType },
    { term: 'Control', value: `${blank(before.tag || after.tag)} · ${kind}` },
    { term: 'Baseline label / text', value: `${blank(before.label)} / ${blank(before.text)}` },
    { term: 'Live label / text', value: `${blank(after.label)} / ${blank(after.text)}` },
    { term: 'Classification', value: `${change.classification}${change.matchedTicketId ? ` (${change.matchedTicketId})` : ''}` },
    { term: 'Heal action', value: change.healAction || '—' },
  ];

  let aside = 'Heal only if Jackson announced this as expected. Unexpected rows stay as defect notes; do not silently patch locators.';
  if (change.healAction === 'file-defect' || change.classification === 'unexpected') {
    aside = 'Classified unexpected (no matching Day 7 ticket). Do not heal; optional /file-jira copies the Markdown defect.';
  } else if (change.classification === 'expected') {
    aside = 'Classified expected from a Day 7 ticket. Accept this ID in Change review, then /heal to update locators.';
  }

  return { paragraphs, facts, aside };
}
