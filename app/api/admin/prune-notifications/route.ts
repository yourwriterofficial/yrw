import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

/**
 * Deletes in-app notifications (email_logs rows). Supports targeted deletes by
 * id list or recipient, age-based pruning, or clearing everything.
 */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { ids, recipient, olderThanDays, all } = await req.json();

    let query = guard.admin.from('email_logs').delete({ count: 'exact' });

    if (Array.isArray(ids) && ids.length) {
      query = query.in('id', ids);
    } else if (recipient) {
      query = query.eq('recipient', recipient);
    } else if (typeof olderThanDays === 'number' && olderThanDays > 0) {
      const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
      query = query.lt('sent_at', cutoff);
    } else if (all === true) {
      // delete() requires a filter; match every row.
      query = query.gte('id', 0);
    } else {
      return NextResponse.json(
        { error: 'Specify ids, recipient, olderThanDays, or all:true.' },
        { status: 400 }
      );
    }

    const { error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, deleted: count ?? 0 });
  } catch (err: any) {
    console.error('prune-notifications error:', err);
    return NextResponse.json({ error: err.message || 'Failed to prune notifications' }, { status: 500 });
  }
}
