import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { exchangeCode, nairaguideClient } from '@/lib/nairaguide';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * Back from Nairaguide: swap the code for the member's verified profile, then sign them in to the matching
 * Supabase account (created on first visit), the same way the admin magic links do.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const p = req.nextUrl.searchParams;
  let saved: { state: string; verifier: string; next: string; brand: string } | null = null;
  try {
    saved = JSON.parse(req.cookies.get('ng_oauth')?.value || 'null');
  } catch {}
  const brandQs = saved?.brand === 'developa' ? '&brand=developa' : '';
  const fail = (message: string) => {
    const res = NextResponse.redirect(`${origin}/login?message=${encodeURIComponent(message)}${brandQs}`);
    res.cookies.delete('ng_oauth');
    res.headers.set('Cache-Control', 'no-store');
    return res;
  };

  if (p.get('error')) return fail(p.get('error') === 'access_denied' ? 'Nairaguide sign-in was cancelled.' : 'Nairaguide sign-in failed. Please try again.');
  if (!saved || !p.get('state') || p.get('state') !== saved.state || !p.get('code')) return fail('That sign-in attempt expired. Please try again.');

  let user;
  try {
    user = await exchangeCode(nairaguideClient(req.nextUrl.host), p.get('code')!, saved.verifier, `${origin}/api/auth/nairaguide/callback`);
  } catch {
    return fail('We could not reach Nairaguide. Please try again.');
  }
  if (!user.email) return fail('Nairaguide did not share an email address.');
  const email = user.email.toLowerCase();
  const name = user.name || user.preferred_username || email.split('@')[0];

  // First visit: create the account (the email is already verified by Nairaguide). Existing: reuse it.
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: name, nairaguide_id: user.sub, avatar_url: user.picture || undefined },
  });
  const exists = !!created.error && /already|registered|exists/i.test(created.error.message);
  if (created.error && !exists) return fail('Could not open your account. Please try again.');
  // Opening an existing account by email is only safe when Nairaguide has verified that email.
  if (exists && user.email_verified !== true) return fail('An account already uses this email. Verify your email on Nairaguide, then sign in again.');

  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return fail('Could not open your account. Please try again.');

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  if (error || !data.user) return fail('Could not open your account. Please try again.');

  const isAdminEmail = email === 'yourwriterofficial@gmail.com';
  const { data: existing } = await admin.from('profiles').select('id, full_name').eq('id', data.user.id).maybeSingle();
  await admin.from('profiles').upsert({ id: data.user.id, full_name: existing?.full_name || name, is_admin: isAdminEmail });

  let to = isAdminEmail ? `${origin}/admin` : saved.next ? `${origin}${saved.next}` : `${origin}/dashboard/client`;
  if (!isAdminEmail && saved.brand === 'developa' && !to.includes('brand=developa')) to += (to.includes('?') ? '&' : '?') + 'brand=developa';
  const res = NextResponse.redirect(to);
  res.cookies.delete('ng_oauth');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
