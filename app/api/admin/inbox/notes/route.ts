import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addNote } from '@/lib/inbox';
import { adminOnly, failure } from '../_util';

const schema = z.object({ thread_id: z.string().uuid(), content: z.string().trim().min(1).max(4000) });

/** A private note on a conversation. Only admins ever see it. */
export async function POST(request: Request) {
  const a = await adminOnly();
  if (!a.ok) return a.res;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Write the note.' }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, note: await addNote(parsed.data.thread_id, a.g.email, a.g.email.split('@')[0], parsed.data.content) });
  } catch (err) {
    return failure(err, 'Could not save the note.');
  }
}
