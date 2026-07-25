import { NextResponse } from 'next/server';
import { requireAdmin, listAllAuthUsers } from '@/lib/adminAuth';
import { notifyUser, htmlToPreview } from '@/lib/notify';
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
    // (email + in-app + push) so they also get the bell alert. Otherwise, plain email.
    const users = await listAllAuthUsers(guard.admin);
    const match = users.find((u) => u.email.toLowerCase() === String(to).toLowerCase());

    const { emailShell } = await import('@/lib/emailTemplates');
    const wrappedHtml = emailShell(html);

    if (match) {
      // forceEmail: an admin typing a one-to-one message to a specific address
      // means it to be delivered. Without this the send was silently dropped
      // whenever the recipient had admin-message emails switched off, while the
      // UI still reported success.
      const result = await notifyUser({
        userId: match.id,
        title: subject,
        message: htmlToPreview(html),
        type: 'admin_message',
        isAdminSent: true,
        emailHtml: wrappedHtml,
        emailSubject: subject,
        forceEmail: true,
      });
      if (!result.emailed) {
        return NextResponse.json(
          { error: `In-app alert delivered, but the email could not be sent (${result.emailSkipReason || 'unknown'}).` },
          { status: 502 }
        );
      }
    } else {
      await sendSystemEmail({ to, subject, html: wrappedHtml });
    }

    return NextResponse.json({ success: true, emailed: true });
  } catch (err: any) {
    console.error('Send email error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}