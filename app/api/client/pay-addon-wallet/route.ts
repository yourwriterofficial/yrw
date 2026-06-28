import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, addonId } = await request.json();
    if (!orderId || !addonId) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // 1. Fetch order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('client_id, email, additional_info')
      .eq('order_id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify ownership
    const isOwner = order.client_id === session.user.id || order.email.toLowerCase() === session.user.email?.toLowerCase();
    if (!isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Parse and locate addon details
    let payload: { notes?: string; extra_addons?: any[] } = {};
    try {
      payload = JSON.parse(order.additional_info || '{}');
    } catch {
      return NextResponse.json({ error: 'Invalid order structure' }, { status: 500 });
    }

    if (!payload.extra_addons || !Array.isArray(payload.extra_addons)) {
      return NextResponse.json({ error: 'No extra addons found' }, { status: 404 });
    }

    const addon = payload.extra_addons.find(a => a.id === addonId);
    if (!addon) {
      return NextResponse.json({ error: 'Addon not found' }, { status: 404 });
    }

    if (addon.status !== 'AWAITING_PAYMENT') {
      return NextResponse.json({ error: 'Addon is not awaiting payment' }, { status: 400 });
    }

    const price = Number(addon.price);
    if (isNaN(price) || price <= 0) {
      return NextResponse.json({ error: 'Invalid price quoted for addon' }, { status: 400 });
    }

    // 3. Check wallet balance
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', session.user.id)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    if (Number(wallet.balance) < price) {
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
    }

    // 4. Debit the wallet (add negative amount)
    const { error: rpcError } = await supabaseAdmin.rpc('increment_wallet', {
      user_id: session.user.id,
      add_amount: -price,
    });

    if (rpcError) {
      console.error('Wallet debit RPC error:', rpcError);
      return NextResponse.json({ error: 'Wallet debit failed: ' + rpcError.message }, { status: 500 });
    }

    // 5. Insert transaction log
    const txRef = `ADDON_${orderId}_${addonId}_${Date.now()}`;
    const { error: txError } = await supabaseAdmin.from('transactions').insert({
      user_id: session.user.id,
      amount: price,
      type: 'payment',
      reference: txRef,
      status: 'completed',
    });

    if (txError) {
      console.error('Addon payment transaction log error:', txError);
      // We don't fail the request here, but it's good to log
    }

    // 6. Mark addon as PAID and update db
    addon.status = 'PAID';
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ additional_info: JSON.stringify(payload) })
      .eq('order_id', orderId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, addon });
  } catch (error: any) {
    console.error('Wallet Addon Payment Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
