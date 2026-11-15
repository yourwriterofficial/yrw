import { NextResponse } from 'next/server';
import { z } from 'zod';
import { batchUpdate } from '@/lib/inbox';
import { adminOnly, failure } from '../../_util';

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(['status', 'priority', 'assign', 'read', 'unread', 'delete']),
  value: z.string().max(200).optional(),
});

/** Do the same thing to many conversations at once. */
export async function POST(request: Request) {
  const a = await adminOnly();
  if (!a.ok) return a.res;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Pick conversations and an action.' }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await batchUpdate(parsed.data.ids, parsed.data.action, parsed.data.value)) });
  } catch (err) {
    return failure(err, 'Could not apply that.');
  }
}
