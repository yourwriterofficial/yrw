import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { supabaseAdmin, downloadsForOrder, isMissingColumnError, releaseStock, requireSiteAccess } from '@/lib/forumServer';
import { emailOrderUpdate } from '@/lib/storeEmails';
import { sendSitePush } from '@/lib/sitePush';

const updateOrderSchema = z.object({
  payment_status: z.enum(['pending', 'proof_submitted', 'paid', 'rejected']).optional(),
  fulfillment_status: z.enum(['pending', 'processing', 'shipped', 'completed', 'cancelled']).optional(),
  payment_reference: z.string().trim().max(120).optional(),
  payment_proof_note: z.string().trim().max(400).optional(),
  internal_note: z.string().trim().max(1000).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager', 'packer', 'support']);
    if ('error' in access) return access.error;

    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, slug, owner_id, name, currency, whatsapp_number, bank_name, bank_account_number, bank_account_name, payment_instructions')
      .eq('id', access.site.id)
      .maybeSingle();

    if (!site) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const raw = await request.json();
    const parsed = updateOrderSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid update' }, { status: 400 });
    }

    if (access.role === 'packer' && (parsed.data.payment_status !== undefined || parsed.data.payment_reference !== undefined || parsed.data.payment_proof_note !== undefined)) {
      return NextResponse.json({ error: 'Packers can update delivery status and notes only.' }, { status: 403 });
    }
    if (access.role === 'support' && (parsed.data.payment_status !== undefined || parsed.data.fulfillment_status !== undefined)) {
      return NextResponse.json({ error: 'Support staff can edit private order notes only.' }, { status: 403 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.payment_status !== undefined) updates.payment_status = parsed.data.payment_status;
    if (parsed.data.fulfillment_status !== undefined) updates.fulfillment_status = parsed.data.fulfillment_status;
    if (parsed.data.payment_reference !== undefined) updates.payment_reference = xss(parsed.data.payment_reference);
    if (parsed.data.payment_proof_note !== undefined) updates.payment_proof_note = xss(parsed.data.payment_proof_note);
    if (parsed.data.internal_note !== undefined) updates.internal_note = xss(parsed.data.internal_note);

    const { data: before } = await supabaseAdmin
      .from('site_orders')
      .select('payment_status, fulfillment_status')
      .eq('id', orderId)
      .eq('site_id', site.id)
      .maybeSingle();

    const { data: order, error } = await supabaseAdmin
      .from('site_orders')
      .update(updates)
      .eq('id', orderId)
      .eq('site_id', site.id)
      .select('*')
      .single();

    if (error) {
      if (isMissingColumnError(error)) {
        return NextResponse.json({ error: 'Private notes need the latest database update first.' }, { status: 503 });
      }
      throw error;
    }

    // A cancelled order, or a rejected payment, frees its items again. Only the first time it
    // enters that state, so repeating the action cannot add stock twice.
    const wasDead = before && (before.payment_status === 'rejected' || before.fulfillment_status === 'cancelled');
    const isDead = order && (order.payment_status === 'rejected' || order.fulfillment_status === 'cancelled');
    if (order && isDead && !wasDead) {
      await releaseStock(site.id, order.items || []);
    }

    // Tell the buyer, but only when a status really changed (not on every save).
    const paymentChanged = before && parsed.data.payment_status && parsed.data.payment_status !== before.payment_status;
    const fulfilmentChanged = before && parsed.data.fulfillment_status && parsed.data.fulfillment_status !== before.fulfillment_status;
    if (order && (paymentChanged || fulfilmentChanged)) {
      (async () => {
        const downloads = paymentChanged && parsed.data.payment_status === 'paid' ? await downloadsForOrder(site.id, order.items) : [];
        await emailOrderUpdate(site, order, {
          payment: paymentChanged ? parsed.data.payment_status : undefined,
          fulfillment: fulfilmentChanged ? parsed.data.fulfillment_status : undefined,
        }, downloads);
      })().catch((e) => console.warn('Buyer status email failed:', e));

      // Phone alert for the buyer if they turned alerts on. Runs after the response, never blocks the update.
      const status = paymentChanged && parsed.data.payment_status === 'paid'
        ? 'Payment received'
        : `Order ${String(fulfilmentChanged ? parsed.data.fulfillment_status : parsed.data.payment_status).replace(/_/g, ' ')}`;
      after(() => sendSitePush(site.id, 'buyer', {
        title: `${site.name}: order ${order.order_code}`,
        body: status,
        url: `/forums/${site.slug}`,
        tag: `order-${order.order_code}`,
      }, { buyerEmail: order.buyer_email }));
    }

    return NextResponse.json({ order });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
