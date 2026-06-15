import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { userId, amount, callbackUrl } = await req.json()
  const reference = `WALLET_${Date.now()}_${userId.slice(0, 8)}`

  // Get user email
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
  const email = userData.user.email

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: amount * 100, // convert to kobo
      reference,
      callback_url: callbackUrl,
      metadata: { type: 'wallet_topup', userId, amount },
    }),
  })
  const data = await paystackRes.json()
  if (!data.status) {
    return NextResponse.json({ error: data.message }, { status: 400 })
  }
  return NextResponse.json({ authorization_url: data.data.authorization_url, reference })
}