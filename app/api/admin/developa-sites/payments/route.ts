import { NextResponse } from 'next/server';
import { supabaseAdmin, isPlatformAdmin } from '@/lib/forumServer';

/** The plan-payments ledger for the founder, newest first, with the site name attached. */
export async function GET() {
  if (!(await isPlatformAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('site_plan_payments')
    .select('id, site_id, plan_tier, months, amount, reference, note, created_at')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ payments: [], needs_update: true });

  const ids = Array.from(new Set((data || []).map((p) => p.site_id)));
  const names = new Map<string, { name: string; slug: string }>();
  if (ids.length > 0) {
    const { data: sites } = await supabaseAdmin.from('forums').select('id, name, slug').in('id', ids);
    (sites || []).forEach((s) => names.set(s.id, { name: s.name, slug: s.slug }));
  }
  return NextResponse.json({
    payments: (data || []).map((p) => ({ ...p, site_name: names.get(p.site_id)?.name || 'Deleted site', site_slug: names.get(p.site_id)?.slug || '' })),
  });
}
