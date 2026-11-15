import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendReply } from '@/lib/inbox';
import { adminOnly, failure } from '../_util';

export const dynamic = 'force-dynamic';

const schema = z.object({
  mailbox_id: z.string().uuid(),
  thread_id: z.string().uuid().nullable().optional(),
  to: z.string().trim().email().max(200),
  subject: z.string().trim().min(1).max(250),
  body: z.string().trim().min(1).max(20000),
  cc: z.array(z.string().trim().email()).max(5).optional(),
  customer_name: z.string().trim().max(120).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  set_status: z.enum(['open', 'pending', 'resolved']).optional(),
});

/** Send a reply (or a new message) from one of the brand mailboxes. */
export async function POST(request: Request) {
  const a = await adminOnly();
  if (!a.ok) return a.res;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the recipient, subject and message.' }, { status: 400 });
  try {
    const r = await sendReply({ ...parsed.data, thread_id: parsed.data.thread_id ?? null, sent_by: a.g.email });
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return failure(err, 'Could not send the message.');
  }
}
