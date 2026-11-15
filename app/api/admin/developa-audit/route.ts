import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { isMissingRelationError, supabaseAdmin } from '@/lib/forumServer';

export const dynamic = 'force-dynamic';

/** The trail of what each admin did, newest first. Optionally for one site. */
export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const siteId = new URL(request.url).searchParams.get('site_id');
  let q = supabaseAdmin.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(200);
  if (siteId) q = q.eq('site_id', siteId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ entries: [], needs_update: isMissingRelationError(error) });
  return NextResponse.json({ entries: data || [] });
}
