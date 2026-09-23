import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createManualPaymentRequest, ManualPaymentType } from '@/lib/manualPayments';
import { getUserBankDetails } from '@/lib/bankDetails';

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const {
      reference,
      orderId,
      invoiceId,
      milestoneIndex,
      paymentType,
      amount,
      senderName,
      receiptUrl,
      notes,
    } = body;

    if (!reference || !amount || !paymentType) {
      return NextResponse.json({ error: 'Missing reference, amount, or payment type' }, { status: 400 });
    }

    const userId = user?.id || null;
    const bankDetails = await getUserBankDetails(userId);

    const result = await createManualPaymentRequest({
      reference,
      userId,
      orderId,
      invoiceId,
      milestoneIndex,
      paymentType: paymentType as ManualPaymentType,
      amount: Number(amount),
      bankDetails,
      senderName: senderName || null,
      receiptUrl: receiptUrl || null,
      notes: notes || null,
    });

    return NextResponse.json({ success: true, reference: result.reference });
  } catch (err: any) {
    console.error('Submit manual payment proof error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
