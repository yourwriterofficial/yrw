import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { notifyUser, notifyAdmins } from '@/lib/notify';
import { emailTemplates } from '@/lib/emailTemplates';
import { isOrderFullyPaid } from '@/lib/orderPayment';

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Pay a single payment milestone (custom orders) OR the standard deposit/balance
 * from the client's wallet. Mirrors the Paystack webhook's milestone bookkeeping
 * exactly, but sourced from wallet balance instead of a card charge.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orderId, milestoneIndex } = await request.json();
    if (!orderId || milestoneIndex === undefined) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, order_id, client_id, email, legal_name, topic, financial_quote, payment_structure_type, payment_milestones, sixty_percent_paid, forty_percent_paid')
      .eq('order_id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const isOwner = order.client_id === user.id || order.email?.toLowerCase() === user.email?.toLowerCase();
    if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const milestones = Array.isArray(order.payment_milestones) ? [...order.payment_milestones] : [];
    if (milestoneIndex < 0 || milestoneIndex >= milestones.length) {
      return NextResponse.json({ error: 'Milestone index out of range' }, { status: 400 });
    }

    const m = { ...milestones[milestoneIndex] };
    if (m.paid) return NextResponse.json({ error: 'This milestone is already paid' }, { status: 400 });

    // Enforce sequential payment — the next unpaid milestone must be this one
    const nextUnpaid = milestones.findIndex((x: any) => !x.paid);
    if (nextUnpaid !== milestoneIndex) {
      return NextResponse.json({ error: 'Please pay milestones in order.' }, { status: 400 });
    }

    const price = Number(m.amount);
    if (isNaN(price) || price <= 0) {
      return NextResponse.json({ error: 'Invalid milestone amount' }, { status: 400 });
    }

    // Wallet balance check
    const { data: wallet, error: walletError } = await admin
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();
    if (walletError || !wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    if (Number(wallet.balance) < price) {
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
    }

    // Debit wallet
    const { error: rpcError } = await admin.rpc('increment_wallet', { user_id: user.id, add_amount: -price });
    if (rpcError) {
      return NextResponse.json({ error: 'Wallet debit failed: ' + rpcError.message }, { status: 500 });
    }

    // Transaction log
    const txRef = `MILESTONE_${orderId}_${milestoneIndex}_${Date.now()}`;
    await admin.from('transactions').insert({
      user_id: user.id, amount: price, type: 'payment', reference: txRef, status: 'completed',
    });

    // Mark milestone paid + sync legacy booleans (same shape as the webhook)
    m.paid = true;
    m.paid_at = new Date().toISOString();
    m.tx_ref = txRef;
    milestones[milestoneIndex] = m;

    const allPaid = milestones.length > 0 && milestones.every((x: any) => x.paid);
    const firstPaid = !!milestones[0]?.paid;
    const updates: any = {
      payment_milestones: milestones,
      sixty_percent_paid: firstPaid,
      forty_percent_paid: allPaid,
    };
    if (allPaid) updates.workflow_status = 'Completed';
    else if (firstPaid) updates.workflow_status = 'Synthesis Active';

    const { error: updErr } = await admin.from('orders').update(updates).eq('order_id', orderId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    // Notify client
    if (order.client_id) {
      const fullyPaid = isOrderFullyPaid({ ...order, payment_milestones: milestones });
      const tpl = emailTemplates.milestonePaid(
        { order_id: order.order_id, legal_name: order.legal_name, email: order.email, topic: order.topic, financial_quote: order.financial_quote },
        { name: m.name, amount: m.amount, percentage: m.percentage },
        fullyPaid
      );
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

      // Notify admins
      await notifyAdmins({
        title: `Milestone Paid: ${order.order_id}`,
        message: `${order.legal_name} paid milestone "${m.name}" (₦${m.amount.toLocaleString()}) for order "${order.topic}".`,
        type: 'payment',
        link: `/admin/orders?open=${order.order_id}`,
        orderDbId: order.id,
        emailHtml: tpl.html,
        emailSubject: `[PAID] Milestone: ${m.name} - Order #${order.order_id}`,
      }).catch(e => console.warn('Admin notification failed', e));
    }

    return NextResponse.json({ success: true, milestones });
  } catch (error: any) {
    console.error('Wallet milestone payment error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
