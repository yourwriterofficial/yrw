import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { downloadsForOrder, emailIsConfirmed, supabaseAdmin } from '@/lib/forumServer';

export const dynamic = 'force-dynamic';

/**
 * Authenticated buyer: returns this customer's profile summary and order history
 * strictly scoped to the requested store (`site_id`).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to view your orders.' }, { status: 401 });
    }

    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, slug, name, is_public')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();

    if (!site || !site.is_public) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const userEmail = (user.email || '').trim().toLowerCase();
    const confirmed = userEmail ? await emailIsConfirmed(user.id) : false;

    let query = supabaseAdmin
      .from('site_orders')
      .select(
        'id, order_code, site_id, buyer_name, buyer_email, buyer_phone, delivery_address, delivery_method, delivery_state, notes, items, subtotal, discount_amount, coupon_code, shipping_fee, shipping_zone, total_amount, payment_method, payment_status, fulfillment_status, refunded_amount, created_at'
      )
      .eq('site_id', site.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (confirmed && userEmail) {
      const quotedEmail = userEmail.split('"').join('').split('\\').join('');
      query = query.or(`buyer_id.eq.${user.id},buyer_email.eq."${quotedEmail}"`);
    } else {
      query = query.eq('buyer_id', user.id);
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    const list = orders || [];
    const downloadsByCode: Record<string, { title: string; url: string }[]> = {};
    await Promise.all(
      list
        .filter((o) => o.payment_status === 'paid')
        .map(async (o) => {
          downloadsByCode[o.order_code as string] = await downloadsForOrder(
            site.id,
            (o.items as { product_id?: string }[]) || []
          );
        })
    );

    const paidOrders = list.filter((o) => o.payment_status === 'paid');
    const totalSpent = paidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    return NextResponse.json({
      profile: {
        email: userEmail,
        name:
          (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name as string | undefined) ||
          (list[0]?.buyer_name as string | undefined) ||
          '',
        orders_count: list.length,
        paid_orders_count: paidOrders.length,
        total_spent: totalSpent,
      },
      orders: list,
      downloadsByCode,
    });
  } catch (err: unknown) {
    console.error('my-orders failed:', err);
    return NextResponse.json({ error: 'Could not load your orders right now. Please try again shortly.' }, { status: 500 });
  }
}
