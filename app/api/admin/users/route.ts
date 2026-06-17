import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, is_admin, whatsapp')
      .order('full_name');
    if (profilesError) throw profilesError;

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;
    const emailMap: Record<string, string> = {};
    authUsers.users.forEach((u: any) => { emailMap[u.id] = u.email; });

    const { data: wallets, error: walletsError } = await supabase
      .from('wallets')
      .select('user_id, balance');
    if (walletsError) throw walletsError;
    const walletMap: Record<string, number> = {};
    wallets?.forEach(w => { walletMap[w.user_id] = w.balance; });

    const users = profiles.map((profile: any) => ({
      id: profile.id,
      full_name: profile.full_name || '',
      email: emailMap[profile.id] || '',
      is_admin: profile.is_admin || false,
      whatsapp: profile.whatsapp || '',
      balance: walletMap[profile.id] || 0,
    }));

    return NextResponse.json({ users });
  } catch (err: any) {
    console.error('Admin users fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}