import { NextResponse } from 'next/server';
import { requireAdmin, listAllAuthUsers } from '@/lib/adminAuth';
import { notifyUsers } from '@/lib/notify';

/**
 * Pushes an in-app + push notification (no email) to all users or a selected
 * subset, via the shared notifyUser pipeline (lib/notify.ts) so it also
 * respects per-user push preferences and lands in the unified `notifications`
 * table the bell reads from.
 */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { message, userIds, allUsers } = await req.json();

    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) {
      return NextResponse.json({ error: 'A notification message is required.' }, { status: 400 });
    }

    let recipientIds: string[];
    if (allUsers) {
      recipientIds = (await listAllAuthUsers(guard.admin)).map((u) => u.id);
    } else if (Array.isArray(userIds) && userIds.length) {
      recipientIds = userIds;
    } else {
      return NextResponse.json({ error: 'Select recipients (all users or a custom list).' }, { status: 400 });
    }

    if (recipientIds.length === 0) {
      return NextResponse.json({ error: 'No valid recipients found.' }, { status: 400 });
    }

    await notifyUsers(recipientIds, {
      title: 'Message from YourResearchWriter',
      message: text,
      type: 'admin_message',
      isAdminSent: true,
    });

    return NextResponse.json({ success: true, count: recipientIds.length });
  } catch (err: any) {
    console.error('send-notification error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send notification' }, { status: 500 });
  }
}
