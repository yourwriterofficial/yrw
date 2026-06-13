import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const webhookPayloadSchema = z.object({
  event: z.literal('charge.completed'),
  data: z.object({
    status: z.literal('successful'),
    tx_ref: z.string(),
    id: z.number(),
  }),
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    const signature = request.headers.get('verif-hash');

    if (!signature || signature !== secretHash) {
      console.error('Unauthorized webhook attempt.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const parsed = webhookPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      console.error('Invalid webhook payload', parsed.error.issues);
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { tx_ref, id: transaction_id } = parsed.data.data;

    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
      headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
    });
    const verifyData = await verifyRes.json();

    if (verifyData.status === 'success' && verifyData.data.status === 'successful') {
      const parts = tx_ref.split('_');
      const orderStringId = parts[1];
      const paymentType = parts[2];

      await supabase
        .from('invoices')
        .update({ status: 'PAID', paid_at: new Date().toISOString() })
        .eq('flutterwave_transaction_ref', tx_ref);

      // Get order info for emails
      const { data: orderInfo } = await supabase
        .from('orders')
        .select('email, legal_name, financial_quote')
        .eq('order_id', orderStringId)
        .single();

      if (paymentType === 'DEPOSIT') {
        await supabase
          .from('orders')
          .update({ sixty_percent_paid: true, workflow_status: 'Synthesis Active' })
          .eq('order_id', orderStringId);

        if (orderInfo) {
          const depositAmount = orderInfo.financial_quote * 0.6;
          fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: orderInfo.email,
              orderId: orderStringId,
              subject: `Deposit Cleared: Order ${orderStringId}`,
              html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #050505; color: #ffffff; padding: 30px; border-radius: 10px; border: 1px solid #1DB954;">
                <h2 style="color: #1DB954;">Payment Confirmed</h2>
                <p>Hello ${orderInfo.legal_name},</p>
                <p>We received your 60% deposit of <strong>₦${depositAmount.toLocaleString()}</strong>.</p>
                <p>The <strong>Synthesis Phase</strong> is now active. Track progress from your dashboard.</p>
                <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client" style="display: inline-block; background: #1DB954; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Track Live Progress</a>
              </div>`,
            }),
          }).catch(err => console.error('Email send failed:', err));
        }
      } else if (paymentType === 'BALANCE') {
        await supabase
          .from('orders')
          .update({ forty_percent_paid: true })
          .eq('order_id', orderStringId);

        if (orderInfo) {
          fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: orderInfo.email,
              orderId: orderStringId,
              subject: `Vault Unlocked: Order ${orderStringId}`,
              html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #050505; color: #ffffff; padding: 30px; border-radius: 10px; border: 1px solid #10b981;">
                <h2 style="color: #10b981;">Final Balance Cleared</h2>
                <p>Hello ${orderInfo.legal_name},</p>
                <p>Your 40% balance has been successfully processed. Thank you!</p>
                <p>The secure delivery vault is now <strong>Unlocked</strong>. You can instantly download your final editable documents from your dashboard.</p>
                <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client" style="display: inline-block; background: #10b981; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Access Delivery Vault</a>
              </div>`,
            }),
          }).catch(err => console.error('Email send failed:', err));
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}