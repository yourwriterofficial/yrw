import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import xss from 'xss';

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

    const { orderId, addonName } = await request.json();
    if (!orderId || !addonName || !addonName.trim()) {
      return NextResponse.json({ error: 'Invalid orderId or addonName' }, { status: 400 });
    }

    const sanitizedAddonName = xss(addonName.trim());

    // 1. Fetch current order detail
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, client_id, email, additional_info')
      .eq('order_id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 2. Verify authorization
    const isOwner = order.client_id === session.user.id || order.email.toLowerCase() === session.user.email?.toLowerCase();
    
    // Check if the user is admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();
      
    const isAdmin = profile?.is_admin === true;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Parse and update additional_info
    let payload: { notes?: string; extra_addons?: any[] } = {};
    const rawInfo = order.additional_info || '';
    
    try {
      if (rawInfo.trim().startsWith('{') && rawInfo.trim().endsWith('}')) {
        payload = JSON.parse(rawInfo);
      } else {
        payload = { notes: rawInfo, extra_addons: [] };
      }
    } catch {
      payload = { notes: rawInfo, extra_addons: [] };
    }

    if (!payload.extra_addons) {
      payload.extra_addons = [];
    }

    const newAddon = {
      id: 'addon_' + Math.floor(100000 + Math.random() * 900000).toString(),
      name: sanitizedAddonName,
      price: 0,
      status: 'PENDING_QUOTE',
      created_at: new Date().toISOString(),
    };

    payload.extra_addons.push(newAddon);

    // 4. Save to db
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ additional_info: JSON.stringify(payload) })
      .eq('order_id', orderId);

    if (updateError) {
      throw updateError;
    }

    // 5. Send email notification to Admin
    try {
      const { sendSystemEmail } = await import('@/lib/emailService');
      const adminEmail = process.env.ADMIN_EMAIL || 'yourwriterofficial@gmail.com';
      await sendSystemEmail({
        to: adminEmail,
        subject: `🚨 New Custom Add-on Requested: Order #${orderId}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
            <h2 style="color: #8b5cf6;">New Add-on Requested</h2>
            <p>A client has requested a custom extra requirement for <strong>Order #${orderId}</strong>.</p>
            <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #8b5cf6; margin: 20px 0;">
              <strong>Requirement:</strong><br/>
              ${sanitizedAddonName}
            </div>
            <p>Please log in to the Admin Dashboard to review this request and set the pricing quote.</p>
            <p style="margin-top: 30px;"><a href="${process.env.NEXT_PUBLIC_BASE_URL}/admin/orders" style="background-color: #8b5cf6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Review Request</a></p>
          </div>
        `,
        orderId: orderId,
      });
    } catch (emailErr) {
      console.warn('Failed to send admin addon request notification:', emailErr);
    }

    return NextResponse.json({ success: true, addon: newAddon });
  } catch (error: any) {
    console.error('Request Addon Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
