import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { sendAuthLinkEmail } from '@/lib/magicLink';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { userId, email } = await request.json();
    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing userId or email' }, { status: 400 });
    }

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
    const name = profile?.full_name || email.split('@')[0];

    const link = await sendAuthLinkEmail({
      email,
      name,
      type: 'recovery',
      next: '/update-password',
      title: 'Password Reset Requested',
      introHtml: `<p>An admin has requested a password reset for your account. Click below to set a new password:</p>`,
      ctaText: 'Reset Password',
    });
    if (!link) {
      return NextResponse.json({ error: 'Failed to generate reset link' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}