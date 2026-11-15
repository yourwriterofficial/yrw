/** Small helper for the platform admin screens. */
export async function adminApi<T = Record<string, unknown>>(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, data };
}

export interface SiteStateRow {
  site_id: string;
  status: 'active' | 'restricted' | 'suspended' | 'banned';
  restrictions: Record<string, boolean | number | null | undefined>;
  reason: string;
  admin_note: string;
  updated_at: string | null;
}

export interface UserStateRow {
  user_id: string;
  status: 'active' | 'restricted' | 'banned';
  max_sites_override: number | null;
  reason: string;
  admin_note: string;
}

export const STATUS_STYLE: Record<string, string> = {
  active: 'text-success',
  restricted: 'text-warning',
  suspended: 'text-danger',
  banned: 'text-danger',
};
