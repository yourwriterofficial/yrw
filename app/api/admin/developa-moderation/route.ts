import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { requireAdmin } from '@/lib/adminAuth';
import { isMissingRelationError, supabaseAdmin } from '@/lib/forumServer';
import { writeAudit } from '@/lib/adminState';
import { notifyUser } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/** A site's products and posts, with which ones the platform has taken down. */
export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const siteId = new URL(request.url).searchParams.get('site_id');
  if (!siteId) return NextResponse.json({ error: 'Missing site_id.' }, { status: 400 });
  const [products, threads, removed] = await Promise.all([
    supabaseAdmin.from('site_products').select('id, title, price, is_active, product_type').eq('site_id', siteId).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('forum_threads').select('id, title, author_id, created_at').eq('forum_id', siteId).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('site_moderation').select('item_type, item_id, reason').eq('site_id', siteId),
  ]);
  const removedMap = new Map((removed.data || []).map((r) => [`${r.item_type}:${r.item_id}`, r.reason as string]));
  const mark = <T extends { id: string }>(rows: T[] | null, type: string) => (rows || []).map((r) => ({ ...r, removed: removedMap.has(`${type}:${r.id}`), removed_reason: removedMap.get(`${type}:${r.id}`) || '' }));
  return NextResponse.json({
    needs_update: isMissingRelationError(removed.error),
    products: mark(products.data as { id: string }[] | null, 'product'),
    threads: mark(threads.data as { id: string }[] | null, 'thread'),
  });
}

const schema = z.object({
  action: z.enum(['remove', 'restore']),
  site_id: z.string().uuid(),
  item_type: z.enum(['product', 'thread']),
  item_id: z.string().uuid(),
  reason: z.string().trim().max(400).default(''),
  report_id: z.string().uuid().optional(),
  notify_owner: z.boolean().default(true),
});

/**
 * Takes a product or post down (the public stops seeing it and the owner cannot switch it back on), or puts it back.
 * Removing from a report also marks that report as dealt with.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const d = parsed.data;
  const NEEDS_DB = 'Removing items needs the latest database update first (run the reports_scheduling_ad_stats migration).';

  const { data: site } = await supabaseAdmin.from('forums').select('id, name, slug, owner_id').eq('id', d.site_id).maybeSingle();
  if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });
  const table = d.item_type === 'product' ? 'site_products' : 'forum_threads';
  const col = d.item_type === 'product' ? 'site_id' : 'forum_id';
  const { data: item } = await supabaseAdmin.from(table).select('id, title').eq('id', d.item_id).eq(col, d.site_id).maybeSingle();
  if (!item) return NextResponse.json({ error: 'That item does not belong to this site.' }, { status: 404 });

  if (d.action === 'remove') {
    const { error } = await supabaseAdmin.from('site_moderation').upsert({ site_id: d.site_id, item_type: d.item_type, item_id: d.item_id, reason: xss(d.reason), removed_by: guard.userId }, { onConflict: 'item_type,item_id' });
    if (error) return NextResponse.json({ error: isMissingRelationError(error) ? NEEDS_DB : 'Could not remove it.' }, { status: isMissingRelationError(error) ? 503 : 500 });
    if (d.item_type === 'product') await supabaseAdmin.from('site_products').update({ is_active: false }).eq('id', d.item_id);
  } else {
    const { error } = await supabaseAdmin.from('site_moderation').delete().eq('item_type', d.item_type).eq('item_id', d.item_id);
    if (error) return NextResponse.json({ error: isMissingRelationError(error) ? NEEDS_DB : 'Could not restore it.' }, { status: 500 });
  }

  if (d.report_id) {
    await supabaseAdmin.from('site_reports').update({ status: d.action === 'remove' ? 'actioned' : 'reviewing', resolution: d.action === 'remove' ? `Removed: ${xss(d.reason)}`.slice(0, 500) : 'Restored', handled_by: guard.userId, handled_at: new Date().toISOString() }).eq('id', d.report_id);
  }
  await writeAudit({ admin_id: guard.userId, admin_email: guard.email, action: `${d.item_type}_${d.action === 'remove' ? 'removed' : 'restored'}`, site_id: d.site_id, target_type: d.item_type, target_id: d.item_id, detail: { title: item.title, reason: d.reason, name: site.name } });
  if (d.notify_owner && d.action === 'remove' && site.owner_id) {
    await notifyUser({ userId: site.owner_id, title: `An ${d.item_type === 'product' ? 'item' : 'post'} on "${site.name}" was removed`, message: `"${item.title}" was taken down. ${d.reason || 'It broke our rules.'} Contact developa.me support if you think this is a mistake.`, type: 'admin_message', isAdminSent: true, link: `/developer/manage?site=${site.slug}` }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
