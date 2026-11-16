import { gzipSync } from 'zlib';
import { createCipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * The nightly platform backup. Every table is exported with the service key, the whole set is compressed and then
 * encrypted with AES-256-GCM (key from BACKUP_PASSPHRASE), and the scrambled file is sent to a private Google Drive
 * folder through the Apps Script receiver in scripts/google-apps-script-backup-receiver.gs.
 *
 * What is included: every table in the public schema, plus the account list (id, email, dates and profile data; never
 * password hashes). The very large project_topics catalogue (100,000+ rows) is backed up in parts on Sundays. What is NOT included:
 * uploaded images and files in storage buckets.
 *
 * Restore with scripts/restore-backup.mjs.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PAGE = 1000;
const BIG_TABLES = new Set(['project_topics']);
const BUDGET_MS = 52_000;

export function encryptBackup(plain: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([Buffer.from('DVBK1'), salt, iv, cipher.getAuthTag(), ct]);
}

const headers = () => ({ apikey: KEY, Authorization: `Bearer ${KEY}` });

async function listTables(): Promise<string[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers: headers(), cache: 'no-store' });
  if (!r.ok) throw new Error(`Could not list tables (${r.status})`);
  const spec = (await r.json()) as { paths?: Record<string, unknown> };
  return Object.keys(spec.paths || {}).filter((p) => p !== '/' && !p.startsWith('/rpc/')).map((p) => p.slice(1)).sort();
}

async function readTable(table: string, from = 0, maxRows = Infinity): Promise<{ rows: unknown[]; done: boolean }> {
  const rows: unknown[] = [];
  let start = from;
  for (;;) {
    const want = Math.min(PAGE, maxRows - rows.length);
    if (want <= 0) return { rows, done: false };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=*`, {
      headers: { ...headers(), Range: `${start}-${start + want - 1}`, 'Range-Unit': 'items' },
      cache: 'no-store',
    });
    if (r.status === 416) return { rows, done: true };
    if (!r.ok) throw new Error(`${table}: ${r.status}`);
    const page = (await r.json()) as unknown[];
    rows.push(...page);
    if (page.length < want) return { rows, done: true };
    start += page.length;
  }
}

async function readAccounts(): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let page = 1; page < 200; page++) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: headers(), cache: 'no-store' });
    if (!r.ok) throw new Error(`accounts: ${r.status}`);
    const j = (await r.json()) as { users?: Record<string, unknown>[] };
    const users = j.users || [];
    for (const u of users) out.push({ id: u.id, email: u.email, phone: u.phone, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, email_confirmed_at: u.email_confirmed_at, app_metadata: u.app_metadata, user_metadata: u.user_metadata });
    if (users.length < 1000) break;
  }
  return out;
}

async function upload(fileName: string, data: Buffer) {
  const url = process.env.DRIVE_BACKUP_URL;
  const secret = process.env.DRIVE_BACKUP_SECRET;
  if (!url || !secret) throw new Error('DRIVE_BACKUP_URL or DRIVE_BACKUP_SECRET is not set');
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret, fileName: fileName, base64Data: data.toString('base64') }),
    redirect: 'follow',
  });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!r.ok || !j?.ok) throw new Error(`Drive upload failed: ${j?.error || r.status}`);
}

export interface BackupResult {
  files: { name: string; bytes: number }[];
  tables: number;
  rows: number;
  skipped: string[];
  seconds: number;
}

export async function runPlatformBackup(): Promise<BackupResult> {
  const pass = process.env.BACKUP_PASSPHRASE || '';
  if (pass.length < 24) throw new Error('BACKUP_PASSPHRASE is missing or too short');
  const t0 = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const isSunday = new Date().getUTCDay() === 0;
  const result: BackupResult = { files: [], tables: 0, rows: 0, skipped: [], seconds: 0 };

  const tables = await listTables();
  const archive: Record<string, unknown> = { _meta: { created_at: new Date().toISOString(), format: 1 } };
  // Read several tables at once; each one is small, so this finishes in a few seconds.
  const queue = tables.filter((t) => !BIG_TABLES.has(t));
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (;;) {
        const t = queue.shift();
        if (!t) return;
        if (Date.now() - t0 > BUDGET_MS) { result.skipped.push(t); continue; }
        const { rows } = await readTable(t);
        archive[t] = rows;
        result.tables++;
        result.rows += rows.length;
      }
    })
  );
  archive._accounts = await readAccounts();

  const main = encryptBackup(gzipSync(Buffer.from(JSON.stringify(archive))), pass);
  const mainName = `${today}_developa-main.dvbk`;
  await upload(mainName, main);
  result.files.push({ name: mainName, bytes: main.length });

  // The large catalogue goes up in parts, on Sundays only, while time allows.
  if (isSunday) {
    for (const t of tables.filter((x) => BIG_TABLES.has(x))) {
      let from = 0;
      for (let part = 1; ; part++) {
        if (Date.now() - t0 > BUDGET_MS) { result.skipped.push(`${t} (from row ${from})`); break; }
        const { rows, done } = await readTable(t, from, 12_000);
        if (rows.length) {
          const enc = encryptBackup(gzipSync(Buffer.from(JSON.stringify({ [t]: rows }))), pass);
          const name = `${today}_${t}-part${String(part).padStart(2, '0')}.dvbk`;
          await upload(name, enc);
          result.files.push({ name, bytes: enc.length });
          result.rows += rows.length;
          from += rows.length;
        }
        if (done) break;
      }
    }
  }
  result.seconds = Math.round((Date.now() - t0) / 100) / 10;
  return result;
}
