import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const invoiceRequestSchema = z.object({
  orderId: z.string().min(5),
  amount: z.number().positive(),
  email: z.string().email(),
  name: z.string().min(1),
  type: z.string().min(3),
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = invoiceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const { orderId, amount, email, name, type } = parsed.data;

    // 1. Verify order or custom invoice exists
    const isCustomInvoice = orderId.startsWith('INV-');
    let orderData = null;
    let tx_ref = '';

    if (isCustomInvoice) {
      const { data: customInvoice, error: custErr } = await supabase
        .from('custom_invoices')
        .select('id')
        .eq('invoice_number', orderId)
        .single();
      
      if (custErr || !customInvoice) {
        return NextResponse.json({ error: 'Custom invoice not found' }, { status: 404 });
      }
      
      tx_ref = `CUSTINV_${orderId}_${type}_${Date.now()}`;
    } else {
      // Verify order exists
      const { data: dbOrder, error: lookupError } = await supabase
        .from('orders')
        .select('id')
        .eq('order_id', orderId)
        .single();

      if (lookupError || !dbOrder) {
        return NextResponse.json({ error: 'Order not found in database' }, { status: 404 });
      }
      
      orderData = dbOrder;
      tx_ref = `INV_${orderId}_${type}_${Date.now()}`;
    }

    // 2. Call Paystack API
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference: tx_ref,
        amount: amount * 100, // Paystack requires amount in Kobo/Cents
        email: email,
        callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/callback?tx_ref=${tx_ref}`,
        metadata: {
          custom_fields: [
            { display_name: "Client Name", variable_name: "client_name", value: name },
            { display_name: "Order ID", variable_name: "order_id", value: orderId },
            { display_name: "Invoice Type", variable_name: "invoice_type", value: type }
          ]
        }
      }),
    });

    const paystackData = await response.json();

    if (paystackData.status === true) {
      if (!isCustomInvoice && orderData) {
        // 3. Log the pending invoice for standard orders
        await supabase.from('invoices').insert({
          order_id: orderData.id,
          amount,
          type: (type === 'DEPOSIT' || type === 'BALANCE') ? type : 'DEPOSIT',
          // We reuse the flutterwave column name here so you don't have to rewrite your SQL database schema
          flutterwave_transaction_ref: tx_ref, 
          status: 'PENDING',
        });
      }

      return NextResponse.json({ link: paystackData.data.authorization_url, tx_ref });
    } else {
      throw new Error(paystackData.message || 'Paystack API Error');
    }
  } catch (err: any) {
    console.error('Invoice Generation Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}