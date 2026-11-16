import { gzipSync } from 'zlib';
import { createCipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * The nightly Developa backup. It covers ONLY:
 *   1. PAID Developa stores (any plan above Starter) with everything that belongs to them: products, orders, customers,
 *      coupons, bookings, memberships, messages, posts, staff, plan payments and so on, plus the accounts of their owners.
 *   2. Developa admin settings: bans and limits, announcements, platform ads, theme prices and sales, the Script Shop,
 *      the developer page text, the admin history, and the support inbox mailboxes and saved replies.
 * It does NOT include free stores, project topics, wallets, quotes or any other YourResearchWriter data.
 *
 * The set is compressed, encrypted with AES-256-GCM (key from BACKUP_PASSPHRASE) and sent to a private Google Drive folder
 * through the Apps Script receiver in scripts/google-apps-script-backup-receiver.gs. Restore with scripts/restore-backup.mjs.
 * Not included: uploaded images and files in storage buckets, and visitor analytics (site_visits).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PAGE = 1000;

/** Developa admin settings: copied in full. */
export const SETTINGS_TABLES = [
  'admin_audit_log',
  'platform_announcements',
  'platform_site_ads',
  'theme_catalog',
  'theme_purchases',
  'developer_page_settings',
  'dev_products',
  'dev_product_purchases',
  'user_admin_state',
  'site_admin_state',
  'inbox_mailboxes',
  'inbox_macros',
];

/** Tables whose rows belong to one store through a site_id column. Copied only for paid stores. */
export const STORE_TABLES = [
  'site_products',
  'site_product_variants',
  'site_orders',
  'site_order_events',
  'site_coupons',
  'site_carts',
  'site_ad_slots',
  'site_ad_bookings',
  'site_booking_services',
  'site_bookings',
  'site_membership_tiers',
  'site_memberships',
  'site_messages',
  'site_moderation',
  'site_newsletters',
  'site_plan_payments',
  'site_push_subscriptions',
  'site_reports',
  'site_reviews',
  'site_shipping_zones',
  'site_staff',
  'site_subscribers',
  'site_support_requests',
];

export function encryptBackup(plain: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([Buffer.from('DVBK1'), salt, iv, cipher.getAuthTag(), ct]);
}

const headers = () => ({ apikey: KEY, Authorization: `Bearer ${KEY}` });

/** Reads a table (optionally only rows whose `column` is one of `values`), a page at a time. */
async function readRows(table: string, filter?: { column: string; values: string[] }): Promise<unknown[]> {
  if (filter && filter.values.length === 0) return [];
  const batches = filter ? chunk(filter.values, 60) : [null];
  const out: unknown[] = [];
  for (const batch of batches) {
    let start = 0;
    for (;;) {
      const q = batch && filter ? `&${filter.column}=in.(${batch.map(encodeURIComponent).join(',')})` : '';
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=*${q}`, {
        headers: { ...headers(), Range: `${start}-${start + PAGE - 1}`, 'Range-Unit': 'items' },
        cache: 'no-store',
      });
      if (r.status === 416) break;
      if (!r.ok) throw new Error(`${table}: ${r.status}`);
      const page = (await r.json()) as unknown[];
      out.push(...page);
      if (page.length < PAGE) break;
      start += page.length;
    }
  }
  return out;
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function readAccounts(ids: Set<string>): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let page = 1; page < 200; page++) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: headers(), cache: 'no-store' });
    if (!r.ok) throw new Error(`accounts: ${r.status}`);
    const j = (await r.json()) as { users?: Record<string, unknown>[] };
    const users = j.users || [];
    for (const u of users) {
      if (!ids.has(String(u.id))) continue;
      out.push({ id: u.id, email: u.email, phone: u.phone, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, email_confirmed_at: u.email_confirmed_at, app_metadata: u.app_metadata, user_metadata: u.user_metadata });
    }
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
    body: JSON.stringify({ secret, fileName, base64Data: data.toString('base64') }),
    redirect: 'follow',
  });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!r.ok || !j?.ok) throw new Error(`Drive upload failed: ${j?.error || r.status}`);
}

export interface BackupResult {
  files: { name: string; bytes: number }[];
  paid_stores: number;
  tables: Record<string, number>;
  rows: number;
  seconds: number;
}

export async function runPlatformBackup(): Promise<BackupResult> {
  const pass = process.env.BACKUP_PASSPHRASE || '';
  if (pass.length < 24) throw new Error('BACKUP_PASSPHRASE is missing or too short');
  const t0 = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const counts: Record<string, number> = {};
  const archive: Record<string, unknown> = { _meta: { created_at: new Date().toISOString(), format: 2, scope: 'developa paid stores and admin settings' } };

  // 1. Which stores are paid. Free stores are left out.
  const paidRes = await fetch(`${SUPABASE_URL}/rest/v1/forums?select=*&plan_tier=neq.free`, { headers: headers(), cache: 'no-store' });
  if (!paidRes.ok) throw new Error(`stores: ${paidRes.status}`);
  const stores = (await paidRes.json()) as Record<string, unknown>[];
  const siteIds = stores.map((s) => String(s.id));
  const ownerIds = new Set(stores.map((s) => String(s.owner_id)));
  archive.forums = stores;
  counts.forums = stores.length;

  // 2. Everything that belongs to those stores, several tables at a time.
  const jobs: { name: string; run: () => Promise<unknown[]> }[] = [
    ...STORE_TABLES.map((t) => ({ name: t, run: () => readRows(t, { column: 'site_id', values: siteIds }) })),
    { name: 'forum_members', run: () => readRows('forum_members', { column: 'forum_id', values: siteIds }) },
    { name: 'forum_threads', run: () => readRows('forum_threads', { column: 'forum_id', values: siteIds }) },
    { name: 'forum_posts', run: () => readRows('forum_posts', { column: 'forum_id', values: siteIds }) },
    ...SETTINGS_TABLES.map((t) => ({ name: t, run: () => readRows(t) })),
  ];
  const queue = [...jobs];
  const errors: string[] = [];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (;;) {
        const j = queue.shift();
        if (!j) return;
        try {
          archive[j.name] = await j.run();
          counts[j.name] = (archive[j.name] as unknown[]).length;
        } catch (e) {
          errors.push(`${j.name}: ${e instanceof Error ? e.message : 'failed'}`);
        }
      }
    })
  );
  // 3. The owners' profiles and accounts, and the admins (their settings reference them).
  const admins = (await readRows('profiles').then((rows) => (rows as { id: string; is_admin?: boolean }[]).filter((p) => p.is_admin))).map((p) => String(p.id));
  const people = new Set<string>(Array.from(ownerIds).concat(admins));
  const allProfiles = (await readRows('profiles', { column: 'id', values: Array.from(people) })) as unknown[];
  archive.profiles = allProfiles;
  counts.profiles = allProfiles.length;
  archive._accounts = await readAccounts(people);
  counts._accounts = (archive._accounts as unknown[]).length;

  // A backup that silently misses a table is worse than none: fail loudly so the owner is told.
  if (errors.length) throw new Error(`Some tables could not be read: ${errors.join('; ')}`);

  const enc = encryptBackup(gzipSync(Buffer.from(JSON.stringify(archive))), pass);
  const name = `${today}_developa-paid-stores-and-settings.dvbk`;
  await upload(name, enc);
  return {
    files: [{ name, bytes: enc.length }],
    paid_stores: stores.length,
    tables: counts,
    rows: Object.values(counts).reduce((n, v) => n + v, 0),
    seconds: Math.round((Date.now() - t0) / 100) / 10,
  };
}
