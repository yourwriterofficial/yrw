import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { topic, deadline, addons } = await req.json()
  const orderId = `ORD-${Date.now()}`

  const { error } = await supabase.from('orders').insert({
    order_id: orderId,
    email: user.email,
    legal_name: user.user_metadata?.full_name,
    research_topic: topic,
    deadline,
    workflow_status: 'Briefing Received',
    user_id: user.id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ orderId })
}