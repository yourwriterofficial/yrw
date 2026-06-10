import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { CreateInvoiceRequest, CreateInvoiceResponse } from '@/lib/types';

const invoiceRequestSchema = z.object({
  orderId: z.string().min(5),
  amount: z.number().positive(),
  email: z.string().email(),
  name: z.string().min(1),
  type: z.enum(['DEPOSIT', 'BALANCE']),
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request): Promise<NextResponse<CreateInvoiceResponse | { error: string }>> {
  try {
    const body = await request.json();
    const parsed = invoiceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { orderId, amount, email, name, type } = parsed.data;

    const { data: orderData, error: lookupError } = await supabase
      .from('orders')
      .select('id')
      .eq('order_id', orderId)
      .single();

    if (lookupError || !orderData) {
      return NextResponse.json({ error: 'Order not found in database' }, { status: 404 });
    }

    const tx_ref = `INV_${orderId}_${type}_${Date.now()}`;

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref,
        amount,
        currency: 'NGN',
        redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client`,
        customer: { email, name: name || 'Client' },
        customizations: {
          title: `YourResearchWriter - ${type === 'DEPOSIT' ? '60% Deposit' : '40% Balance'}`,
          description: `Invoice for Order: ${orderId}`,
        },
      }),
    });

    const flwData = await response.json();

    if (flwData.status === 'success') {
      await supabase.from('invoices').insert({
        order_id: orderData.id,
        amount,
        type,
        flutterwave_transaction_ref: tx_ref,
        status: 'PENDING',
        invoice_pdf_url: flwData.data.link,
      });
      return NextResponse.json({ link: flwData.data.link, tx_ref });
    } else {
      throw new Error(flwData.message || 'Flutterwave API Error');
    }
  } catch (err: any) {
    console.error('Invoice Generation Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}