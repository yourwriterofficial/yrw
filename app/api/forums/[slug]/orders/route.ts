import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/forumServer';

const createOrderSchema = z.object({
  buyer_name: z.string().trim().min(2, 'Full name is required').max(100),
  buyer_email: z.string().trim().email('Valid email is required').max(150),
  buyer_phone: z.string().trim().min(5, 'Phone or WhatsApp number is required').max(30),
  delivery_address: z.string().trim().max(400).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
  payment_method: z.enum(['manual_transfer', 'pay_on_delivery']).default('manual_transfer'),
  payment_reference: z.string().trim().max(120).optional().default(''),
  payment_proof_note: z.string().trim().max(400).optional().default(''),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
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
      const { data: order } = await supabaseAdmin
        .from('site_orders')
        .select('*')
        .eq('site_id', site.id)
        .eq('order_code', code)
        .ilike('buyer_email', email)
        .maybeSingle();

      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      return NextResponse.json({ order });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || site.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
      .select('id, site_mode')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();

    if (!site || site.site_mode === 'forum') {
      return NextResponse.json({ error: 'Storefront not found' }, { status: 404 });
    }

    const raw = await request.json();
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
    const orderItems = [];
    let subtotal = 0;

    for (const reqItem of parsed.data.items) {
      const prod = productMap.get(reqItem.product_id);
      if (!prod) {
        return NextResponse.json({ error: 'One or more products are no longer available.' }, { status: 400 });
      }
      if (prod.stock_qty !== null && prod.stock_qty < reqItem.qty) {
        return NextResponse.json({ error: `Not enough stock for "${prod.title}".` }, { status: 400 });
      }
      const linePrice = Number(prod.price);
      subtotal += linePrice * reqItem.qty;
      orderItems.push({
        product_id: prod.id,
        title: prod.title,
        product_type: prod.product_type,
        price: linePrice,
        qty: reqItem.qty,
      });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const orderCode = `ORD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const hasProof = parsed.data.payment_method === 'manual_transfer' && !!parsed.data.payment_reference.trim();

    const { data: order, error: insertErr } = await supabaseAdmin
      .from('site_orders')
      .insert({
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
        total_amount: subtotal,
        payment_method: parsed.data.payment_method,
        payment_reference: xss(parsed.data.payment_reference),
        payment_proof_note: xss(parsed.data.payment_proof_note),
        payment_status: hasProof ? 'proof_submitted' : 'pending',
        fulfillment_status: 'pending',
      })
      .select('*')
      .single();

    if (insertErr) throw insertErr;
    return NextResponse.json({ order }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to place order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
