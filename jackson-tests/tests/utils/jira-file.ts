import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import https from 'node:https';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(ROOT, '.env') });

export const DEFECTS_DIR = path.join(ROOT, 'tests/reports/changes/defects');

export type DefectNote = {
  id: string;
  body: string;
  jiraKey: string | null;
  jiraUrl: string | null;
};

function siteBase(): string {
  return (process.env.JIRA_CLOUD_SITE || '').replace(/\/+$/, '');
}

export function jiraBrowseUrl(key: string): string | null {
  const site = siteBase();
  if (!site || !key) return null;
  return `${site}/browse/${key}`;
}

export function parseJiraKey(body: string): string | null {
  const hit = body.match(/Jira:\s*([A-Z][A-Z0-9]+-\d+)/i);
  return hit?.[1] || null;
}

export function listDefectNotes(): DefectNote[] {
  if (!fs.existsSync(DEFECTS_DIR)) return [];
  return fs
    .readdirSync(DEFECTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => {
      const id = f.replace(/\.md$/, '');
      const body = fs.readFileSync(path.join(DEFECTS_DIR, f), 'utf8');
      const jiraKey = parseJiraKey(body);
      return { id, body, jiraKey, jiraUrl: jiraKey ? jiraBrowseUrl(jiraKey) : null };
    });
}

export function jiraUiStatus() {
  const site = siteBase();
  const projectKey = (process.env.JIRA_PROJECT_KEY || '').trim();
  const email = (process.env.JIRA_EMAIL || process.env.FIRELIGHT_USERNAME || '').trim();
  const token = (process.env.JIRA_API_TOKEN || '').trim();
  return {
    site: site || null,
    projectKey: projectKey || null,
    configured: Boolean(site && projectKey && email && token),
    hint: !site
      ? 'Set JIRA_CLOUD_SITE in jackson-tests/.env'
      : !projectKey
        ? 'Set JIRA_PROJECT_KEY in jackson-tests/.env (use JFS if QA has no create permission)'
        : !token
          ? 'Set JIRA_EMAIL and JIRA_API_TOKEN for the UI (Cursor /file-jira uses MCP instead). Create a token at https://id.atlassian.com/manage-account/security/api-tokens'
          : `Will create Bugs in ${projectKey} on ${site}. Live-detect PNGs under tests/reports/changes/evidence/ are attached.`,
  };
}

function adfFromText(text: string) {
  const blocks = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    }));
  return {
    type: 'doc',
    version: 1,
    content: blocks.length ? blocks : [{ type: 'paragraph', content: [{ type: 'text', text: text || '—' }] }],
  };
}

function field(body: string, label: string): string {
  const hit = body.match(new RegExp(`-\\s*${label}:\\s*(.+)`, 'i'));
  return (hit?.[1] || '').trim();
}

function networkCode(err: unknown): string {
  const e = err as { message?: string; cause?: { code?: string; message?: string; cause?: { code?: string } } };
  return e.cause?.cause?.code || e.cause?.code || e.message || String(err);
}

function tlsInsecure(): boolean {
  return process.env.JIRA_TLS_INSECURE === '1' || process.env.JIRA_TLS_INSECURE === 'true';
}

function imageMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

function isImagePath(filePath: string): boolean {
  return /\.(png|jpe?g|gif|webp)$/i.test(filePath);
}

/** Prefer a PNG/JPEG on disk; rehearsal JSON paths are not attachable. */
export function resolveEvidenceImage(changeId: string, evidenceHint?: string): string | null {
  const note = listDefectNotes().find((d) => d.id === changeId);
  const candidates = [evidenceHint, note ? field(note.body, 'Evidence') : '', note ? path.join('tests/reports/changes/evidence', `${field(note.body, 'Page')}.png`) : '']
    .filter(Boolean) as string[];
  for (const raw of candidates) {
    const abs = path.isAbsolute(raw) ? raw : path.join(ROOT, raw);
    if (fs.existsSync(abs) && isImagePath(abs)) return abs;
  }
  return null;
}

