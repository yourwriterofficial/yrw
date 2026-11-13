import { supabase } from '@/lib/supabaseClient';

const ADMIN_CACHE_PREFIX = 'yrw_is_admin_';
const inflight = new Map<string, Promise<boolean>>();

/**
 * Resolves `profiles.is_admin` for a user with sessionStorage caching and
 * in-flight request deduplication so header mounts and route transitions
 * do not repeatedly query Supabase.
 */
export async function resolveIsAdmin(userId: string): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      const cached = sessionStorage.getItem(`${ADMIN_CACHE_PREFIX}${userId}`);
      if (cached === '1') return true;
      if (cached === '0') return false;
    } catch {
      // sessionStorage unavailable
    }
  }

  const existing = inflight.get(userId);
  if (existing) return existing;

  const req = (async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();
      const isAdmin = !!profile?.is_admin;
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(`${ADMIN_CACHE_PREFIX}${userId}`, isAdmin ? '1' : '0');
        } catch {
          // ignore
        }
      }
      return isAdmin;
    } finally {
      inflight.delete(userId);
    }
  })();

  inflight.set(userId, req);
  return req;
}

export function clearIsAdminCache(userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (userId) {
      sessionStorage.removeItem(`${ADMIN_CACHE_PREFIX}${userId}`);
      return;
    }
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(ADMIN_CACHE_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}
