import { NextResponse } from 'next/server';
import { counts, listThreads } from '@/lib/inbox';
import { adminOnly, failure } from '../_util';

export const dynamic = 'force-dynamic';

/** The conversation list, with how many need attention for each brand. */
export async function GET(request: Request) {
  const a = await adminOnly();
  if (!a.ok) return a.res;
  const u = new URL(request.url).searchParams;
  try {
    const assigned = u.get('assignedTo');
    const [threads, summary] = await Promise.all([
      listThreads({
        brand: u.get('brand') || 'all',
        status: u.get('status') || undefined,
        mailboxId: u.get('mailboxId') || undefined,
        assignedTo: assigned === 'me' ? a.g.email : assigned || undefined,
        q: u.get('q') || undefined,
        unread: u.get('unread') === '1',
        limit: Number(u.get('limit')) || 100,
      }),
      counts(),
    ]);
    return NextResponse.json({ threads, counts: summary, me: a.g.email });
  } catch (err) {
    return failure(err, 'Could not load the inbox.');
  }
}
