import { supabaseAdmin, isMissingRelationError } from '@/lib/forumServer';

/**
 * What the platform (the admin) has decided about a site or an account: active, restricted, suspended or
 * banned, plus switches that turn individual abilities off. Stored in site_admin_state and user_admin_state
 * (server only). If the tables do not exist yet, everything reads as "active", so the site keeps working
 * until the database update is applied.
 */

export type SiteStatus = 'active' | 'restricted' | 'suspended' | 'banned';
export type UserStatus = 'active' | 'restricted' | 'banned';

export interface Restrictions {
  no_online_payments?: boolean;
  no_newsletters?: boolean;
  no_custom_domain?: boolean;
  no_new_products?: boolean;
  hide_from_directory?: boolean;
  product_cap?: number | null;
}

export const RESTRICTION_LABELS: { key: keyof Omit<Restrictions, 'product_cap'>; label: string; hint: string }[] = [
  { key: 'no_online_payments', label: 'No online payments', hint: 'Buyers cannot pay by card or transfer through the site' },
  { key: 'no_newsletters', label: 'No customer emails', hint: 'The owner cannot send newsletters' },
  { key: 'no_custom_domain', label: 'No custom domain', hint: 'Blocks connecting or using their own domain' },
  { key: 'no_new_products', label: 'No new products', hint: 'Existing items stay, but nothing can be added' },
  { key: 'hide_from_directory', label: 'Hide from the public list', hint: 'Not shown on the developa.me stores page' },
];

export interface SiteState {
  status: SiteStatus;
  restrictions: Restrictions;
  reason: string;
  admin_note: string;
  updated_at: string | null;
}

export const ACTIVE_STATE: SiteState = { status: 'active', restrictions: {}, reason: '', admin_note: '', updated_at: null };

const cache = new Map<string, { at: number; state: SiteState }>();
const TTL_MS = 10_000;

export async function getSiteState(siteId: string): Promise<SiteState> {
  const hit = cache.get(siteId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.state;
  const { data, error } = await supabaseAdmin.from('site_admin_state').select('status, restrictions, reason, admin_note, updated_at').eq('site_id', siteId).maybeSingle();
  let state = ACTIVE_STATE;
  if (!error && data) state = { status: data.status as SiteStatus, restrictions: (data.restrictions || {}) as Restrictions, reason: data.reason || '', admin_note: data.admin_note || '', updated_at: data.updated_at };
  else if (error && !isMissingRelationError(error)) console.warn('site_admin_state read failed:', error.message);
  cache.set(siteId, { at: Date.now(), state });
  return state;
}

export function forgetSiteState(siteId: string) { cache.delete(siteId); }

export const isSiteBlocked = (s: SiteState) => s.status === 'suspended' || s.status === 'banned';

/** Returns an error message if the site may not do this, otherwise null. */
export async function blockedReason(siteId: string, restriction?: keyof Omit<Restrictions, 'product_cap'>): Promise<string | null> {
  const s = await getSiteState(siteId);
  if (isSiteBlocked(s)) return s.reason ? `This site is ${s.status}: ${s.reason}` : `This site is ${s.status}.`;
  if (restriction && s.restrictions[restriction]) return s.reason ? `This feature is switched off for this site: ${s.reason}` : 'This feature is switched off for this site.';
  return null;
}

export async function writeAudit(entry: { admin_id: string; admin_email: string; action: string; target_type?: string; target_id?: string; site_id?: string | null; detail?: Record<string, unknown> }) {
  const { error } = await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: entry.admin_id,
    admin_email: entry.admin_email,
    action: entry.action,
    target_type: entry.target_type || 'site',
    target_id: entry.target_id || null,
    site_id: entry.site_id || null,
    detail: entry.detail || {},
  });
  if (error && !isMissingRelationError(error)) console.warn('audit write failed:', error.message);
}

/** Sites that must not appear in public lists (suspended, banned, or hidden by the admin). */
export async function hiddenFromPublic(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin.from('site_admin_state').select('site_id, status, restrictions');
  if (error) return new Set();
  return new Set(
    (data || [])
      .filter((r) => r.status === 'suspended' || r.status === 'banned' || (r.restrictions as Restrictions | null)?.hide_from_directory)
      .map((r) => r.site_id as string)
  );
}

export interface UserState { status: UserStatus; max_sites_override: number | null; reason: string }

export async function getUserState(userId: string): Promise<UserState> {
  const { data, error } = await supabaseAdmin.from('user_admin_state').select('status, max_sites_override, reason').eq('user_id', userId).maybeSingle();
  if (error || !data) return { status: 'active', max_sites_override: null, reason: '' };
  return { status: data.status as UserStatus, max_sites_override: data.max_sites_override ?? null, reason: data.reason || '' };
}
