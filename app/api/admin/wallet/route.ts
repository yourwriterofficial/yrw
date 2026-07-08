import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const supabaseAdmin = guard.admin;

  try {
    const { userId, balance } = await request.json();
    if (!userId || balance === undefined) {
      return NextResponse.json({ error: 'Missing userId or balance' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('wallets')
      .upsert({ user_id: userId, balance }, { onConflict: 'user_id' });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Wallet update error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}