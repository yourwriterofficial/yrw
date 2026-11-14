import { findUsableCoupon, discountFor } from '@/lib/coupons';
import { downloadsForOrder, isMissingColumnError, readExtendedSite, readSiteTools, requireSiteAccess, reserveStock, releaseStock } from '@/lib/forumServer';
import { emailOrderReceived } from '@/lib/storeEmails';
import { computeShipping, type ShippingZoneRow } from '@/lib/shipping';
import { planFor } from '@/lib/plans';
import { sendSitePush } from '@/lib/sitePush';
import { overLimit, clientIp } from '@/lib/rateLimit';
import crypto from 'node:crypto';
import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/forumServer';

const createOrderSchema = z.object({
  coupon_code: z.string().trim().max(30).optional().default(''),
  buyer_name: z.string().trim().min(2, 'Full name is required').max(100),
  buyer_email: z.string().trim().email('Valid email is required').max(150),
  buyer_phone: z.string().trim().min(5, 'Phone or WhatsApp number is required').max(30),
  delivery_address: z.string().trim().max(400).optional().default(''),
  delivery_method: z.enum(['delivery', 'pickup']).optional().default('delivery'),
  delivery_state: z.string().trim().max(60).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
  payment_method: z.enum(['manual_transfer', 'pay_on_delivery']).default('manual_transfer'),
  payment_reference: z.string().trim().max(120).optional().default(''),
  payment_proof_note: z.string().trim().max(400).optional().default(''),
  marketing_consent: z.boolean().optional().default(false),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        variant_id: z.string().uuid().optional(),
        qty: z.number().int().min(1).max(99),
      })
    )
    .min(1, 'Your cart is empty')
    .max(50),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') || '').trim();
    const email = (searchParams.get('email') || '').trim().toLowerCase();

    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, owner_id')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();

    if (!site) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    if (code && email) {
      // Codes are short, so make guessing impractical: limit attempts per visitor.
      if (overLimit(`order-lookup:${clientIp(request)}`, 15, 10 * 60 * 1000)) {
        return NextResponse.json({ error: 'Too many lookups. Please wait a few minutes.' }, { status: 429 });
      }
      const { data: order } = await supabaseAdmin
        .from('site_orders')
        .select('*')
        .eq('site_id', site.id)
        .eq('order_code', code)
        .eq('buyer_email', email) // exact match: ilike would treat % and _ as wildcards
        .maybeSingle();

      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

      // Strip internal owner-only fields before returning to buyers.
      const { internal_note: _internalNote, buyer_id: _buyerId, ...publicOrder } = order as Record<string, unknown>;

      // Download links are released only once the store owner has confirmed payment.
      const downloads = order.payment_status === 'paid' ? await downloadsForOrder(site.id, order.items) : [];
      return NextResponse.json({ order: publicOrder, downloads });
    }

    const access = await requireSiteAccess(slug, ['owner', 'manager', 'packer', 'support']);
    if ('error' in access) return access.error;

    const { data: orders, error } = await supabaseAdmin
      .from('site_orders')
      .select('*')
      .eq('site_id', site.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ orders: orders || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load orders';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, slug, site_mode, owner_id, name, currency, whatsapp_number, bank_name, bank_account_number, bank_account_name, payment_instructions, plan_tier')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();

    if (!site || site.site_mode === 'forum') {
      return NextResponse.json({ error: 'Storefront not found' }, { status: 404 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = createOrderSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid order' }, { status: 400 });
    }

    const productIds = parsed.data.items.map((i) => i.product_id);
    const { data: dbProducts, error: prodErr } = await supabaseAdmin
      .from('site_products')
      .select('id, title, product_type, price, stock_qty, is_active')
      .eq('site_id', site.id)
      .eq('is_active', true)
      .in('id', productIds);

    if (prodErr) throw prodErr;

    const productMap = new Map((dbProducts || []).map((p) => [p.id, p]));
    const variantIds = parsed.data.items.map((i) => i.variant_id).filter(Boolean) as string[];
    const variantMap = new Map<string, { id: string; product_id: string; label: string; price: number; stock_qty: number | null; is_active: boolean }>();
    if (variantIds.length > 0) {
      const { data: dbVariants, error: varErr } = await supabaseAdmin
        .from('site_product_variants')
        .select('id, product_id, label, price, stock_qty, is_active')
        .eq('site_id', site.id)
        .eq('is_active', true)
        .in('id', variantIds);
      if (varErr) {
        return NextResponse.json({ error: 'Selected product options are not available yet.' }, { status: 400 });
      }
      for (const v of dbVariants || []) {
        variantMap.set(v.id as string, v as { id: string; product_id: string; label: string; price: number; stock_qty: number | null; is_active: boolean });
      }
    }

    const orderItems = [];
    let subtotal = 0;

    for (const reqItem of parsed.data.items) {
      const prod = productMap.get(reqItem.product_id);
      if (!prod) {
        return NextResponse.json({ error: 'One or more products are no longer available.' }, { status: 400 });
      }
      let linePrice = Number(prod.price);
      let title = prod.title;
      let variantId: string | undefined;
      let variantLabel: string | undefined;
      let stockCheck = prod.stock_qty;

      if (reqItem.variant_id) {
        const variant = variantMap.get(reqItem.variant_id);
        if (!variant || variant.product_id !== prod.id) {
          return NextResponse.json({ error: `The chosen option for "${prod.title}" is no longer available.` }, { status: 400 });
        }
        linePrice = Number(variant.price);
        variantId = variant.id;
        variantLabel = variant.label;
        title = `${prod.title} (${variant.label})`;
        stockCheck = variant.stock_qty;
      }

      if (stockCheck !== null && stockCheck < reqItem.qty) {
        return NextResponse.json({ error: `Not enough stock for "${title}".` }, { status: 400 });
      }
      subtotal += linePrice * reqItem.qty;
      orderItems.push({
        product_id: prod.id,
        ...(variantId ? { variant_id: variantId, variant_label: variantLabel } : {}),
        title,
        product_type: prod.product_type,
        price: linePrice,
        qty: reqItem.qty,
      });
    }

    const supabase = await createServerClient();
    if (overLimit(`order-create:${clientIp(request)}`, 10, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many orders from this device. Please wait a few minutes.' }, { status: 429 });
    }

    // A coupon is re-checked here: the amount the browser showed is never trusted.
    let discount = 0;
    let couponUsed: { id: string; code: string; used_count: number } | null = null;
    if (parsed.data.coupon_code) {
      const { coupon } = await findUsableCoupon(site.id, parsed.data.coupon_code);
      if (coupon) {
        discount = discountFor(coupon, subtotal);
        couponUsed = { id: coupon.id, code: coupon.code, used_count: coupon.used_count };
      }
    }
    const extSite = await readExtendedSite(site.id);
    const plan = planFor((site as { plan_tier?: string }).plan_tier, extSite?.plan_expires_at);
    const hasPhysical = orderItems.some((i) => i.product_type === 'physical');
    let shippingFee = 0;
    let shippingZone = '';
    let resolvedMethod: 'delivery' | 'pickup' = 'delivery';
    if (plan.shippingZones && hasPhysical) {
      const [{ data: zonesData }, toolsData] = await Promise.all([
        supabaseAdmin
          .from('site_shipping_zones')
          .select('id, name, states, fee, free_over, is_active')
          .eq('site_id', site.id)
          .eq('is_active', true),
        readSiteTools(site.id),
      ]);
      const zones = (zonesData as ShippingZoneRow[] | null) || [];
      resolvedMethod = parsed.data.delivery_method === 'pickup' && toolsData.pickup_address ? 'pickup' : 'delivery';
      const calc = computeShipping({
        deliveryMethod: resolvedMethod,
        state: parsed.data.delivery_state,
        subtotalAfterDiscount: Math.max(0, subtotal - discount),
        zones,
      });
      shippingFee = calc.fee;
      shippingZone = calc.zoneName;
    }

    const grandTotal = Math.max(0, subtotal - discount + shippingFee);

    // Take the stock now so the last item cannot be sold twice. It is returned if saving fails.
    const reserved = await reserveStock(site.id, orderItems);
    if (!reserved.ok) {
      return NextResponse.json({ error: `Sorry, "${reserved.title || 'an item'}" just sold out.` }, { status: 409 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    const orderCode = `ORD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const hasProof = parsed.data.payment_method === 'manual_transfer' && !!parsed.data.payment_reference.trim();

    const baseInsert = {
      order_code: orderCode,
      site_id: site.id,
      buyer_id: user?.id || null,
      buyer_name: xss(parsed.data.buyer_name),
      buyer_email: xss(parsed.data.buyer_email.toLowerCase()),
      buyer_phone: xss(parsed.data.buyer_phone),
      delivery_address: xss(parsed.data.delivery_address),
      notes: xss(parsed.data.notes),
      items: orderItems,
      subtotal,
      total_amount: grandTotal,
      ...(couponUsed ? { coupon_code: couponUsed.code, discount_amount: discount } : {}),
      payment_method: parsed.data.payment_method,
      payment_reference: xss(parsed.data.payment_reference),
      payment_proof_note: xss(parsed.data.payment_proof_note),
      payment_status: hasProof ? 'proof_submitted' : 'pending',
      fulfillment_status: 'pending',
    };

    let { data: order, error: insertErr } = await supabaseAdmin
      .from('site_orders')
      .insert({
        ...baseInsert,
        shipping_fee: shippingFee,
        shipping_zone: xss(shippingZone),
        delivery_method: resolvedMethod,
        delivery_state: xss(parsed.data.delivery_state),
        marketing_consent: parsed.data.marketing_consent,
      })
      .select('*')
      .single();

    if (isMissingColumnError(insertErr)) {
      const retry = await supabaseAdmin
        .from('site_orders')
        .insert({ ...baseInsert, total_amount: Math.max(0, subtotal - discount) })
        .select('*')
        .single();
      order = retry.data;
      insertErr = retry.error;
    }

    if (insertErr) {
      await releaseStock(site.id, orderItems);
      throw insertErr;
    }

    // Mark any matching abandoned cart as converted (best-effort; silent if table not yet migrated).
    const buyerEmailLower = parsed.data.buyer_email.trim().toLowerCase();
    if (buyerEmailLower) {
      Promise.resolve(
        supabaseAdmin
          .from('site_carts')
          .update({ status: 'converted', updated_at: new Date().toISOString() })
          .eq('site_id', site.id)
          .eq('email', buyerEmailLower)
          .eq('status', 'open')
      ).catch(() => {});

      if (parsed.data.marketing_consent) {
        Promise.resolve(
          supabaseAdmin
            .from('site_subscribers')
            .upsert(
              {
                site_id: site.id,
                email: buyerEmailLower,
                name: xss(parsed.data.buyer_name),
                phone: xss(parsed.data.buyer_phone),
                source: 'order',
                marketing_consent: true,
                unsubscribed_at: null,
                unsubscribe_token: crypto.randomBytes(18).toString('hex'),
              },
              { onConflict: 'site_id,email' }
            )
        ).catch(() => {});
      }
    }

    emailOrderReceived(site, {
      order_code: order.order_code,
      buyer_name: order.buyer_name,
      buyer_email: order.buyer_email,
      total_amount: Number(order.total_amount),
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      fulfillment_status: order.fulfillment_status,
      items: order.items,
      shipping_fee: shippingFee,
      shipping_zone: shippingZone,
      delivery_method: resolvedMethod,
      delivery_state: parsed.data.delivery_state,
    }).catch((e) => console.warn('Buyer confirmation email failed:', e));

    if (couponUsed) {
      // Count the use only if nobody else used the last one in the meantime.
      await supabaseAdmin.from('site_coupons').update({ used_count: couponUsed.used_count + 1 }).eq('id', couponUsed.id).eq('used_count', couponUsed.used_count);
    }

    // Tell the store owner. A shop where nobody learns about new orders loses sales.
    // Best effort: a notification failure must never undo or hide the buyer's order.
    try {
      const { notifyUser } = await import('@/lib/notify');
      const amount = Math.round(grandTotal).toLocaleString('en-NG');
      await notifyUser({
        userId: site.owner_id,
        title: `New order ${orderCode} on ${site.name}`,
        message: `${parsed.data.buyer_name} placed an order for ${amount}. Open your store manager to confirm payment.`,
        type: 'order_update',
        link: `/forums/${slug.toLowerCase().trim()}`,
      });
    } catch (e) {
      console.warn('Store owner notification failed:', e);
    }

    // Phone alert for Pro and Business stores. Runs after the response is sent, so it can never slow down or fail an order.
    after(() => sendSitePush(site.id, 'owner', {
      title: `New order ${orderCode}`,
      body: `${parsed.data.buyer_name} placed an order for ${Math.round(grandTotal).toLocaleString('en-NG')}.`,
      url: `/forums/${site.slug}`,
      tag: `order-${orderCode}`,
    }));

    return NextResponse.json({ order }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to place order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
