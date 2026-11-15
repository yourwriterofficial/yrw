import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addMailbox, getMailboxes, updateMailbox } from '@/lib/inbox';
import { adminOnly, failure } from '../_util';

export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await adminOnly();
  if (!a.ok) return a.res;
  try {
    return NextResponse.json({ mailboxes: await getMailboxes() });
  } catch (err) {
    return failure(err, 'Could not load mailboxes.');
  }
}

const addSchema = z.object({ address: z.string().trim().email().max(200), display_name: z.string().trim().max(80).default(''), brand: z.enum(['developa', 'yourwriter']) });

/** Add an address (for example the Developa support address once it exists) and say which brand it belongs to. */
export async function POST(request: Request) {
  const a = await adminOnly();
  if (!a.ok) return a.res;
  const parsed = addSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a full email address and pick a brand.' }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, mailbox: await addMailbox(parsed.data.address, parsed.data.display_name, parsed.data.brand) }, { status: 201 });
  } catch (err) {
    return failure(err, 'Could not add the mailbox.');
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().trim().max(80).optional(),
  brand: z.enum(['developa', 'yourwriter']).optional(),
  status: z.enum(['active', 'paused']).optional(),
});

export async function PATCH(request: Request) {
  const a = await adminOnly();
  if (!a.ok) return a.res;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid change.' }, { status: 400 });
  const { id, ...rest } = parsed.data;
  try {
    await updateMailbox(id, rest);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failure(err, 'Could not update the mailbox.');
  }
}
