import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/forumServer';
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

  return NextResponse.json({ checked: refs.size, settled });
}
