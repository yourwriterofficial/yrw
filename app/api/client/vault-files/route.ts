import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // 1. Authenticate the caller
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Resolve the caller's order ids (by client_id or matching email)
    const { data: userOrders, error: ordersError } = await admin
      .from('orders')
      .select('order_id')
      .or(`client_id.eq.${user.id},email.eq.${user.email}`);

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    const orderIds = userOrders?.map(o => o.order_id) || [];
    if (orderIds.length === 0) {
      return NextResponse.json({ files: [] });
    }

    // 3. Fetch deliverables for those orders
    const { data: files, error: filesError } = await admin
      .from('final_deliverables')
      .select('*')
      .in('order_id', orderIds)
      .order('uploaded_at', { ascending: false });

    if (filesError) {
      return NextResponse.json({ error: filesError.message }, { status: 500 });
    }

    // 4. Filter out files scheduled for a future delivery date
    const now = new Date();
    const visibleFiles = (files || []).filter(f => {
      if (!f.scheduled_at) return true;
      return new Date(f.scheduled_at) <= now;
    });

    return NextResponse.json({ files: visibleFiles });
  } catch (err: any) {
    console.error('vault-files fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
