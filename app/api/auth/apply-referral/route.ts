import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { applyReferralIfEligible } from '@/lib/affiliate';

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Called right after a fresh email/password registration to link the new
 * account to whoever referred them (captured client-side as ?ref=<username>).
 *
 * Takes `userId` from the request body rather than the session cookie: this
 * runs immediately after supabase.auth.signUp(), before the user has confirmed
 * their email, so there is no session yet to authenticate against.
 * applyReferralIfEligible() is safe to expose this way — it only ever sets
 * referred_by once per profile (guarded by `referred_by IS NULL`) and never
 * moves money itself; actual commission crediting happens later, gated on a
 * real purchase, via creditReferralCommission().
 */
export async function POST(request: Request) {
  try {
    const { userId, refCode } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    await applyReferralIfEligible(admin, { userId, refCode });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Apply referral error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
