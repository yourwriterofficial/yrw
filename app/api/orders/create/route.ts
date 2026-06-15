// /api/orders/create/route.ts
export async function POST(req: Request) {
  const { user } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { topic, deadline, addons } = await req.json()
  const orderId = `ORD-${Date.now()}`
  await supabase.from('orders').insert({
    order_id: orderId,
    email: user.email,
    legal_name: user.user_metadata.full_name,
    research_topic: topic,
    deadline,
    workflow_status: 'Briefing Received',
    user_id: user.id,
  })
  // attach addons to order_addons_join table
  return NextResponse.json({ orderId })
}