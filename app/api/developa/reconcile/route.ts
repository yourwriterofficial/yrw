import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin, releaseStock } from '@/lib/forumServer';
import { settleDevelopaPayment } from '@/lib/developaPay';

export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

/**
 * Called by the Cloudflare Worker cron trigger to reconcile pending Paystack
 * checkouts (last 48h) without consuming a Vercel Hobby cron slot.
 */
export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = new Date(Date.now() - 48 * 3600_000).toISOString();
  const refs = new Set<string>();

  const [plans, themes, bookings, orders] = await Promise.all([
    supabaseAdmin.from('site_plan_payments').select('reference').eq('status', 'pending').gte('created_at', since).limit(20),
    supabaseAdmin.from('theme_purchases').select('reference').eq('status', 'pending').gte('created_at', since).limit(20),
    supabaseAdmin.from('site_ad_bookings').select('reference').eq('status', 'pending').gte('created_at', since).limit(20),
    supabaseAdmin.from('site_orders').select('paystack_reference').eq('payment_status', 'pending').not('paystack_reference', 'is', null).gte('created_at', since).limit(20),
  ]);

  for (const r of plans.data || []) if (r.reference?.startsWith('dev_')) refs.add(r.reference);
  for (const r of themes.data || []) if (r.reference?.startsWith('dev_')) refs.add(r.reference);
  for (const r of bookings.data || []) if (r.reference?.startsWith('dev_')) refs.add(r.reference);
  for (const r of orders.data || []) if (r.paystack_reference?.startsWith('dev_')) refs.add(r.paystack_reference);

  let settled = 0;
  for (const ref of Array.from(refs)) {
    const res = await settleDevelopaPayment(ref).catch(() => ({ ok: false, alreadyPaid: false }));
    if (res.ok && !res.alreadyPaid) settled++;
  }

  // Online checkouts nobody paid within a day are closed, and the reserved stock goes back on the shelf.
  // Each one is checked with Paystack one last time first, so a late payment is never thrown away.
  let expired = 0;
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: stale } = await supabaseAdmin
    .from('site_orders')
    .select('id, site_id, items, paystack_reference')
    .eq('payment_method', 'paystack')
    .eq('payment_status', 'pending')
    .lt('created_at', dayAgo)
    .limit(30);
  for (const o of (stale || []) as { id: string; site_id: string; items: { product_id: string | number; variant_id?: string | null; qty: number }[]; paystack_reference: string | null }[]) {
    if (o.paystack_reference?.startsWith('dev_')) {
      const res = await settleDevelopaPayment(o.paystack_reference).catch(() => ({ ok: false, alreadyPaid: false }));
      if (res.ok) continue;
    }
    const { data: closed } = await supabaseAdmin
      .from('site_orders')
      .update({ payment_status: 'rejected', fulfillment_status: 'cancelled' })
      .eq('id', o.id)
      .eq('payment_status', 'pending')
      .select('id');
    if (closed && closed.length) {
      await releaseStock(o.site_id, o.items || []).catch(() => null);
      expired++;
    }
  }

  return NextResponse.json({ checked: refs.size, settled, expired });
}
