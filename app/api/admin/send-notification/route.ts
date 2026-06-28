import { NextResponse } from 'next/server';
import { requireAdmin, listAllAuthUsers } from '@/lib/adminAuth';

/**
 * Pushes an in-app notification (no email) to the notification bell of all
 * users or a selected subset. Notifications are stored as `email_logs` rows —
 * the same store the bell already reads from — one row per recipient so that
 * read-state is tracked per user.
 */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { message, userIds, allUsers, orderId } = await req.json();

    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) {
      return NextResponse.json({ error: 'A notification message is required.' }, { status: 400 });
    }

    let recipients: string[];
    if (allUsers) {
      recipients = (await listAllAuthUsers(guard.admin)).map((u) => u.email);
    } else if (Array.isArray(userIds) && userIds.length) {
      const all = await listAllAuthUsers(guard.admin);
      const byId = new Map(all.map((u) => [u.id, u.email]));
      recipients = userIds.map((id: string) => byId.get(id)).filter((e): e is string => !!e);
    } else {
      return NextResponse.json({ error: 'Select recipients (all users or a custom list).' }, { status: 400 });
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No valid recipients found.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const rows = recipients.map((recipient) => ({
      recipient,
      subject: text,
      status: 'sent',
      sent_at: now,
      order_id: orderId || null,
    }));

    const { error } = await guard.admin.from('email_logs').insert(rows);
    if (error) throw error;

    return NextResponse.json({ success: true, count: rows.length });
  } catch (err: any) {
    console.error('send-notification error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send notification' }, { status: 500 });
  }
}
