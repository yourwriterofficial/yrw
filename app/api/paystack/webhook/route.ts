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
      if (!userId || !amount) {
        console.error('Missing userId or amount in metadata');
        return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 });
      }

      // 1. Increment wallet balance
      const { error: rpcError } = await supabase.rpc('increment_wallet', {
        user_id: userId,
        add_amount: amount,
      });
      if (rpcError) {
        console.error('Wallet increment failed:', rpcError);
        throw new Error(`Wallet increment failed: ${rpcError.message}`);
      }

      // 2. Log transaction
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: userId,
        amount,
        type: 'deposit',
        reference,
        status: 'completed',
      });
      if (txError) {
        console.error('Transaction log insert failed:', txError);
        // Not throwing – wallet is already updated, but log the error
      }

      console.log(`Wallet top-up processed: ${amount} for user ${userId}, ref: ${reference}`);
      return NextResponse.json({ received: true });
    }

    // --- ORDER PAYMENT (existing logic) ---
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

    // Retrieve order data for email
    const { data: orderInfo, error: orderError } = await supabase
      .from('orders')
      .select('email, legal_name, financial_quote, topic, order_id')
      .eq('order_id', orderStringId)
      .single();

    if (orderError || !orderInfo) {
      throw new Error(`Order ${orderStringId} not found.`);
    }

    const orderEmailData = {
      order_id: orderInfo.order_id,
      legal_name: orderInfo.legal_name,
      email: orderInfo.email,
      topic: orderInfo.topic,
      financial_quote: orderInfo.financial_quote,
    };

    // Determine updates and send email
    let updates = {};
    let template = null;
    if (paymentType === 'DEPOSIT') {
      updates = { sixty_percent_paid: true, workflow_status: 'Synthesis Active' };
      const { emailTemplates } = await import('@/lib/emailTemplates');
      template = emailTemplates.depositPaid(orderEmailData);
    } else if (paymentType === 'BALANCE') {
      updates = { forty_percent_paid: true, workflow_status: 'Completed' };
      const { emailTemplates } = await import('@/lib/emailTemplates');
      template = emailTemplates.balancePaid(orderEmailData);
    } else {
      console.warn(`Unknown payment type: ${paymentType}`);
      return NextResponse.json({ received: true });
    }

    // Update order via central API to trigger email (optional, but we'll also call email directly)
    const updateRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/update-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: orderStringId, updates }),
    });
    if (!updateRes.ok) {
      console.error('Central update API failed:', await updateRes.text());
    }

    if (template) {
      const { sendSystemEmail } = await import('@/lib/emailService');
      await sendSystemEmail({
        to: orderInfo.email,
        subject: template.subject,
        html: template.html,
        orderId: orderStringId,
      });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Critical Webhook Execution Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}