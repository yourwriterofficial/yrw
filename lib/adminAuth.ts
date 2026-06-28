import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js';

export type AdminGuardResult =
  | { ok: true; userId: string; email: string; admin: SupabaseClient }
  | { ok: false; status: number; error: string };

/**
 * Verifies the caller is the platform admin. Use at the top of every
 * /api/admin/* route — middleware does NOT auth-gate /api/*, so each route is
 * responsible for its own authorization.
 *
 * Returns a ready-to-use service-role client on success so callers don't have
 * to construct their own.
 */
export async function requireAdmin(): Promise<AdminGuardResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' };

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  const adminEmail = (process.env.ADMIN_EMAIL || 'yourwriterofficial@gmail.com').toLowerCase();
  const isAdmin = profile?.is_admin === true || user.email?.toLowerCase() === adminEmail;
  if (!isAdmin) return { ok: false, status: 403, error: 'Forbidden' };

  return { ok: true, userId: user.id, email: user.email || '', admin };
}

/**
 * Fetches every auth user (handles pagination — the admin API caps page size,
 * so a single call silently drops users beyond the first page on large bases).
 */
export async function listAllAuthUsers(
  admin: SupabaseClient
): Promise<{ id: string; email: string }[]> {
  const out: { id: string; email: string }[] = [];
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email) out.push({ id: u.id, email: u.email });
    }
    if (users.length < perPage) break;
  }
  return out;
}
