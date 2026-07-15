import { NextResponse } from 'next/server';
import { requireAdmin, listAllAuthUsers } from '@/lib/adminAuth';
import { notifyUser } from '@/lib/notify';
import { sendSystemEmail } from '@/lib/emailService';

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { to, subject, html } = await request.json();
    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // If `to` matches a registered user, route through the unified pipeline
    // (email + in-app + push, respecting preferences). Otherwise, plain email.
    const users = await listAllAuthUsers(guard.admin);
    const match = users.find((u) => u.email.toLowerCase() === String(to).toLowerCase());

    const { emailShell } = await import('@/lib/emailTemplates');
    const wrappedHtml = emailShell(html);

    if (match) {
      await notifyUser({
        userId: match.id,
        title: subject,
        message: 'You have a new message from YourResearchWriter — tap to view.',
        type: 'admin_message',
        isAdminSent: true,
        emailHtml: wrappedHtml,
        emailSubject: subject,
      });
    } else {
      await sendSystemEmail({ to, subject, html: wrappedHtml });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Send email error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}