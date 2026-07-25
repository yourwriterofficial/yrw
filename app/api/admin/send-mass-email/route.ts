import { NextResponse } from 'next/server'
import { requireAdmin, listAllAuthUsers } from '@/lib/adminAuth'
import { notifyUsers, htmlToPreview } from '@/lib/notify'
import { emailShell } from '@/lib/emailTemplates'

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  try {
    const { subject, html, userIds, allUsers } = await req.json()
    if (!subject || !html) {
      return NextResponse.json({ error: 'Subject and message body are required' }, { status: 400 })
    }

    let recipientIds: string[];
    if (allUsers) {
      recipientIds = (await listAllAuthUsers(guard.admin)).map((u) => u.id);
    } else if (userIds && userIds.length) {
      recipientIds = userIds;
    } else {
      return NextResponse.json({ error: 'No recipients selected' }, { status: 400 })
    }

    if (recipientIds.length === 0) {
      return NextResponse.json({ error: 'No valid recipients found' }, { status: 400 })
    }

    // Sends email + in-app + push (per-user preference) through the unified pipeline.
    // Wrap the admin's body in the branded shell for a consistent look.
    // Broadcasts honour per-user email opt-outs (unlike one-to-one admin
    // messages), so report what actually went out rather than the headcount.
    const outcome = await notifyUsers(recipientIds, {
      title: subject,
      message: htmlToPreview(html),
      type: 'admin_message',
      isAdminSent: true,
      emailHtml: emailShell(html),
      emailSubject: subject,
    })

    await guard.admin.from('mass_notification_logs').insert({
      sent_by: guard.userId,
      subject,
      recipient_count: recipientIds.length,
      all_users: !!allUsers,
    })

    return NextResponse.json({
      success: true,
      sentCount: recipientIds.length,
      emailed: outcome.emailed,
      optedOut: outcome.optedOut,
      failed: outcome.failed,
    })
  } catch (err: any) {
    console.error('Mass email error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}