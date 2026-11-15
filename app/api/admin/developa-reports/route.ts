import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { requireAdmin } from '@/lib/adminAuth';
import { isMissingRelationError, supabaseAdmin } from '@/lib/forumServer';
import { writeAudit } from '@/lib/adminState';

export const dynamic = 'force-dynamic';

/** The queue of reports from the public, newest first, with how many open reports each site has. */
export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const status = new URL(request.url).searchParams.get('status');
  let q = supabaseAdmin.from('site_reports').select('*').order('created_at', { ascending: false }).limit(200);
  if (status && ['open', 'reviewing', 'actioned', 'dismissed'].includes(status)) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ reports: [], open_count: 0, needs_update: isMissingRelationError(error) });

  const reports = data || [];
  const siteIds = Array.from(new Set(reports.map((r) => r.site_id as string)));
  const [{ data: sites }, openAll] = await Promise.all([
    siteIds.length ? supabaseAdmin.from('forums').select('id, name, slug, owner_id').in('id', siteIds) : Promise.resolve({ data: [] }),
    supabaseAdmin.from('site_reports').select('site_id', { count: 'exact' }).in('status', ['open', 'reviewing']),
  ]);
  const siteById = new Map((sites || []).map((s) => [s.id as string, s]));
  const openBySite = new Map<string, number>();
  for (const r of openAll.data || []) openBySite.set(r.site_id as string, (openBySite.get(r.site_id as string) || 0) + 1);

  // The title of the reported product or post, so the admin sees what it is without opening anything.
  const productIds = reports.filter((r) => r.target_type === 'product' && r.target_id).map((r) => r.target_id as string);
  const threadIds = reports.filter((r) => r.target_type === 'thread' && r.target_id).map((r) => r.target_id as string);
  const [prods, threads] = await Promise.all([
    productIds.length ? supabaseAdmin.from('site_products').select('id, title').in('id', productIds) : Promise.resolve({ data: [] }),
    threadIds.length ? supabaseAdmin.from('forum_threads').select('id, title').in('id', threadIds) : Promise.resolve({ data: [] }),
  ]);
  const titleOf = new Map<string, string>([...(prods.data || []), ...(threads.data || [])].map((x) => [x.id as string, x.title as string]));

  return NextResponse.json({
    open_count: openAll.count ?? 0,
    reports: reports.map((r) => ({
      ...r,
      reporter_key: undefined,
      site_name: siteById.get(r.site_id)?.name || 'Deleted site',
      site_slug: siteById.get(r.site_id)?.slug || '',
      owner_id: siteById.get(r.site_id)?.owner_id || null,
      target_title: r.target_id ? titleOf.get(r.target_id as string) || null : null,
      open_for_site: openBySite.get(r.site_id as string) || 0,
    })),
  });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['open', 'reviewing', 'actioned', 'dismissed']),
  resolution: z.string().trim().max(500).optional().default(''),
});

export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const d = parsed.data;
  const done = d.status === 'actioned' || d.status === 'dismissed';
  const { data: row, error } = await supabaseAdmin.from('site_reports').update({
    status: d.status,
    resolution: xss(d.resolution),
    handled_by: done ? guard.userId : null,
    handled_at: done ? new Date().toISOString() : null,
  }).eq('id', d.id).select('site_id').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not update the report.' }, { status: 500 });
  await writeAudit({ admin_id: guard.userId, admin_email: guard.email, action: `report_${d.status}`, target_type: 'report', target_id: d.id, site_id: row?.site_id as string | undefined, detail: { resolution: d.resolution } });
  return NextResponse.json({ ok: true });
}
