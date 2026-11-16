import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { isMissingColumnError, isMissingRelationError, releaseStock, requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';
import { planFor } from '@/lib/plans';

const createEventSchema = z.object({
  kind: z.enum(['refund', 'return', 'note']),
  amount: z.number().min(0).max(100_000_000).optional().default(0),
  note: z.string().trim().max(1000).optional().default(''),
  stock_returned: z.boolean().optional().default(false),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager', 'packer', 'support']);
    if ('error' in access) return access.error;

    const { data, error } = await supabaseAdmin
      .from('site_order_events')
      .select('id, order_id, kind, note, amount, stock_returned, created_at')
      .eq('site_id', access.site.id)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json({ events: [], tableMissing: true });
      }
      throw error;
    }

    return NextResponse.json({ events: data || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load order events' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;

    const plan = planFor(access.site.plan_tier, access.site.plan_expires_at);
    if (!plan.refundsLog) {
      return NextResponse.json({ error: 'Refund & return tracking is available on Pro and Business plans.' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid event data' }, { status: 400 });
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('site_orders')
      .select('id, total_amount, refunded_amount, items')
      .eq('id', orderId)
      .eq('site_id', access.site.id)
      .maybeSingle();

    if (orderErr) {
      if (isMissingColumnError(orderErr)) {
        return NextResponse.json({ error: 'This is not available right now. Please try again in a few minutes.' }, { status: 503 });
      }
      throw orderErr;
    }
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const amount = parsed.data.kind === 'note' ? 0 : parsed.data.amount;
    const prevRefunded = Number(order.refunded_amount || 0);
    if (prevRefunded + amount > Number(order.total_amount)) {
      return NextResponse.json({ error: 'Total refunded amount cannot exceed the order total.' }, { status: 400 });
    }

    const { data: ev, error: insErr } = await supabaseAdmin
      .from('site_order_events')
      .insert({
        site_id: access.site.id,
        order_id: order.id,
        kind: parsed.data.kind,
        note: xss(parsed.data.note),
        amount,
        stock_returned: parsed.data.stock_returned,
        created_by: access.user.id,
      })
      .select('id, order_id, kind, note, amount, stock_returned, created_at')
      .single();

    if (insErr) {
      if (isMissingRelationError(insErr)) {
        return NextResponse.json({ error: 'This is not available right now. Please try again in a few minutes.' }, { status: 503 });
      }
      throw insErr;
    }

    if (amount > 0) {
      await supabaseAdmin
        .from('site_orders')
        .update({ refunded_amount: prevRefunded + amount, updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .eq('site_id', access.site.id);
    }

    if (parsed.data.stock_returned) {
      await releaseStock(access.site.id, (order.items as { product_id: string; variant_id?: string | null; qty: number }[]) || []);
    }

    return NextResponse.json({ event: ev, refunded_amount: prevRefunded + amount }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to record event' }, { status: 500 });
  }
}
