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

    // 1. Verify admin privilege
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile || !profile.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { orderId, addonId, price } = await request.json();
    if (!orderId || !addonId || price === undefined || price < 0) {
      return NextResponse.json({ error: 'Invalid input parameters' }, { status: 400 });
    }

    // 2. Fetch the order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('additional_info, email')
      .eq('order_id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 3. Parse and locate the addon
    let payload: { notes?: string; extra_addons?: any[] } = {};
    try {
      payload = JSON.parse(order.additional_info || '{}');
    } catch {
      return NextResponse.json({ error: 'Order additional_info is not valid JSON' }, { status: 500 });
    }

    if (!payload.extra_addons || !Array.isArray(payload.extra_addons)) {
      return NextResponse.json({ error: 'No extra addons found on this order' }, { status: 404 });
    }

    const addonIndex = payload.extra_addons.findIndex(a => a.id === addonId);
    if (addonIndex === -1) {
      return NextResponse.json({ error: 'Addon not found on this order' }, { status: 404 });
    }

    // 4. Update addon details
    payload.extra_addons[addonIndex].price = price;
    payload.extra_addons[addonIndex].status = price > 0 ? 'AWAITING_PAYMENT' : 'PENDING_QUOTE';

    // 5. Update database
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ additional_info: JSON.stringify(payload) })
      .eq('order_id', orderId);

    if (updateError) {
      throw updateError;
    }

    // 6. Send email notification to Client
    try {
      const { sendSystemEmail } = await import('@/lib/emailService');
      const formatNaira = (amount: number): string => '₦' + Math.round(amount).toLocaleString('en-NG');
      await sendSystemEmail({
        to: order.email,
        subject: `💰 Price Quoted for Custom Add-on: Order #${orderId}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
            <h2 style="color: #10b981;">Custom Add-on Approved</h2>
            <p>Your requested extra requirement for <strong>Order #${orderId}</strong> has been approved and quoted.</p>
            <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0;">
              <strong>Requirement:</strong> ${payload.extra_addons[addonIndex].name}<br/><br/>
              <strong>Quote Amount:</strong> <span style="font-size: 16px; color: #10b981; font-weight: bold;">${formatNaira(price)}</span>
            </div>
            <p>You can clear this payment from your client dashboard using your wallet balance or a debit/credit card to activate this feature.</p>
            <p style="margin-top: 30px;"><a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Pay & Activate Now</a></p>
          </div>
        `,
        orderId: orderId,
      });
    } catch (emailErr) {
      console.warn('Failed to send client addon quote notification:', emailErr);
    }

    return NextResponse.json({ success: true, addon: payload.extra_addons[addonIndex] });
  } catch (error: any) {
    console.error('Quote Addon Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
