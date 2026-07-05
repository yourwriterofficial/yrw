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

    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('id, title, message, type, read, sent_at, link, orders(order_id)')
      .eq('user_id', session.user.id)
      .order('sent_at', { ascending: false })
      .limit(30);

    if (error) {
      throw error;
    }

    const mapped = notifications.map((n: any) => ({
      id: n.id,
      subject: n.title || n.message || 'System Notification',
      message: n.message,
      status: n.read ? 'read' : 'sent',
      sent_at: n.sent_at,
      link: n.link,
      order_id: n.orders?.order_id || null,
    }));

    return NextResponse.json({ success: true, notifications: mapped });
  } catch (error: any) {
    console.error('Fetch notifications error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
