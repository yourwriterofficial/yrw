import { NextResponse } from 'next/server';
import { overLimit, clientIp } from '@/lib/rateLimit';
import { downloadsForOrder, isMissingColumnError, readExtendedSite, supabaseAdmin } from '@/lib/forumServer';
import { planFor } from '@/lib/plans';

export async function GET(
  request: Request,
  context: { params: Promise<{ orderCode: string }> }
) {
  try {
    if (overLimit(`receipt:${clientIp(request)}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });
    }

    const { orderCode } = await context.params;
    const { searchParams } = new URL(request.url);
    const email = (searchParams.get('email') || '').trim().toLowerCase();
    const slug = (searchParams.get('slug') || '').trim().toLowerCase();

    if (!orderCode || !email) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    let siteIdFilter: string | null = null;
    if (slug) {
      const { data: s } = await supabaseAdmin.from('forums').select('id').eq('slug', slug).maybeSingle();
      if (!s) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      siteIdFilter = s.id;
    }

    let q = supabaseAdmin
      .from('site_orders')
      .select('id, order_code, site_id, buyer_name, buyer_email, buyer_phone, delivery_address, items, subtotal, total_amount, payment_method, payment_status, fulfillment_status, coupon_code, discount_amount, shipping_fee, shipping_zone, delivery_method, delivery_state, created_at')
      .eq('order_code', orderCode.trim())
      .eq('buyer_email', email);
    if (siteIdFilter) q = q.eq('site_id', siteIdFilter);

    const { data: order, error } = await q.maybeSingle();
    if (isMissingColumnError(error)) {
      let fq = supabaseAdmin
        .from('site_orders')
        .select('id, order_code, site_id, buyer_name, buyer_email, buyer_phone, delivery_address, items, subtotal, total_amount, payment_method, payment_status, fulfillment_status, coupon_code, discount_amount, created_at')
        .eq('order_code', orderCode.trim())
        .eq('buyer_email', email);
      if (siteIdFilter) fq = fq.eq('site_id', siteIdFilter);
      const fallback = await fq.maybeSingle();
      if (!fallback.data) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      return buildResponse(fallback.data);
    }

    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    return buildResponse(order);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load receipt' }, { status: 500 });
  }
}

async function buildResponse(order: Record<string, unknown>) {
  const { data: site } = await supabaseAdmin
    .from('forums')
    .select('id, slug, name, logo_url, currency, whatsapp_number, plan_tier, custom_domain, custom_domain_verified')
    .eq('id', order.site_id)
    .maybeSingle();

  if (!site) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  const ext = await readExtendedSite(site.id);
  const plan = planFor(site.plan_tier, ext?.plan_expires_at);
  if (!plan.receipts) {
    return NextResponse.json({ error: 'Printable receipts are available on the store Pro plan.' }, { status: 403 });
  }

  const downloads = order.payment_status === 'paid'
    ? await downloadsForOrder(site.id, order.items as { product_id?: string }[])
    : [];

  return NextResponse.json({ site, order, downloads });
}
