import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const supabaseAdmin = guard.admin;

  const { orderId, updates } = await request.json()
  const { error } = await supabaseAdmin
    .from('orders')
    .update(updates)
    .eq('order_id', orderId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}