import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteThread, getThread, updateThread } from '@/lib/inbox';
import { adminOnly, failure } from '../../_util';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await adminOnly();
  if (!a.ok) return a.res;
  const { id } = await ctx.params;
  try {
    const d = await getThread(id);
    return d ? NextResponse.json(d) : NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  } catch (err) {
    return failure(err, 'Could not open the conversation.');
  }
}

const patchSchema = z.object({
  status: z.enum(['open', 'pending', 'resolved', 'spam']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assigned_to: z.string().max(200).nullable().optional(),
  starred: z.boolean().optional(),
  unread: z.boolean().optional(),
});

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await adminOnly();
  if (!a.ok) return a.res;
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid change.' }, { status: 400 });
  try {
    const t = await updateThread(id, parsed.data);
    return t ? NextResponse.json({ ok: true, thread: t }) : NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  } catch (err) {
    return failure(err, 'Could not update the conversation.');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await adminOnly();
  if (!a.ok) return a.res;
  const { id } = await ctx.params;
  try {
    await deleteThread(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failure(err, 'Could not delete it.');
  }
}
