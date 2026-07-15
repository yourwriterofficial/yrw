import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifyUser, notifyAdmins } from '@/lib/notify';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { conversationId, messageText, senderId } = await request.json();

    if (!conversationId || !messageText || !senderId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Retrieve conversation details
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('id, participant1_id')
      .eq('id', conversationId)
      .single();

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const clientUserId = conv.participant1_id;

    if (senderId === clientUserId) {
      // 1. Client sent a message -> notify all admins
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', clientUserId)
        .single();
      
      const clientName = profile?.full_name || 'Client';

      const { emailShell } = await import('@/lib/emailTemplates');
      const adminHtml = emailShell(
        `<h2>New Support Message</h2>
         <p>You have received a new support chat from <strong>${clientName}</strong>:</p>
         <blockquote>"${messageText}"</blockquote>`,
        'Reply in Admin Dashboard',
        `${process.env.NEXT_PUBLIC_BASE_URL}/admin/chat?open=${conversationId}`
      );

      await notifyAdmins({
        title: `Support Chat from ${clientName}`,
        message: messageText,
        type: 'admin_message',
        link: `/admin/chat?open=${conversationId}`,
        emailSubject: `[SUPPORT] New message from ${clientName}`,
        emailHtml: adminHtml,
      });
    } else {
      // 2. Admin sent a message -> notify the client
      const { emailShell } = await import('@/lib/emailTemplates');
      
      const clientHtml = emailShell(
        `<h2>New Message from Support</h2>
         <p>Hello,</p>
         <p>You have received a new reply from our academic help desk regarding your support ticket:</p>
         <blockquote>"${messageText}"</blockquote>
         <p>Please log in to your portal to reply.</p>`,
        'Open Support Chat', `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client?tab=chat`
      );

      await notifyUser({
        userId: clientUserId,
        title: 'New message from Support Help Desk',
        message: messageText.length > 80 ? messageText.slice(0, 77) + '...' : messageText,
        type: 'admin_message',
        link: '/dashboard/client?tab=chat',
        emailHtml: clientHtml,
        emailSubject: 'New message from Support Help Desk',
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Support notify route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
