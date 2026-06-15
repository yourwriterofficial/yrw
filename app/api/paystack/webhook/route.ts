import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-paystack-signature');

    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      console.error('Unauthorized Webhook: Invalid Paystack Signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    if (payload.event !== 'charge.success') {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const { reference, metadata } = payload.data;
    const { type } = metadata || {};

    // --- WALLET TOP-UP ---
    if (type === 'wallet_topup') {
      const { userId, amount } = metadata;
      const { error: rpcError } = await supabase.rpc('increment_wallet', {
        user_id: userId,
        add_amount: amount,
      });
      if (rpcError) throw new Error(`Wallet increment failed: ${rpcError.message}`);
      await supabase.from('transactions').insert({
        user_id: userId,
        amount,
        type: 'deposit',
        reference,
        status: 'completed',
      });
      console.log(`Wallet top-up processed: ${amount} for user ${userId}`);
      return NextResponse.json({ received: true });
    }

    // --- ORDER PAYMENT: call central update API ---
    const tx_ref = reference;
    const parts = tx_ref.split('_');
    const orderStringId = parts[1];
    const paymentType = parts[2]; // 'DEPOSIT' or 'BALANCE'

    if (!orderStringId || !paymentType) {
      console.error('Invalid payment reference format:', tx_ref);
      return NextResponse.json({ error: 'Invalid reference format' }, { status: 400 });
    }

    // Mark invoice as paid
    await supabase
      .from('invoices')
      .update({ status: 'PAID', paid_at: new Date().toISOString() })
      .eq('flutterwave_transaction_ref', tx_ref)
      .throwOnError();

    // Determine updates based on payment type
    let updates = {};
    if (paymentType === 'DEPOSIT') {
      updates = { sixty_percent_paid: true, workflow_status: 'Synthesis Active' };
    } else if (paymentType === 'BALANCE') {
      updates = { forty_percent_paid: true, workflow_status: 'Completed' };
    } else {
      console.warn(`Unknown payment type: ${paymentType}`);
      return NextResponse.json({ received: true });
    }

    // Call the central update API (handles email automatically)
    const updateRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/update-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: orderStringId, updates }),
    });

    if (!updateRes.ok) {
      console.error('Central update API failed:', await updateRes.text());
      throw new Error('Failed to update order via central API');
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Critical Webhook Execution Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}