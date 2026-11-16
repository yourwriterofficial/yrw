import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { exchangeProsepenCode } from '@/lib/prosepen';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!);

/**
 * Back from ProsePen: swap the code for the member's verified profile, link it to the Developa account
 * with the same email (created on first visit) and sign them in. Only a verified email is ever trusted.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const p = req.nextUrl.searchParams;
  let saved: { state: string; verifier: string; next: string } | null = null;
  try {
    saved = JSON.parse(req.cookies.get('pp_oauth')?.value || 'null');
  } catch {}
  const fail = (message: string) => {
    const res = NextResponse.redirect(`${origin}/login?brand=developa&message=${encodeURIComponent(message)}`);
    res.cookies.delete('pp_oauth');
    res.headers.set('Cache-Control', 'no-store');
    return res;
  };

  if (p.get('error')) return fail(p.get('error') === 'access_denied' ? 'ProsePen sign-in was cancelled.' : 'ProsePen sign-in failed. Please try again.');
  if (!saved || !p.get('state') || p.get('state') !== saved.state || !p.get('code')) return fail('That sign-in attempt expired. Please try again.');

  let user;
  try {
    user = await exchangeProsepenCode(p.get('code')!, saved.verifier, `${origin}/api/auth/prosepen/callback`);
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'unknown';
    console.error('[prosepen sign-in] code exchange failed:', reason);
    return fail(`ProsePen sign-in could not be completed (${reason.slice(0, 80)}). Please try again.`);
  }
  if (!user.email) return fail('ProsePen did not share an email address.');
  if (user.email_verified !== true) return fail('Confirm your email on ProsePen first, then sign in again.');
  const email = user.email.toLowerCase();
  const name = user.name || email.split('@')[0];

  // What we keep from ProsePen: who they are and their plan name. Nothing else.
  const link_meta = { prosepen_id: user.sub, prosepen_tier: user.prosepen_tier || null };

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: name, avatar_url: user.picture || undefined, ...link_meta },
  });
  const exists = !!created.error && /already|registered|exists/i.test(created.error.message);
  if (created.error && !exists) return fail('Could not open your account. Please try again.');

  if (exists) {
    // Existing Developa account with this verified email: attach the ProsePen link to it.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const match = list?.users.find((u) => (u.email || '').toLowerCase() === email);
    if (match) await admin.auth.admin.updateUserById(match.id, { user_metadata: { ...match.user_metadata, ...link_meta } });
  }

  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return fail('Could not open your account. Please try again.');

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  if (error || !data.user) return fail('Could not open your account. Please try again.');

  const { data: existing } = await admin.from('profiles').select('id, full_name, is_admin').eq('id', data.user.id).maybeSingle();
  // Never touch the admin flag here: signing in through ProsePen must not change anyone's access.
  if (!existing) await admin.from('profiles').insert({ id: data.user.id, full_name: name, is_admin: false });

  const to = saved.next ? `${origin}${saved.next}` : `${origin}/developer/manage`;
  const res = NextResponse.redirect(to);
  res.cookies.delete('pp_oauth');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