function attachmentMultipart(filePath: string): { body: Buffer; contentType: string } {
  const boundary = `----JacksonPoc${Date.now()}`;
  const filename = path.basename(filePath).replace(/"/g, '');
  const fileBuf = fs.readFileSync(filePath);
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${imageMime(filePath)}\r\n\r\n`,
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    body: Buffer.concat([header, fileBuf, footer]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function jiraRequest(url: string, init: RequestInit, insecure: boolean): Promise<Response> {
  if (!insecure) return fetch(url, init);
  const parsed = new URL(url);
  const headers = new Headers(init.headers);
  const raw = init.body;
  const body = Buffer.isBuffer(raw) ? raw : typeof raw === 'string' ? raw : undefined;
  if (Buffer.isBuffer(body) && !headers.has('content-length')) {
    headers.set('Content-Length', String(body.length));
  }
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: init.method || 'GET',
        headers: Object.fromEntries(headers.entries()),
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => {
          resolve(
            new Response(Buffer.concat(chunks), {
              status: res.statusCode || 500,
              headers: res.headers as HeadersInit,
            }),
          );
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function attachEvidence(issueKey: string, auth: string, filePath: string): Promise<void> {
  const site = siteBase();
  const { body, contentType } = attachmentMultipart(filePath);
  const res = await jiraFetch(`${site}/rest/api/3/issue/${issueKey}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'X-Atlassian-Token': 'no-check',
      'Content-Type': contentType,
    },
    body: body as unknown as BodyInit,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text.slice(0, 240) || `Jira attach HTTP ${res.status}`);
  }
}

async function jiraFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await jiraRequest(url, init, tlsInsecure());
  } catch (err) {
    const code = networkCode(err);
    if (code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' || code.includes('unable to get local issuer certificate')) {
      return await jiraRequest(url, init, true);
    }
    throw new Error(`Jira network error: ${code}`);
  }
}

export function writeDefectStub(change: {
  changeId: string;
  page?: string;
  fieldOrLocator?: string;
  severity?: string;
  changeType?: string;
  classification?: string;
  description?: string;
  evidenceScreenshot?: string;
}) {
  fs.mkdirSync(DEFECTS_DIR, { recursive: true });
  const file = path.join(DEFECTS_DIR, `${change.changeId}.md`);
  if (fs.existsSync(file)) return;
  const body = `# Defect ${change.changeId}

- Page: ${change.page || ''}
- Field: ${change.fieldOrLocator || ''}
- Severity: ${change.severity || ''}
- Type: ${change.changeType || ''}
- Classification: ${change.classification || 'unexpected'}
- Description: ${change.description || ''}
- Evidence: ${change.evidenceScreenshot || ''}
- Action: Do not heal; track with Jackson
`;
  fs.writeFileSync(file, body);
}

export async function createJiraForDefect(
  changeId: string,
  evidenceHint?: string,
): Promise<{ key: string; url: string; skipped?: boolean; attached?: string; attachError?: string }> {
  const status = jiraUiStatus();
  if (!status.configured) {
    throw new Error(status.hint);
  }
  const note = listDefectNotes().find((d) => d.id === changeId);
  if (!note) throw new Error(`No defect Markdown for ${changeId}`);
  if (note.jiraKey && note.jiraUrl) {
    return { key: note.jiraKey, url: note.jiraUrl, skipped: true };
  }

  const email = (process.env.JIRA_EMAIL || process.env.FIRELIGHT_USERNAME || '').trim();
  const token = (process.env.JIRA_API_TOKEN || '').trim();
  const site = siteBase();
  const projectKey = (process.env.JIRA_PROJECT_KEY || '').trim();
  const page = field(note.body, 'Page') || 'unknown';
  const fieldName = field(note.body, 'Field') || 'unknown';
  const summary = `[FLQANEXT] ${changeId} ${page} ${fieldName}`.slice(0, 255);
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const evidenceImage = resolveEvidenceImage(changeId, evidenceHint);

  const res = await jiraFetch(`${site}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary,
        issuetype: { name: 'Bug' },
        description: adfFromText(
          `${note.body.trim()}\n\nDo not heal; track with Jackson.\nSource: jackson-tests/tests/reports/changes/defects/${changeId}.md${evidenceImage ? `\nScreenshot attached: ${path.basename(evidenceImage)}` : ''}`,
        ),
        labels: ['firelight', 'flqanext', 'poc'],
      },
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    key?: string;
    errorMessages?: string[];
    errors?: Record<string, string>;
  };
  if (!res.ok || !payload.key) {
    const extra = payload.errors ? Object.values(payload.errors).join('; ') : '';
    throw new Error(payload.errorMessages?.join('; ') || extra || `Jira HTTP ${res.status}`);
  }
  const file = path.join(DEFECTS_DIR, `${changeId}.md`);
  let body = fs.readFileSync(file, 'utf8').trimEnd();
  if (!parseJiraKey(body)) body += `\n- Jira: ${payload.key}\n`;
  fs.writeFileSync(file, body.endsWith('\n') ? body : `${body}\n`);

  let attached: string | undefined;
  let attachError: string | undefined;
  if (evidenceImage) {
    try {
      await attachEvidence(payload.key, auth, evidenceImage);
      attached = path.relative(ROOT, evidenceImage);
    } catch (err) {
      attachError = err instanceof Error ? err.message : String(err);
    }
  }
  return { key: payload.key, url: jiraBrowseUrl(payload.key) as string, attached, attachError };
}
