import { supabase } from './supabaseClient';

export interface EffectiveUserResult {
  user: any | null;
  profile: any | null;
  isImpersonating: boolean;
  adminUser?: any | null;
  adminProfile?: any | null;
}

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

  const impId = typeof window !== 'undefined' ? localStorage.getItem('impersonate_user_id') : null;
  const impEmail = typeof window !== 'undefined' ? localStorage.getItem('impersonate_user_email') : null;

  if (profile?.is_admin && impId) {
    const { data: impProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', impId)
      .single();

    if (impProfile) {
      return {
        user: { ...user, id: impId, email: impEmail || impProfile.email || undefined },
        profile: impProfile,
        isImpersonating: true,
        adminUser: user,
        adminProfile: profile
      };
    }
  }

  return { user, profile, isImpersonating: false };
}
