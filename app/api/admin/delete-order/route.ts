import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
    if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

    // Get internal numeric ID
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('order_id', orderId)
      .single();
    if (fetchError) throw new Error('Order not found');

    // Delete files from storage
    const { data: files } = await supabaseAdmin.storage.from('final-deliverables').list(orderId);
    if (files && files.length > 0) {
      await supabaseAdmin.storage.from('final-deliverables').remove(files.map(f => `${orderId}/${f.name}`));
    }

    // Delete the order (cascade will remove invoices, files records, etc.)
    const { error: deleteError } = await supabaseAdmin
      .from('orders')
      .delete()
      .eq('order_id', orderId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete order error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}