import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getUserBankDetails } from '@/lib/bankDetails';
import { createManualPaymentRequest } from '@/lib/manualPayments';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, amount } = await req.json();
    if (!userId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify user exists
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const reference = `WALLET_${Date.now()}_${userId.slice(0, 8)}`;
    const bankDetails = await getUserBankDetails(userId);

    // Register pending wallet deposit
    await createManualPaymentRequest({
      reference,
      userId,
      paymentType: 'WALLET_TOPUP',
      amount: Number(amount),
      bankDetails,
      notes: 'Wallet funding request via manual bank transfer',
    });

    return NextResponse.json({
      manual_transfer: true,
      reference,
      amount: Number(amount),
      bankDetails,
    });
  } catch (err: any) {
    console.error('Wallet topup error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}