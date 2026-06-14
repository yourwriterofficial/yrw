import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { emailTemplates } from '@/lib/emailTemplates';
import { sendSystemEmail } from '@/lib/emailService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // 1. Read Raw Body for Paystack Verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-paystack-signature');

    // 2. Verify HMAC Signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      console.error('Unauthorized Webhook: Invalid Paystack Signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // 3. Only process successful charges
    if (payload.event === 'charge.success') {
      const tx_ref = payload.data.reference;
      const parts = tx_ref.split('_');
      const orderStringId = parts[1];
      const paymentType = parts[2];

      try {
        // Mark Invoice as Paid
        await supabase
          .from('invoices')
          .update({ status: 'PAID', paid_at: new Date().toISOString() })
          .eq('flutterwave_transaction_ref', tx_ref)
          .throwOnError();

        // Retrieve Order Data for Emails
        const { data: orderInfo, error: orderError } = await supabase
          .from('orders')
          .select('email, legal_name, financial_quote, topic, order_id')
          .eq('order_id', orderStringId)
          .single();

        if (orderError || !orderInfo) throw new Error(`Order ${orderStringId} not found.`);

        const orderEmailData = {
          order_id: orderInfo.order_id,
          legal_name: orderInfo.legal_name,
          email: orderInfo.email,
          topic: orderInfo.topic,
          financial_quote: orderInfo.financial_quote,
        };

        // Update Order Status & Send Native Email
        if (paymentType === 'DEPOSIT') {
          await supabase
            .from('orders')
            .update({ sixty_percent_paid: true, workflow_status: 'Synthesis Active' })
            .eq('order_id', orderStringId)
            .throwOnError();

          const template = emailTemplates.depositPaid(orderEmailData);
          await sendSystemEmail({
            to: orderInfo.email,
            subject: template.subject,
            html: template.html,
            orderId: orderStringId,
          });

        } else if (paymentType === 'BALANCE') {
          await supabase
            .from('orders')
            .update({ forty_percent_paid: true, workflow_status: 'Completed' })
            .eq('order_id', orderStringId)
            .throwOnError();

          const template = emailTemplates.balancePaid(orderEmailData);
          await sendSystemEmail({
            to: orderInfo.email,
            subject: template.subject,
            html: template.html,
            orderId: orderStringId,
          });
        }
      } catch (dbError) {
        console.error('Database/Email processing failed for tx_ref:', tx_ref, dbError);
        return NextResponse.json({ error: 'Failed to process database updates' }, { status: 500 });
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Critical Webhook Execution Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}