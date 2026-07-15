import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

/**
 * Approve or reject a pending affiliate withdrawal. The amount was already
 * debited from the client's wallet when they requested it (see
 * /api/client/request-withdrawal), so rejecting must refund it back —
 * approving just marks it processed (the actual bank transfer happens
 * manually, outside this system).
 */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const admin = guard.admin;

  try {
    const { withdrawalId, status } = await request.json();
    if (!withdrawalId || (status !== 'approved' && status !== 'rejected')) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { data: withdrawal, error: fetchErr } = await admin
      .from('withdrawals')
      .select('id, user_id, amount, status')
      .eq('id', withdrawalId)
      .single();
    if (fetchErr || !withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
    }
    if (withdrawal.status !== 'pending') {
      return NextResponse.json({ error: 'This withdrawal has already been processed' }, { status: 400 });
    }

    if (status === 'rejected') {
      const { error: refundErr } = await admin.rpc('increment_wallet', {
        user_id: withdrawal.user_id,
        add_amount: withdrawal.amount,
      });
      if (refundErr) {
        return NextResponse.json({ error: 'Refund failed: ' + refundErr.message }, { status: 500 });
      }
      await admin.from('transactions').insert({
        user_id: withdrawal.user_id,
        amount: withdrawal.amount,
        type: 'deposit',
        reference: `WITHDRAW_REFUND_${withdrawalId}_${Date.now()}`,
        status: 'completed',
        notes: 'Withdrawal request rejected — refunded to wallet',
      });
    }

    const { error: updErr } = await admin
      .from('withdrawals')
      .update({ status, processed_at: new Date().toISOString() })
      .eq('id', withdrawalId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // Notify client of approval/rejection
    try {
      const { notifyUser } = await import('@/lib/notify');
      const { emailShell } = await import('@/lib/emailTemplates');
      const { data: userProfile } = await admin
        .from('profiles')
        .select('email, full_name')
        .eq('id', withdrawal.user_id)
        .single();
      
      if (userProfile) {
        const clientHtml = emailShell(
          `<h2>Affiliate Withdrawal Request ${status === 'approved' ? 'Approved' : 'Rejected'}</h2>
           <p>Hello ${userProfile.full_name || 'Partner'},</p>
           <p>Your affiliate withdrawal request for <strong>₦${withdrawal.amount.toLocaleString()}</strong> has been <strong>${status}</strong>.</p>
           ${status === 'rejected' ? '<p>The requested amount has been fully refunded back to your wallet balance.</p>' : '<p>The funds will be transferred to your nominated bank account shortly.</p>'}`,
          'Go to Wallet Ledger',
          `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard/client?tab=wallet`
        );

        await notifyUser({
          userId: withdrawal.user_id,
          title: `Withdrawal ${status === 'approved' ? 'Approved' : 'Rejected'}`,
          message: `Your affiliate payout of ₦${withdrawal.amount.toLocaleString()} was ${status}.`,
          type: 'payment',
          link: '/dashboard/client?tab=wallet',
          emailHtml: clientHtml,
          emailSubject: `Affiliate Payout Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        });
      }
    } catch (e) {
      console.warn('Failed to notify client of withdrawal processing:', e);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Process withdrawal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
