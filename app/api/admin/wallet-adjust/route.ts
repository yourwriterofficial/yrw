import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const supabase = guard.admin;

  try {
    const { userId, amount, reason } = await request.json();
    if (!userId || amount === undefined) {
      return NextResponse.json({ error: 'Missing userId or amount' }, { status: 400 });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // 1. Update wallet balance
    const { error: rpcError, data: newBalance } = await supabase.rpc('increment_wallet', {
      user_id: userId,
      add_amount: numericAmount,
    });
    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    // 2. Log transaction with note
    const { error: txError } = await supabase.from('transactions').insert({
      user_id: userId,
      amount: Math.abs(numericAmount),
      type: numericAmount > 0 ? 'deposit' : 'payment',
      reference: `ADMIN_${Date.now()}`,
      status: 'completed',
      notes: reason || (numericAmount > 0 ? 'Admin credit' : 'Admin deduction'),
    });
    if (txError) {
      console.error('Transaction log error:', txError);
      // Still return success since wallet updated
    }

    return NextResponse.json({ success: true, newBalance });
  } catch (err: any) {
    console.error('Wallet adjust error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}