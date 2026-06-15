import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { subject, html, userIds, allUsers } = await req.json()
    let emails: string[] = []

    if (allUsers) {
      const { data, error } = await supabaseAdmin.from('profiles').select('email')
      if (error) throw new Error(error.message)
      if (data && data.length > 0) {
        emails = data.map(p => p.email)
      }
    } else if (userIds && userIds.length) {
      const { data, error } = await supabaseAdmin.from('profiles').select('email').in('id', userIds)
      if (error) throw new Error(error.message)
      if (data && data.length > 0) {
        emails = data.map(p => p.email)
      }
    } else {
      return NextResponse.json({ error: 'No recipients selected' }, { status: 400 })
    }

    if (emails.length === 0) {
      return NextResponse.json({ error: 'No valid email addresses found' }, { status: 400 })
    }

    // Send emails in batches (Resend can handle up to 100 per request, but we'll send one by one)
    const results = await Promise.allSettled(
      emails.map(email =>
        resend.emails.send({
          from: 'YourResearchWriter <noreply@yourresearchwriter.com.ng>',
          to: email,
          subject,
          html,
        })
      )
    )

    const sentCount = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ success: true, sentCount })
  } catch (err: any) {
    console.error('Mass email error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}