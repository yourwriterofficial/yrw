import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/adminAuth';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { to, subject, html } = await request.json();
    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const { data, error } = await resend.emails.send({
      from: 'YourResearchWriter <noreply@yourresearchwriter.com.ng>',
      to,
      subject,
      html,
    });
    if (error) throw error;

    // Log to email_logs for in-app alerts
    await supabaseAdmin.from('email_logs').insert({
      recipient: to,
      subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Send email error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}