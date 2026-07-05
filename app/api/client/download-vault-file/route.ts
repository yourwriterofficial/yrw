import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isOrderFullyPaid } from '@/lib/orderPayment';

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { fileId } = await request.json();
    if (!fileId) {
      return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
    }

    // 1. Authenticate the caller
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Look up the file and its order
    const { data: file, error: fetchError } = await admin
      .from('final_deliverables')
      .select('id, file_path, download_count, order_id')
      .eq('id', fileId)
      .single();

    if (fetchError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('order_id, client_id, email, payment_structure_type, payment_milestones, sixty_percent_paid, forty_percent_paid')
      .eq('order_id', file.order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found for this file' }, { status: 404 });
    }

    // 3. Authorize: the order must belong to this user (by id or email)
    const ownsOrder =
      (order.client_id && order.client_id === user.id) ||
      (order.email && user.email && order.email.toLowerCase() === user.email.toLowerCase());
    if (!ownsOrder) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 4. Gate on payment — files unlock only when the order is FULLY paid
    if (!isOrderFullyPaid(order)) {
      return NextResponse.json(
        { error: 'This file is locked until your balance is fully paid.' },
        { status: 403 }
      );
    }

    // 5. Issue a short-lived signed URL
    const { data: signedData, error: signedError } = await admin.storage
      .from('final-deliverables')
      .createSignedUrl(file.file_path, 60);

    if (signedError) {
      return NextResponse.json({ error: signedError.message }, { status: 500 });
    }

    await admin
      .from('final_deliverables')
      .update({
        downloaded_at: new Date().toISOString(),
        download_count: (file.download_count || 0) + 1,
      })
      .eq('id', fileId);

    return NextResponse.json({ signedUrl: signedData.signedUrl });
  } catch (err: any) {
    console.error('Download error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
