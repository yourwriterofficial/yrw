import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireAdmin } from '@/lib/adminAuth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  try {
    const { subject, html, userIds, allUsers } = await req.json()
    let emails: string[] = []

    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;
    const emailMap: Record<string, string> = {};
    authUsers.users.forEach((u: any) => { emailMap[u.id] = u.email; });

    if (allUsers) {
      emails = authUsers.users.map((u: any) => u.email).filter(Boolean);
    } else if (userIds && userIds.length) {
      emails = userIds.map((id: string) => emailMap[id]).filter(Boolean);
    } else {
      return NextResponse.json({ error: 'No recipients selected' }, { status: 400 })
    }

    if (emails.length === 0) {
      return NextResponse.json({ error: 'No valid email addresses found' }, { status: 400 })
    }

    // Send emails and log to email_logs for in-app alerts
    const results = await Promise.allSettled(
      emails.map(async (email) => {
        const { data, error } = await resend.emails.send({
          from: 'YourResearchWriter <noreply@yourresearchwriter.com.ng>',
          to: email,
          subject,
          html,
        });
        if (error) throw error;

        await supabaseAdmin.from('email_logs').insert({
          recipient: email,
          subject,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
        return data;
      })
    )

    const sentCount = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ success: true, sentCount })
  } catch (err: any) {
    console.error('Mass email error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}