import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { creditReferralCommission } from '@/lib/affiliate';

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Pays the initial 60% deposit on a freshly-created academic order from the
 * client's wallet balance. Runs server-side (unlike the legacy inline version
 * this replaces in OrderForm.tsx) because increment_wallet() refuses to credit
 * any wallet — including a referrer's, for affiliate commission — for a
 * non-service-role caller, so the referral credit step here must be trusted
 * server logic, not something a browser client can trigger with an arbitrary
 * amount.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orderId, amount } = await request.json();
    if (!orderId || !(Number(amount) > 0)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    const depositAmount = Math.round(Number(amount));

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('client_id, sixty_percent_paid')
      .eq('order_id', orderId)
      .single();
    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (order.client_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (order.sixty_percent_paid) {
      return NextResponse.json({ error: 'Deposit already paid' }, { status: 400 });
    }

    const { error: debitErr } = await admin.rpc('increment_wallet', {
      user_id: user.id,
      add_amount: -depositAmount,
    });
    if (debitErr) {
      return NextResponse.json({ error: 'Wallet debit failed: ' + debitErr.message }, { status: 500 });
    }

    await admin.from('orders').update({ sixty_percent_paid: true, workflow_status: 'Synthesis Active' }).eq('order_id', orderId);

    const reference = `DEPOSIT_${orderId}`;
    await admin.from('transactions').insert({
      user_id: user.id,
      amount: depositAmount,
      type: 'payment',
      reference,
      status: 'completed',
    });
    await creditReferralCommission(admin, { buyerId: user.id, amount: depositAmount, reference, note: `Deposit: ${orderId}` });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Pay order deposit (wallet) error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
