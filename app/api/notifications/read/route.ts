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

    const { id, all } = await request.json();

    if (all) {
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({ read: true })
        .eq('user_id', session.user.id);

      if (error) throw error;
    } else if (id) {
      // Verify ownership before marking read
      const { data: notif, error: checkError } = await supabaseAdmin
        .from('notifications')
        .select('user_id')
        .eq('id', id)
        .single();

      if (checkError || !notif) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }

      if (notif.user_id !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { error } = await supabaseAdmin
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      if (error) throw error;
    } else {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Mark read error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
