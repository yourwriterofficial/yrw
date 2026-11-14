import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, downloadsForOrder, releaseStock } from '@/lib/forumServer';
import { emailOrderUpdate } from '@/lib/storeEmails';

const updateOrderSchema = z.object({
  payment_status: z.enum(['pending', 'proof_submitted', 'paid', 'rejected']).optional(),
  fulfillment_status: z.enum(['pending', 'processing', 'shipped', 'completed', 'cancelled']).optional(),
  payment_reference: z.string().trim().max(120).optional(),
  payment_proof_note: z.string().trim().max(400).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await context.params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, slug, owner_id, name, currency, whatsapp_number, bank_name, bank_account_number, bank_account_name, payment_instructions')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();

    if (!site) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    if (site.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const raw = await request.json();
    const parsed = updateOrderSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid update' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.payment_status !== undefined) updates.payment_status = parsed.data.payment_status;
    if (parsed.data.fulfillment_status !== undefined) updates.fulfillment_status = parsed.data.fulfillment_status;
    if (parsed.data.payment_reference !== undefined) updates.payment_reference = xss(parsed.data.payment_reference);
    if (parsed.data.payment_proof_note !== undefined) updates.payment_proof_note = xss(parsed.data.payment_proof_note);

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

    if (error) throw error;

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
    }

    return NextResponse.json({ order });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
