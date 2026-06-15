import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
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