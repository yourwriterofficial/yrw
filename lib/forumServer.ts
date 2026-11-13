import { createClient as createServiceClient } from '@supabase/supabase-js';

export const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Batch-resolves display names from `profiles` for a set of user IDs,
 * falling back to `'Member'` when no name is set.
 */
export async function resolveAuthorNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name')
    .in('id', unique);

  for (const row of data || []) {
    if (row.id) {
      map.set(row.id, (row.full_name || '').trim() || 'Member');
    }
  }
  return map;
}
