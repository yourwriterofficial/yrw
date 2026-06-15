import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend' // or your email service

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { subject, html, userIds, allUsers } = await req.json()
  let emails: string[] = []
  if (allUsers) {
    const { data } = await supabaseAdmin.from('profiles').select('email')
    emails = data.map(p => p.email)
  } else if (userIds?.length) {
    const { data } = await supabaseAdmin.from('profiles').select('email').in('id', userIds)
    emails = data.map(p => p.email)
  }
  // Send emails in batches
  await Promise.all(emails.map(email => resend.emails.send({ from: 'admin@yourdomain.com', to: email, subject, html })))
  return NextResponse.json({ success: true })
}