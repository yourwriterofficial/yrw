import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { notifyUser } from '@/lib/notify';
import { emailTemplates } from '@/lib/emailTemplates';
import { isOrderFullyPaid } from '@/lib/orderPayment';

/**
 * Admin: toggle a single custom milestone's `paid` or `delivered` flag on an order.
 * Fires an in-app + email + push notification to the client (per their prefs).
 * NOTE: marking delivered is a progress signal only — final files still require
 * the order to be FULLY paid before the vault unlocks.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const admin = guard.admin;

  try {
    const { orderId, milestoneIndex, field, value } = await request.json();
    if (!orderId || milestoneIndex === undefined || !['paid', 'delivered'].includes(field)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { data: order, error } = await admin
      .from('orders')
      .select('id, order_id, client_id, email, legal_name, topic, financial_quote, payment_structure_type, payment_milestones, sixty_percent_paid, forty_percent_paid')
      .eq('order_id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const milestones = Array.isArray(order.payment_milestones) ? [...order.payment_milestones] : [];
    if (milestoneIndex < 0 || milestoneIndex >= milestones.length) {
      return NextResponse.json({ error: 'Milestone index out of range' }, { status: 400 });
    }

    const m = { ...milestones[milestoneIndex] };
    m[field] = value;
    if (field === 'paid') {
      m.paid_at = value ? new Date().toISOString() : null;
      if (value && !m.tx_ref) m.tx_ref = `ADMIN_${Date.now()}`;
    }
    milestones[milestoneIndex] = m;

    // Keep the legacy 60/40 booleans in sync so old code + views stay coherent.
    const allPaid = milestones.length > 0 && milestones.every((x: any) => x.paid);
    const firstPaid = !!milestones[0]?.paid;
    const updates: any = { payment_milestones: milestones };
    if (order.payment_structure_type === 'CUSTOM') {
      updates.sixty_percent_paid = firstPaid;
      updates.forty_percent_paid = allPaid;
      if (allPaid) updates.workflow_status = 'Completed';
    }

    const { error: updErr } = await admin.from('orders').update(updates).eq('order_id', orderId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    // Notify the client (only if the order is tied to a registered user)
    if (order.client_id) {
      const emailData = {
        order_id: order.order_id,
        legal_name: order.legal_name,
        email: order.email,
        topic: order.topic,
        financial_quote: order.financial_quote,
      };
      const fullyPaid = isOrderFullyPaid({ ...order, payment_milestones: milestones });

      if (field === 'delivered' && value) {
        const tpl = emailTemplates.milestoneDelivered(emailData, { name: m.name, percentage: m.percentage });
        await notifyUser({
          userId: order.client_id,
          title: `Milestone delivered: ${m.name}`,
          message: `Our team completed the "${m.name}" milestone on ${order.order_id}.`,
          type: 'vault_delivery',
          link: `/dashboard/client?preview=${order.order_id}`,
          orderDbId: order.id,
          emailHtml: tpl.html,
          emailSubject: tpl.subject,
        });
      } else if (field === 'paid' && value) {
        const tpl = emailTemplates.milestonePaid(emailData, { name: m.name, amount: m.amount, percentage: m.percentage }, fullyPaid);
        await notifyUser({
          userId: order.client_id,
          title: `Payment confirmed: ${m.name}`,
          message: fullyPaid
            ? `All milestones on ${order.order_id} are paid — your files are unlocked.`
            : `Your "${m.name}" payment on ${order.order_id} is confirmed.`,
          type: 'payment',
          link: `/dashboard/client?preview=${order.order_id}`,
          orderDbId: order.id,
          emailHtml: tpl.html,
          emailSubject: tpl.subject,
        });
      }
    }

    return NextResponse.json({ success: true, milestones });
  } catch (err: any) {
    console.error('update-milestone error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
