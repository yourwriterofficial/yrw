import { supabase } from './supabaseClient';

export interface EffectiveUserResult {
  user: any | null;
  profile: any | null;
  isImpersonating: boolean;
  adminUser?: any | null;
  adminProfile?: any | null;
}

const IMPERSONATION_KEYS = [
  'impersonate_user_id',
  'impersonate_user_email',
  'impersonate_user_name',
  'impersonate_started_at',
] as const;

const MAX_IMPERSONATION_HOURS = 2;

/** Safely check if we're currently in an impersonation session (client-side only) */
export function isCurrentlyImpersonating(): boolean {
  if (typeof window === 'undefined') return false;
  const id = localStorage.getItem('impersonate_user_id');
  if (!id) return false;

  // Auto-expire stale sessions
  const startedAt = localStorage.getItem('impersonate_started_at');
  if (startedAt) {
    const elapsed = Date.now() - new Date(startedAt).getTime();
    if (elapsed > MAX_IMPERSONATION_HOURS * 60 * 60 * 1000) {
      clearImpersonation();
      return false;
    }
  }
  return true;
}

/** Get impersonation target info (client-side only) */
export function getImpersonationTarget(): { id: string; email: string; name: string } | null {
  if (typeof window === 'undefined') return null;
  if (!isCurrentlyImpersonating()) return null;
  return {
    id: localStorage.getItem('impersonate_user_id') || '',
    email: localStorage.getItem('impersonate_user_email') || '',
    name: localStorage.getItem('impersonate_user_name') || '',
  };
}

/** Start an impersonation session (client-side only). Call from admin panel. */
export function startImpersonation(userId: string, email: string, name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('impersonate_user_id', userId);
  localStorage.setItem('impersonate_user_email', email);
  localStorage.setItem('impersonate_user_name', name);
  localStorage.setItem('impersonate_started_at', new Date().toISOString());
}

/** Clear all impersonation data (client-side only) */
export function clearImpersonation(): void {
  if (typeof window === 'undefined') return;
  IMPERSONATION_KEYS.forEach(key => localStorage.removeItem(key));
}

/** 
 * Get the effective user — returns the impersonated user if an admin
 * is currently impersonating, otherwise the real logged-in user.
 * Includes auto-expiry check.
 */
export async function getEffectiveUser(): Promise<EffectiveUserResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, profile: null, isImpersonating: false };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Check for active impersonation (with auto-expiry)
  if (!isCurrentlyImpersonating()) {
    return { user, profile, isImpersonating: false };
  }

  const impId = localStorage.getItem('impersonate_user_id');

  // Only admins can impersonate
  if (profile?.is_admin && impId) {
    const { data: impProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', impId)
      .single();

    if (impProfile) {
      const impEmail = localStorage.getItem('impersonate_user_email');
      return {
        user: { ...user, id: impId, email: impEmail || impProfile.email || undefined },
        profile: impProfile,
        isImpersonating: true,
        adminUser: user,
        adminProfile: profile
      };
    }
  }

  // If we get here, impersonation data is stale or invalid — clean up
  clearImpersonation();
  return { user, profile, isImpersonating: false };
}
