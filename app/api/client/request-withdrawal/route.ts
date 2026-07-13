import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { notifyAdmins } from '@/lib/notify';

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Client requests a cash-out of their wallet balance (affiliate commissions
 * land in the wallet — see lib/affiliate.ts). The amount is debited from the
 * wallet immediately so it can't be double-spent while the request is
 * pending; if an admin rejects it, /api/admin/process-withdrawal refunds it.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, bank, accountNumber, accountName } = await request.json();
    const numericAmount = Math.round(Number(amount));
    if (!(numericAmount > 0)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (!bank?.trim() || !accountNumber?.trim() || !accountName?.trim()) {
      return NextResponse.json({ error: 'Bank name, account number, and account name are required' }, { status: 400 });
    }

    const { data: settings } = await admin
      .from('affiliate_settings')
      .select('min_withdrawal')
      .eq('key', 'default')
      .maybeSingle();
    const minWithdrawal = Number(settings?.min_withdrawal ?? 1000);
    if (numericAmount < minWithdrawal) {
      return NextResponse.json({ error: `Minimum withdrawal is ₦${minWithdrawal.toLocaleString()}` }, { status: 400 });
    }

    const { data: wallet } = await admin.from('wallets').select('balance').eq('user_id', user.id).maybeSingle();
    if (!wallet || Number(wallet.balance) < numericAmount) {
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
    }

    const { error: debitErr } = await admin.rpc('increment_wallet', {
      user_id: user.id,
      add_amount: -numericAmount,
    });
    if (debitErr) {
      return NextResponse.json({ error: 'Wallet debit failed: ' + debitErr.message }, { status: 500 });
    }

    const reference = `WITHDRAW_${user.id.slice(0, 8)}_${Date.now()}`;
    await admin.from('transactions').insert({
      user_id: user.id,
      amount: numericAmount,
      type: 'withdrawal',
      reference,
      status: 'completed',
      notes: 'Affiliate payout requested',
    });

    const { data: withdrawal, error: insErr } = await admin
      .from('withdrawals')
      .insert({
        user_id: user.id,
        amount: numericAmount,
        bank_details: { bank, accountNumber, accountName },
        status: 'pending',
      })
      .select()
      .single();
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    const { data: profile } = await admin.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
    await notifyAdmins({
      title: `Withdrawal Requested: ₦${numericAmount.toLocaleString()}`,
      message: `${profile?.full_name || profile?.email || 'A client'} requested a ₦${numericAmount.toLocaleString()} affiliate payout.`,
      type: 'payment',
      link: '/admin/affiliate',
    }).catch(() => {});

    return NextResponse.json({ success: true, withdrawal });
  } catch (error: any) {
    console.error('Request withdrawal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
