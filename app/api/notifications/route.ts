import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if the user is admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();
      
    const isAdmin = profile?.is_admin === true;
    const email = session.user.email || '';
    const adminEmail = process.env.ADMIN_EMAIL || 'yourwriterofficial@gmail.com';

    let query = supabaseAdmin
      .from('email_logs')
      .select('id, subject, status, sent_at, orders(order_id)');

    if (isAdmin) {
      // Admin sees notifications sent to admin email address
      query = query.eq('recipient', adminEmail);
    } else {
      // Clients see notifications sent to their own email address
      query = query.eq('recipient', email);
    }

    const { data: notifications, error } = await query
      .order('sent_at', { ascending: false })
      .limit(30);

    if (error) {
      throw error;
    }

    const mapped = notifications.map((n: any) => ({
      id: n.id,
      subject: n.subject || 'System Notification',
      status: n.status || 'sent',
      sent_at: n.sent_at,
      order_id: n.orders?.order_id || null
    }));

    return NextResponse.json({ success: true, notifications: mapped });
  } catch (error: any) {
    console.error('Fetch notifications error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
