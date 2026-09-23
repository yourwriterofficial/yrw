import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  getPendingManualPayments,
  approveManualPayment,
  rejectManualPayment,
} from '@/lib/manualPayments';
import {
  getUserBankDetails,
  setUserBankDetails,
  getAllUserBankAssignments,
} from '@/lib/bankDetails';

async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) return null;
  return user;
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    const adminUser = await checkAdmin(supabase);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'get_all_banks') {
      const banks = await getAllUserBankAssignments();
      return NextResponse.json({ success: true, banks });
    }

    if (action === 'get_user_bank') {
      const userId = searchParams.get('userId');
      const bank = await getUserBankDetails(userId);
      return NextResponse.json({ success: true, bank });
    }

    const payments = await getPendingManualPayments();
    return NextResponse.json({ success: true, payments });
  } catch (err: any) {
    console.error('Admin manual payments GET error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const adminUser = await checkAdmin(supabase);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, reference, reason, notes, userId, bankDetails } = body;

    if (action === 'approve') {
      if (!reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
      await approveManualPayment(reference, notes);
      return NextResponse.json({ success: true, message: 'Payment approved and applied successfully' });
    }

    if (action === 'reject') {
      if (!reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
      await rejectManualPayment(reference, reason);
      return NextResponse.json({ success: true, message: 'Payment marked as rejected' });
    }

    if (action === 'assign_bank') {
      if (!userId || !bankDetails || !bankDetails.account_number) {
        return NextResponse.json({ error: 'Missing user ID or bank details' }, { status: 400 });
      }
      const ok = await setUserBankDetails(userId, bankDetails);
      if (ok) {
        return NextResponse.json({ success: true, message: 'Custom bank account assigned to user successfully' });
      }
      return NextResponse.json({ error: 'Failed to assign bank account' }, { status: 500 });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('Admin manual payments POST error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
