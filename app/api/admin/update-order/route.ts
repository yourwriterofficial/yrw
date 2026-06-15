import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// Helper to send email via your existing API
async function sendEmail(to: string, subject: string, html: string, orderId: string) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html, orderId }),
    })
  } catch (err) {
    console.error('Failed to send email:', err)
  }
}

// Email templates (import from your emailTemplates)
import { emailTemplates } from '@/lib/emailTemplates'

type OrderData = {
  order_id: string
  email: string
  legal_name: string
  topic: string
  financial_quote: number
  workflow_status: string
  sixty_percent_paid: boolean
  forty_percent_paid: boolean
  work_submitted: boolean
}

export async function POST(request: Request) {
  try {
    const { orderId, updates } = await request.json()
    if (!orderId || !updates) {
      return NextResponse.json({ error: 'Missing orderId or updates' }, { status: 400 })
    }

    // 1. Fetch current order state
    const { data: oldOrder, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('order_id, email, legal_name, topic, financial_quote, workflow_status, sixty_percent_paid, forty_percent_paid, work_submitted')
      .eq('order_id', orderId)
      .single()

    if (fetchError || !oldOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // 2. Apply update
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updates)
      .eq('order_id', orderId)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 3. Detect changes and send emails
    const orderEmailData = {
      order_id: oldOrder.order_id,
      legal_name: oldOrder.legal_name,
      email: oldOrder.email,
      topic: oldOrder.topic,
      financial_quote: oldOrder.financial_quote,
    }

    // --- Workflow status change ---
    if (updates.workflow_status && updates.workflow_status !== oldOrder.workflow_status) {
      const newStatus = updates.workflow_status
      if (newStatus === 'Quote Sent') {
        await sendEmail(
          oldOrder.email,
          emailTemplates.quoteSent(orderEmailData).subject,
          emailTemplates.quoteSent(orderEmailData).html,
          orderId
        )
      } else if (newStatus === 'Completed') {
        await sendEmail(
          oldOrder.email,
          emailTemplates.orderCompleted(orderEmailData).subject,
          emailTemplates.orderCompleted(orderEmailData).html,
          orderId
        )
      }
      // You can add other status emails here if needed (e.g., 'Synthesis Active')
    }

    // --- Deposit payment (60%) changed from false to true ---
    if (updates.sixty_percent_paid === true && oldOrder.sixty_percent_paid === false) {
      await sendEmail(
        oldOrder.email,
        emailTemplates.depositPaid(orderEmailData).subject,
        emailTemplates.depositPaid(orderEmailData).html,
        orderId
      )
    }

    // --- Work submitted changed from false to true ---
    if (updates.work_submitted === true && oldOrder.work_submitted === false) {
      await sendEmail(
        oldOrder.email,
        emailTemplates.workSubmitted(orderEmailData).subject,
        emailTemplates.workSubmitted(orderEmailData).html,
        orderId
      )
    }

    // --- Balance payment (40%) changed from false to true ---
    if (updates.forty_percent_paid === true && oldOrder.forty_percent_paid === false) {
      await sendEmail(
        oldOrder.email,
        emailTemplates.balancePaid(orderEmailData).subject,
        emailTemplates.balancePaid(orderEmailData).html,
        orderId
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}