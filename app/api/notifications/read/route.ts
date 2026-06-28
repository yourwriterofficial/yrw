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

    // Check if the user is admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();
      
    const isAdmin = profile?.is_admin === true;
    const email = session.user.email || '';
    const adminEmail = process.env.ADMIN_EMAIL || 'yourwriterofficial@gmail.com';

    if (all) {
      const recipientEmail = isAdmin ? adminEmail : email;
      const { error } = await supabaseAdmin
        .from('email_logs')
        .update({ status: 'read' })
        .eq('recipient', recipientEmail);

      if (error) throw error;
    } else if (id) {
      // Verify recipient matches
      const { data: log, error: checkError } = await supabaseAdmin
        .from('email_logs')
        .select('recipient')
        .eq('id', id)
        .single();

      if (checkError || !log) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }

      const expectedRecipient = isAdmin ? adminEmail : email;
      if (log.recipient.toLowerCase() !== expectedRecipient.toLowerCase()) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { error } = await supabaseAdmin
        .from('email_logs')
        .update({ status: 'read' })
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
