import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';
import { planFor } from '@/lib/plans';
import { clientIp, overLimit } from '@/lib/rateLimit';

const visitSchema = z.object({
  path: z.string().trim().max(200).optional().default('/'),
  referrer: z.string().trim().max(300).optional().default(''),
  utm_source: z.string().trim().max(80).optional().default(''),
  product_id: z.string().uuid().optional().nullable(),
});

function referrerHost(rawRef: string, slug: string): string {
  if (!rawRef) return '';
  try {
    const u = new URL(rawRef);
    const host = u.hostname.toLowerCase();
    if (host.includes('developa.me') || host.includes('localhost') || host.includes(slug)) {
      return '';
    }
    return host.slice(0, 120);
  } catch {
    return '';
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const normalizedSlug = slug.toLowerCase().trim();
    const ip = clientIp(request);

    if (overLimit(`visit:${normalizedSlug}:${ip}`, 60, 60 * 1000)) {
      return NextResponse.json({ ok: true });
    }

    const raw = await request.json().catch(() => ({}));
    const parsed = visitSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ok: true });
    }

    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id')
      .eq('slug', normalizedSlug)
      .maybeSingle();

    if (!site) return NextResponse.json({ ok: true });

    const todayUtc = new Date().toISOString().slice(0, 10);
    const ua = (request.headers.get('user-agent') || '').slice(0, 120);
    // Daily rotating one-way hash keeps visitor counts unique per day without storing IPs
    const sessionHash = crypto
      .createHash('sha256')
      .update(`${ip}|${ua}|${todayUtc}|${site.id}`)
      .digest('hex')
      .slice(0, 24);

    await Promise.resolve(
      supabaseAdmin.from('site_visits').insert({
        site_id: site.id,
        path: parsed.data.path || '/',
        referrer: referrerHost(parsed.data.referrer, normalizedSlug),
        utm_source: parsed.data.utm_source.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 60),
        product_id: parsed.data.product_id || null,
        session_hash: sessionHash,
      })
    ).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;

    const plan = planFor(access.site.plan_tier, access.site.plan_expires_at);
    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * 86400_000).toISOString();
    const sevenDaysAgo = new Date(now - 7 * 86400_000).toISOString();

    const [visitsRes, ordersRes, productsRes] = await Promise.all([
      supabaseAdmin
        .from('site_visits')
        .select('referrer, utm_source, product_id, session_hash, created_at')
        .eq('site_id', access.site.id)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from('site_orders')
        .select('id, payment_status, created_at')
        .eq('site_id', access.site.id)
        .gte('created_at', thirtyDaysAgo)
        .limit(1000),
      supabaseAdmin
        .from('site_products')
        .select('id, title')
        .eq('site_id', access.site.id),
    ]);

    if (visitsRes.error && /relation .*site_visits.* does not exist/i.test(visitsRes.error.message)) {
      return NextResponse.json({
        tableMissing: true,
        views7d: 0,
        views30d: 0,
        uniques30d: 0,
        orders30d: (ordersRes.data || []).length,
        conversionRate: 0,
        dailySeries: [],
        topReferrers: [],
        topProducts: [],
      });
    }

    const visits = visitsRes.data || [];
    const orders = ordersRes.data || [];
    const prodTitles = new Map((productsRes.data || []).map((p) => [p.id as string, p.title as string]));

    const uniques30 = new Set<string>();
    const uniques7 = new Set<string>();
    let views7d = 0;

    const dayBuckets = new Map<string, { views: number; orders: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86400_000).toISOString().slice(0, 10);
      dayBuckets.set(d, { views: 0, orders: 0 });
    }

    const refCounts = new Map<string, number>();
    const prodCounts = new Map<string, number>();

    for (const v of visits) {
      uniques30.add(v.session_hash);
      if (v.created_at >= sevenDaysAgo) {
        views7d++;
        uniques7.add(v.session_hash);
      }
      const dayKey = String(v.created_at).slice(0, 10);
      const bucket = dayBuckets.get(dayKey);
      if (bucket) bucket.views++;

      if (plan.deeperAnalytics) {
        const src = (v.utm_source || v.referrer || 'Direct').trim();
        refCounts.set(src, (refCounts.get(src) || 0) + 1);
        if (v.product_id) {
          prodCounts.set(v.product_id, (prodCounts.get(v.product_id) || 0) + 1);
        }
      }
    }

    let paidOrders30d = 0;
    for (const o of orders) {
      if (o.payment_status === 'paid') paidOrders30d++;
      const dayKey = String(o.created_at).slice(0, 10);
      const bucket = dayBuckets.get(dayKey);
      if (bucket) bucket.orders++;
    }

    const uniques30d = uniques30.size;
    const orders30d = orders.length;
    const conversionRate = uniques30d > 0 ? Math.min(100, Math.round((orders30d / uniques30d) * 1000) / 10) : 0;

    const topReferrers = plan.deeperAnalytics
      ? Array.from(refCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([source, count]) => ({ source, count }))
      : [];

    const topProducts = plan.deeperAnalytics
      ? Array.from(prodCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([product_id, views]) => ({
            product_id,
            title: prodTitles.get(product_id) || 'Product',
            views,
          }))
      : [];

    return NextResponse.json({
      views7d,
      views30d: visits.length,
      uniques7d: uniques7.size,
      uniques30d,
      orders30d,
      paidOrders30d,
      conversionRate,
      dailySeries: Array.from(dayBuckets.entries()).map(([date, vals]) => ({ date, ...vals })),
      topReferrers,
      topProducts,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load analytics' }, { status: 500 });
  }
}
